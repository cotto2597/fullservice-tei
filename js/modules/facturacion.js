// Vista Facturación: listado filtrado por mes/empresa y formulario de
// nuevo comprobante. Sin integración fiscal real (ARCA/Facturatrón aparte,
// confirmado por Corcho) — el tipo A/B es solo un dato del comprobante.
//
// Al confirmar una factura con productos del catálogo, el stock de la
// empresa activa se descuenta de forma atómica junto con la creación del
// comprobante (ver crearFactura en services/datos.js). Si el stock no
// alcanza, la operación completa se rechaza — no se genera la factura.

import { listarFacturas, crearFactura, listarProductos, obtenerStockProducto, listarClientes, crearCliente } from "../services/datos.js";
import { formatearMoneda, formatearFecha, normalizarBusqueda, mostrarExito, mostrarError } from "../utils.js";
import { TIPOS_COMPROBANTE, FORMAS_PAGO, IVA_PORCENTAJE_DEFECTO } from "../config.js";

export async function renderizarFacturacion(contenedor, sesion) {
  const empresaId = sesion.empresaActiva;

  contenedor.innerHTML = `
    <div class="barra-acciones">
      <input type="month" id="filtro-mes-facturas" value="${new Date().toISOString().slice(0, 7)}" />
      <button id="boton-nueva-factura" class="btn btn-primario">+ Nuevo comprobante</button>
    </div>

    <div class="superficie tabla-envoltorio" style="margin-top: var(--espacio-4);">
      <table class="tabla">
        <thead>
          <tr><th>Nro</th><th>Fecha</th><th>Cliente</th><th>Tipo</th><th>Forma de pago</th><th>Total</th></tr>
        </thead>
        <tbody id="cuerpo-tabla-facturas"></tbody>
      </table>
    </div>
  `;

  async function cargarListado() {
    const cuerpo = contenedor.querySelector("#cuerpo-tabla-facturas");
    cuerpo.innerHTML = `<tr><td colspan="6"><div class="loader"></div></td></tr>`;

    const mesSeleccionado = contenedor.querySelector("#filtro-mes-facturas").value; // "YYYY-MM"
    const todas = await listarFacturas(empresaId, 200);
    const filtradas = todas.filter((f) => {
      const fecha = f.fecha?.toDate ? f.fecha.toDate() : new Date(f.fecha);
      return fecha.toISOString().slice(0, 7) === mesSeleccionado;
    });

    if (filtradas.length === 0) {
      cuerpo.innerHTML = `<tr><td colspan="6"><p class="estado-vacio">No hay comprobantes en este mes.</p></td></tr>`;
      return;
    }

    cuerpo.innerHTML = filtradas.map((f) => {
      const fecha = f.fecha?.toDate ? f.fecha.toDate() : new Date(f.fecha);
      return `
        <tr>
          <td class="numerico">${f.numero ?? "—"}</td>
          <td>${formatearFecha(fecha)}</td>
          <td>${f.clienteNombreCache || "Consumidor Final"}</td>
          <td>${TIPOS_COMPROBANTE[f.tipo] || f.tipo}${f.facturaTipo ? ` ${f.facturaTipo}` : ""}</td>
          <td>${f.formaPago || "—"}</td>
          <td class="numerico">${formatearMoneda(f.total)}</td>
        </tr>
      `;
    }).join("");
  }

  contenedor.querySelector("#filtro-mes-facturas").addEventListener("change", cargarListado);

  contenedor.querySelector("#boton-nueva-factura").addEventListener("click", async () => {
    const [productos, clientes] = await Promise.all([listarProductos(), listarClientes()]);
    abrirModalNuevaFactura(productos, clientes, empresaId, async (datosFactura) => {
      try {
        await crearFactura(empresaId, datosFactura);
        mostrarExito("Comprobante generado correctamente.");
        cargarListado();
      } catch (error) {
        console.error(error);
        // El mensaje de stock insuficiente viaja en error.message desde la transacción.
        mostrarError(error.message || "No se pudo generar el comprobante.");
      }
    });
  });

  cargarListado();
}

