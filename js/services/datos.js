// Capa de acceso a datos. Centraliza las consultas a Firestore según el
// modelo definido en docs/modelo-datos.md, para que los módulos de vista
// no escriban queries directamente.

import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc, deleteDoc,
  query, where, orderBy, limit as limitar, serverTimestamp, runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { db, auth } from "./firebase.js";

// --- Productos (catálogo compartido) + stock por empresa ---

export async function listarProductos() {
  const snap = await getDocs(query(collection(db, "productos"), orderBy("nombre")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function obtenerStockProducto(productoId, empresaId) {
  const ref = doc(db, "productos", productoId, "stock", empresaId);
  const snap = await getDoc(ref);
  return snap.exists() ? snap.data() : null;
}

export async function crearProducto(datosProducto) {
  return addDoc(collection(db, "productos"), {
    ...datosProducto,
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp()
  });
}

export async function actualizarStockProducto(productoId, empresaId, datosStock) {
  const ref = doc(db, "productos", productoId, "stock", empresaId);
  return updateDoc(ref, datosStock);
}

// --- Categorías (compartidas) ---

export async function listarCategorias() {
  const snap = await getDocs(query(collection(db, "categorias"), orderBy("nombre")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// --- Clientes (compartidos) ---

export async function listarClientes() {
  const snap = await getDocs(query(collection(db, "clientes"), orderBy("nombre")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// Nota: la búsqueda de cliente por nombre/teléfono (usada en el
// autocompletado del formulario de Reparaciones) se resuelve en memoria
// sobre el resultado de listarClientes(), igual que la búsqueda de
// productos. Si el padrón de clientes migrado resulta muy grande (varios
// miles), conviene revisar esto y mover el filtrado a Firestore o a un
// índice de búsqueda dedicado — lo señalamos para la etapa de migración.

export async function crearCliente(datosCliente) {
  return addDoc(collection(db, "clientes"), {
    ...datosCliente,
    estado: "activo",
    creadoEn: serverTimestamp()
  });
}

export async function actualizarCliente(clienteId, datos) {
  return updateDoc(doc(db, "clientes", clienteId), datos);
}

// --- Proveedores (compartidos) ---

export async function listarProveedores() {
  const snap = await getDocs(query(collection(db, "proveedores"), orderBy("razonSocial")));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function crearProveedor(datosProveedor) {
  return addDoc(collection(db, "proveedores"), {
    ...datosProveedor,
    estado: "activo",
    creadoEn: serverTimestamp()
  });
}

export async function actualizarProveedor(proveedorId, datos) {
  return updateDoc(doc(db, "proveedores", proveedorId), datos);
}

// --- Reparaciones (por empresa) ---

export async function listarReparaciones(empresaId, estados = null) {
  const condiciones = [where("empresaId", "==", empresaId)];
  if (estados) condiciones.push(where("estado", "in", estados));

  const snap = await getDocs(
    query(collection(db, "reparaciones"), ...condiciones, orderBy("fechaIngreso", "desc"))
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Devuelve el próximo número correlativo de reparación para una empresa,
 * incrementando el contador de forma atómica (contadores/{empresaId}).
 * Una transacción evita que dos ingresos simultáneos se lleven el mismo
 * número — algo que un simple "contar documentos" no garantiza.
 */
async function obtenerProximoNumeroReparacion(empresaId) {
  const refContador = doc(db, "contadores", `reparaciones_${empresaId}`);

  return runTransaction(db, async (transaccion) => {
    const snap = await transaccion.get(refContador);
    const actual = snap.exists() ? snap.data().ultimoNumero : 0;
    const siguiente = actual + 1;
    // Se guarda empresaId explícito en el propio documento para que las
    // Security Rules puedan validar pertenencia sin parsear el id del
    // documento (ver firestore.rules) — más robusto que separar el string.
    transaccion.set(refContador, { ultimoNumero: siguiente, empresaId });
    return siguiente;
  });
}

export async function crearReparacion(empresaId, datosReparacion) {
  const numero = await obtenerProximoNumeroReparacion(empresaId);

  return addDoc(collection(db, "reparaciones"), {
    ...datosReparacion,
    empresaId,
    numero,
    estado: "pendiente",
    creadoEn: serverTimestamp(),
    actualizadoEn: serverTimestamp()
  });
}

export async function actualizarEstadoReparacion(reparacionId, nuevoEstado) {
  return updateDoc(doc(db, "reparaciones", reparacionId), {
    estado: nuevoEstado,
    actualizadoEn: serverTimestamp()
  });
}

// --- Facturas (por empresa) ---

export async function listarFacturas(empresaId, cantidadMaxima = 50) {
  const snap = await getDocs(
    query(
      collection(db, "facturas"),
      where("empresaId", "==", empresaId),
      orderBy("fecha", "desc"),
      limitar(cantidadMaxima)
    )
  );
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Crea una factura y descuenta el stock de sus ítems en una sola
 * transacción. Si el stock de algún producto no alcanza, no se crea nada
 * (ni la factura ni ningún descuento parcial) y se informa qué producto
 * falló — se prefiere bloquear la venta antes que dejar stock negativo,
 * según lo definido con Corcho.
 *
 * datosFactura.items: [{ productoId, nombreCache, cantidad, precioUnitario, ivaPorcentaje, subtotal }]
 */
export async function crearFactura(empresaId, datosFactura) {
  const refContador = doc(db, "contadores", `facturas_${empresaId}`);
  const itemsConProducto = datosFactura.items.filter((item) => item.productoId);

  const nuevaFacturaRef = doc(collection(db, "facturas"));

  await runTransaction(db, async (transaccion) => {
    // 1. Leer todo lo necesario ANTES de escribir nada (regla de Firestore:
    // todas las lecturas de una transacción van primero).
    const refsStock = itemsConProducto.map((item) =>
      doc(db, "productos", item.productoId, "stock", empresaId)
    );
    const snapsStock = await Promise.all(refsStock.map((ref) => transaccion.get(ref)));
    const snapContador = await transaccion.get(refContador);

    // 2. Validar stock suficiente para cada ítem antes de escribir nada.
    // Si el documento de stock ni siquiera existe para esta empresa (por
    // ejemplo, un producto migrado sin stock inicial cargado), se informa
    // con un mensaje claro en vez de fallar más adelante con un error de
    // Firestore al intentar actualizar un documento inexistente.
    itemsConProducto.forEach((item, i) => {
      if (!snapsStock[i].exists()) {
        throw new Error(`"${item.nombreCache}" no tiene stock cargado para esta empresa.`);
      }
      const stockActual = snapsStock[i].data().cantidad;
      if (stockActual < item.cantidad) {
        throw new Error(
          `Stock insuficiente para "${item.nombreCache}" (disponible: ${stockActual}, pedido: ${item.cantidad}).`
        );
      }
    });

    // 3. Recién acá se escribe: descuento de stock + número correlativo + factura.
    itemsConProducto.forEach((item, i) => {
      const stockActual = snapsStock[i].data().cantidad;
      transaccion.update(refsStock[i], { cantidad: stockActual - item.cantidad });
    });

    const numeroActual = snapContador.exists() ? snapContador.data().ultimoNumero : 0;
    const numero = numeroActual + 1;
    transaccion.set(refContador, { ultimoNumero: numero, empresaId });

    transaccion.set(nuevaFacturaRef, {
      ...datosFactura,
      empresaId,
      numero,
      fecha: serverTimestamp()
    });
  });

  return nuevaFacturaRef;
}

// --- Empresa (configuración/perfil) ---

export async function obtenerEmpresa(empresaId) {
  const snap = await getDoc(doc(db, "empresas", empresaId));
  return snap.exists() ? { id: snap.id, ...snap.data() } : null;
}

export async function actualizarEmpresa(empresaId, datos) {
  return updateDoc(doc(db, "empresas", empresaId), datos);
}

// --- Usuarios ---

export async function listarUsuarios() {
  const snap = await getDocs(collection(db, "usuarios"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/**
 * Crea un usuario nuevo (Firebase Authentication + Firestore) a través de
 * una Netlify Function con Firebase Admin SDK. Se resuelve así y no con
 * createUserWithEmailAndPassword porque ese método del SDK de cliente
 * loguea automáticamente como el usuario recién creado, echando al
 * administrador que lo está dando de alta — ver netlify/functions/crear-usuario.js.
 */
export async function crearUsuario({ nombre, email, contrasena, empresas, empresaPorDefecto, rol }) {
  const idToken = await auth.currentUser.getIdToken();

  const respuesta = await fetch("/.netlify/functions/crear-usuario", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${idToken}`
    },
    body: JSON.stringify({ nombre, email, contrasena, empresas, empresaPorDefecto, rol })
  });

  const resultado = await respuesta.json();

  if (!respuesta.ok) {
    throw new Error(resultado.error || "No se pudo crear el usuario.");
  }

  return resultado;
}

export async function actualizarUsuario(uid, datos) {
  return updateDoc(doc(db, "usuarios", uid), datos);
}