function abrirModalNuevaFactura(productos, clientes, empresaId, alGuardar) {
  let clienteSeleccionado = null; // null = Consumidor Final
  const items = []; // { productoId, nombreCache, cantidad, precioUnitario, ivaPorcentaje, subtotal }

  const fondo = document.createElement("div");
  fondo.className = "modal-fondo";
  fondo.innerHTML = `
    <div class="modal modal-ancho">
      <div class="modal-header">
        <h3>Nuevo comprobante</h3>
        <button class="btn-icono" id="cerrar-modal-factura">✕</button>
      </div>
      <div class="modal-body">
        <div class="fila-campos">
          <div class="campo">
            <label>Tipo de comprobante</label>
            <select id="campo-tipo">
              ${Object.entries(TIPOS_COMPROBANTE).map(([valor, label]) => `<option value="${valor}">${label}</option>`).join("")}
            </select>
          </div>
          <div class="campo">
            <label>Factura A/B (solo dato, sin validación fiscal)</label>
            <select id="campo-factura-tipo">
              <option value="">N/A</option>
              <option value="A">A</option>
              <option value="B">B</option>
            </select>
          </div>
          <div class="campo">
            <label>Forma de pago</label>
            <select id="campo-forma-pago">
              ${FORMAS_PAGO.map((f) => `<option value="${f}">${f}</option>`).join("")}
            </select>
          </div>
        </div>

        <div class="campo" style="position: relative;">
          <label>Cliente</label>
          <input type="text" id="campo-buscar-cliente-factura" placeholder="Consumidor Final (dejar vacío) o buscar..." autocomplete="off" />
          <div id="resultados-cliente-factura" class="lista-autocompletar" hidden></div>
        </div>

        <hr style="border: none; border-top: 1px solid var(--color-borde); margin: var(--espacio-4) 0;" />

        <div class="campo" style="position: relative;">
          <label>Agregar producto</label>
          <input type="text" id="campo-buscar-producto" placeholder="Buscar por nombre o código..." autocomplete="off" />
          <div id="resultados-producto" class="lista-autocompletar" hidden></div>
        </div>

        <div class="tabla-envoltorio">
          <table class="tabla" id="tabla-items-factura">
            <thead>
              <tr><th>Producto</th><th>Cant.</th><th>Precio unit.</th><th>Subtotal</th><th></th></tr>
            </thead>
            <tbody id="cuerpo-items-factura">
              <tr><td colspan="5"><p class="estado-vacio">Todavía no agregaste productos.</p></td></tr>
            </tbody>
          </table>
        </div>

        <div class="resumen-totales">
          <div><span>Subtotal</span><span id="texto-subtotal" class="numerico">${formatearMoneda(0)}</span></div>
          <div><span>IVA (${IVA_PORCENTAJE_DEFECTO}%)</span><span id="texto-iva" class="numerico">${formatearMoneda(0)}</span></div>
          <div class="resumen-total-final"><span>Total</span><span id="texto-total" class="numerico">${formatearMoneda(0)}</span></div>
        </div>

        <div class="campo">
          <label>Observaciones</label>
          <textarea id="campo-observaciones-factura" rows="2"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secundario" id="cancelar-modal-factura">Cancelar</button>
        <button class="btn btn-primario" id="guardar-modal-factura">Generar comprobante</button>
      </div>
    </div>

    <style>
      .modal-ancho { max-width: 720px; }
      .lista-autocompletar {
        position: absolute; top: 100%; left: 0; right: 0;
        background: var(--color-superficie); border: 1px solid var(--color-borde);
        border-radius: var(--radio-sm); box-shadow: var(--sombra-menu);
        max-height: 220px; overflow-y: auto; z-index: 10;
      }
      .opcion-lista { padding: var(--espacio-3); cursor: pointer; font-size: var(--texto-sm); }
      .opcion-lista:hover { background: var(--color-superficie-hover); }
      .opcion-lista-sub { color: var(--color-texto-suave); font-size: var(--texto-xs); }
      .input-cantidad-item { width: 64px; padding: var(--espacio-1); border: 1px solid var(--color-borde); border-radius: var(--radio-sm); }
      .resumen-totales {
        margin-top: var(--espacio-4); padding: var(--espacio-4);
        background: var(--color-fondo); border-radius: var(--radio-sm);
      }
      .resumen-totales > div { display: flex; justify-content: space-between; padding: var(--espacio-1) 0; font-size: var(--texto-sm); color: var(--color-texto-suave); }
      .resumen-total-final { font-weight: 700; color: var(--color-texto) !important; font-size: var(--texto-md) !important; border-top: 1px solid var(--color-borde); margin-top: var(--espacio-2); padding-top: var(--espacio-3) !important; }
    </style>
  `;
  document.body.appendChild(fondo);

  // --- Autocompletado de cliente ---
  const inputCliente = fondo.querySelector("#campo-buscar-cliente-factura");
  const resultadosCliente = fondo.querySelector("#resultados-cliente-factura");

  inputCliente.addEventListener("input", () => {
    clienteSeleccionado = null;
    const termino = normalizarBusqueda(inputCliente.value);
    if (!termino) { resultadosCliente.hidden = true; return; }

    const coincidencias = clientes.filter((c) =>
      normalizarBusqueda(c.nombre).includes(termino) || normalizarBusqueda(c.telefono || "").includes(termino)
    ).slice(0, 8);

    resultadosCliente.innerHTML = coincidencias.length
      ? coincidencias.map((c) => `<div class="opcion-lista" data-id="${c.id}"><div>${c.nombre}</div><div class="opcion-lista-sub">${c.cuitCuit || c.telefono || ""}</div></div>`).join("")
      : `<div class="opcion-lista">Sin coincidencias — se facturará a Consumidor Final.</div>`;
    resultadosCliente.hidden = false;

    resultadosCliente.querySelectorAll(".opcion-lista[data-id]").forEach((opcion) => {
      opcion.addEventListener("click", () => {
        clienteSeleccionado = clientes.find((c) => c.id === opcion.dataset.id);
        inputCliente.value = clienteSeleccionado.nombre;
        resultadosCliente.hidden = true;
      });
    });
  });

  // --- Autocompletado de producto + ítems ---
  const inputProducto = fondo.querySelector("#campo-buscar-producto");
  const resultadosProducto = fondo.querySelector("#resultados-producto");
  const cuerpoItems = fondo.querySelector("#cuerpo-items-factura");

  inputProducto.addEventListener("input", () => {
    const termino = normalizarBusqueda(inputProducto.value);
    if (!termino) { resultadosProducto.hidden = true; return; }

    const coincidencias = productos.filter((p) =>
      normalizarBusqueda(p.nombre).includes(termino) || normalizarBusqueda(p.codigo || "").includes(termino)
    ).slice(0, 8);

    resultadosProducto.innerHTML = coincidencias.length
      ? coincidencias.map((p) => `<div class="opcion-lista" data-id="${p.id}"><div>${p.nombre}</div><div class="opcion-lista-sub">${p.codigo || ""}</div></div>`).join("")
      : `<div class="opcion-lista">Sin coincidencias.</div>`;
    resultadosProducto.hidden = false;

    resultadosProducto.querySelectorAll(".opcion-lista[data-id]").forEach(async (opcion) => {
      opcion.addEventListener("click", async () => {
        const producto = productos.find((p) => p.id === opcion.dataset.id);
        const stock = await obtenerStockProducto(producto.id, empresaId);

        if (!stock || stock.cantidad <= 0) {
          mostrarError(`"${producto.nombre}" no tiene stock disponible en esta empresa.`);
          resultadosProducto.hidden = true;
          inputProducto.value = "";
          return;
        }

        agregarItem({
          productoId: producto.id,
          nombreCache: producto.nombre,
          cantidad: 1,
          precioUnitario: stock.precioVenta || 0,
          ivaPorcentaje: IVA_PORCENTAJE_DEFECTO,
          stockDisponible: stock.cantidad
        });

        inputProducto.value = "";
        resultadosProducto.hidden = true;
      });
    });
  });

  function agregarItem(item) {
    const existente = items.find((i) => i.productoId === item.productoId);
    if (existente) {
      existente.cantidad += 1;
    } else {
      items.push(item);
    }
    pintarItems();
  }

  function pintarItems() {
    if (items.length === 0) {
      cuerpoItems.innerHTML = `<tr><td colspan="5"><p class="estado-vacio">Todavía no agregaste productos.</p></td></tr>`;
      actualizarTotales();
      return;
    }

    cuerpoItems.innerHTML = items.map((item, i) => `
      <tr>
        <td>${item.nombreCache}</td>
        <td><input type="number" class="input-cantidad-item" min="1" max="${item.stockDisponible}" value="${item.cantidad}" data-i="${i}" /></td>
        <td class="numerico">${formatearMoneda(item.precioUnitario)}</td>
        <td class="numerico">${formatearMoneda(item.cantidad * item.precioUnitario)}</td>
        <td><button class="btn-icono" data-quitar="${i}">✕</button></td>
      </tr>
    `).join("");

    cuerpoItems.querySelectorAll(".input-cantidad-item").forEach((input) => {
      input.addEventListener("change", (evento) => {
        const i = Number(evento.target.dataset.i);
        const nuevaCantidad = Number(evento.target.value);
        if (nuevaCantidad > items[i].stockDisponible) {
          mostrarError(`Stock disponible: ${items[i].stockDisponible}.`);
          evento.target.value = items[i].stockDisponible;
          items[i].cantidad = items[i].stockDisponible;
        } else {
          items[i].cantidad = Math.max(1, nuevaCantidad);
        }
        pintarItems();
      });
    });

    cuerpoItems.querySelectorAll("[data-quitar]").forEach((boton) => {
      boton.addEventListener("click", () => {
        items.splice(Number(boton.dataset.quitar), 1);
        pintarItems();
      });
    });

    actualizarTotales();
  }

  function actualizarTotales() {
    const subtotal = items.reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0);
    const iva = subtotal * (IVA_PORCENTAJE_DEFECTO / 100);
    fondo.querySelector("#texto-subtotal").textContent = formatearMoneda(subtotal);
    fondo.querySelector("#texto-iva").textContent = formatearMoneda(iva);
    fondo.querySelector("#texto-total").textContent = formatearMoneda(subtotal + iva);
  }

  // --- Cerrar / Guardar ---
  const cerrar = () => fondo.remove();
  fondo.querySelector("#cerrar-modal-factura").addEventListener("click", cerrar);
  fondo.querySelector("#cancelar-modal-factura").addEventListener("click", cerrar);

  fondo.querySelector("#guardar-modal-factura").addEventListener("click", () => {
    if (items.length === 0) {
      mostrarError("Agregá al menos un producto.");
      return;
    }

    const subtotal = items.reduce((acc, i) => acc + i.cantidad * i.precioUnitario, 0);
    const iva = subtotal * (IVA_PORCENTAJE_DEFECTO / 100);

    alGuardar({
      tipo: fondo.querySelector("#campo-tipo").value,
      facturaTipo: fondo.querySelector("#campo-factura-tipo").value || null,
      formaPago: fondo.querySelector("#campo-forma-pago").value,
      clienteId: clienteSeleccionado?.id || null,
      clienteNombreCache: clienteSeleccionado?.nombre || "Consumidor Final",
      clienteCuitCache: clienteSeleccionado?.cuitCuit || null,
      items: items.map(({ stockDisponible, ...item }) => ({
        ...item,
        subtotal: item.cantidad * item.precioUnitario
      })),
      subtotal,
      iva,
      total: subtotal + iva,
      observaciones: fondo.querySelector("#campo-observaciones-factura").value.trim()
    });
    cerrar();
  });
}
