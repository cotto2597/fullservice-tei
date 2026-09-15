// Vista Configuración: Perfil / Usuarios / Clientes / Proveedores.
// Nota: la sección "Recargas" del sistema anterior quedó obsoleta y no
// se migra (decisión de Corcho).

import {
  obtenerEmpresa, actualizarEmpresa,
  listarUsuarios, crearUsuario, actualizarUsuario,
  listarClientes, crearCliente, actualizarCliente,
  listarProveedores, crearProveedor, actualizarProveedor
} from "../services/datos.js";
import { mostrarExito, mostrarError } from "../utils.js";
import { EMPRESAS, ROLES } from "../config.js";

const TABS = {
  perfil: { titulo: "Perfil", render: renderizarPerfil },
  usuarios: { titulo: "Usuarios", render: renderizarUsuarios },
  clientes: { titulo: "Clientes", render: renderizarClientes },
  proveedores: { titulo: "Proveedores", render: renderizarProveedores }
};

export async function renderizarConfiguracion(contenedor, sesion) {
  contenedor.innerHTML = `
    <div class="tabs-config">
      ${Object.entries(TABS).map(([clave, tab], i) =>
        `<button class="tab-boton ${i === 0 ? "activo" : ""}" data-tab="${clave}">${tab.titulo}</button>`
      ).join("")}
    </div>
    <div id="panel-config" style="margin-top: var(--espacio-4);"></div>

    <style>
      .tabs-config { display: flex; gap: var(--espacio-2); flex-wrap: wrap; }
      .tab-boton {
        padding: var(--espacio-2) var(--espacio-4);
        border-radius: var(--radio-sm);
        border: 1px solid var(--color-borde);
        background: var(--color-superficie);
        color: var(--color-texto-suave);
        font-size: var(--texto-sm);
        font-weight: 600;
      }
      .tab-boton.activo { background: var(--color-acento); color: #fff; border-color: var(--color-acento); }
    </style>
  `;

  const botones = contenedor.querySelectorAll(".tab-boton");
  const panel = contenedor.querySelector("#panel-config");

  function irATab(clave) {
    botones.forEach((b) => b.classList.toggle("activo", b.dataset.tab === clave));
    panel.innerHTML = `<div class="loader"></div>`;
    TABS[clave].render(panel, sesion);
  }

  botones.forEach((boton) => boton.addEventListener("click", () => irATab(boton.dataset.tab)));

  irATab("perfil");
}

// ===================== PERFIL =====================

async function renderizarPerfil(panel, sesion) {
  const empresaId = sesion.empresaActiva;
  const empresa = await obtenerEmpresa(empresaId);

  panel.innerHTML = `
    <div class="superficie" style="padding: var(--espacio-5); max-width: 560px;">
      <h3 style="margin-bottom: var(--espacio-4);">${EMPRESAS[empresaId]?.nombre || empresaId}</h3>
      <div class="fila-campos">
        <div class="campo"><label>Nombre</label><input id="p-nombre" value="${empresa?.nombre || ""}" /></div>
        <div class="campo"><label>Teléfono</label><input id="p-telefono" value="${empresa?.telefono || ""}" /></div>
      </div>
      <div class="campo"><label>Email</label><input id="p-email" type="email" value="${empresa?.email || ""}" /></div>
      <div class="campo"><label>Dirección</label><input id="p-direccion" value="${empresa?.direccion || ""}" /></div>
      <div class="fila-campos">
        <div class="campo"><label>Ciudad</label><input id="p-ciudad" value="${empresa?.ciudad || ""}" /></div>
        <div class="campo"><label>Región/Provincia</label><input id="p-region" value="${empresa?.region || ""}" /></div>
        <div class="campo"><label>Código postal</label><input id="p-cp" value="${empresa?.codigoPostal || ""}" /></div>
      </div>
      <div class="fila-campos">
        <div class="campo"><label>IVA (%)</label><input id="p-iva" type="number" value="${empresa?.ivaPorcentaje ?? 21}" /></div>
        <div class="campo"><label>Símbolo de moneda</label><input id="p-moneda" value="${empresa?.monedaSimbolo || "$"}" /></div>
      </div>
      <button id="guardar-perfil" class="btn btn-primario">Guardar cambios</button>
    </div>
  `;

  panel.querySelector("#guardar-perfil").addEventListener("click", async () => {
    try {
      await actualizarEmpresa(empresaId, {
        nombre: panel.querySelector("#p-nombre").value.trim(),
        telefono: panel.querySelector("#p-telefono").value.trim(),
        email: panel.querySelector("#p-email").value.trim(),
        direccion: panel.querySelector("#p-direccion").value.trim(),
        ciudad: panel.querySelector("#p-ciudad").value.trim(),
        region: panel.querySelector("#p-region").value.trim(),
        codigoPostal: panel.querySelector("#p-cp").value.trim(),
        ivaPorcentaje: Number(panel.querySelector("#p-iva").value) || 0,
        monedaSimbolo: panel.querySelector("#p-moneda").value.trim() || "$"
      });
      mostrarExito("Perfil actualizado.");
    } catch (error) {
      console.error(error);
      mostrarError("No se pudo guardar el perfil.");
    }
  });
}

// ===================== USUARIOS =====================

async function renderizarUsuarios(panel, sesion) {
  const usuarios = await listarUsuarios();

  panel.innerHTML = `
    <div class="barra-acciones">
      <button id="boton-nuevo-usuario" class="btn btn-primario">+ Nuevo usuario</button>
    </div>
    <div class="superficie tabla-envoltorio" style="margin-top: var(--espacio-4);">
      <table class="tabla">
        <thead><tr><th>Nombre</th><th>Email</th><th>Empresas</th><th>Rol</th><th>Estado</th></tr></thead>
        <tbody id="cuerpo-usuarios"></tbody>
      </table>
    </div>
  `;

  function pintar() {
    const cuerpo = panel.querySelector("#cuerpo-usuarios");
    cuerpo.innerHTML = usuarios.map((u) => `
      <tr>
        <td>${u.nombre}</td>
        <td>${u.email}</td>
        <td>${(u.empresas || []).map((e) => EMPRESAS[e]?.nombre || e).join(", ")}</td>
        <td>${ROLES[u.rol] || u.rol}</td>
        <td>
          <select class="selector-estado-usuario" data-id="${u.id}">
            <option value="true" ${u.activo ? "selected" : ""}>Activo</option>
            <option value="false" ${!u.activo ? "selected" : ""}>Inactivo</option>
          </select>
        </td>
      </tr>
    `).join("");

    cuerpo.querySelectorAll(".selector-estado-usuario").forEach((select) => {
      select.addEventListener("change", async (evento) => {
        try {
          await actualizarUsuario(evento.target.dataset.id, { activo: evento.target.value === "true" });
          mostrarExito("Estado actualizado.");
        } catch (error) {
          console.error(error);
          mostrarError("No se pudo actualizar el estado.");
        }
      });
    });
  }

  pintar();

  panel.querySelector("#boton-nuevo-usuario").addEventListener("click", () => {
    abrirModalNuevoUsuario(async (datos) => {
      try {
        await crearUsuario(datos);
        mostrarExito("Usuario creado correctamente.");
        renderizarUsuarios(panel, sesion);
      } catch (error) {
        console.error(error);
        mostrarError(error.message || "No se pudo crear el usuario.");
      }
    });
  });
}

function abrirModalNuevoUsuario(alGuardar) {
  const fondo = document.createElement("div");
  fondo.className = "modal-fondo";
  fondo.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3>Nuevo usuario</h3><button class="btn-icono" id="cerrar-modal-usuario">✕</button></div>
      <div class="modal-body">
        <div class="campo"><label>Nombre</label><input id="u-nombre" /></div>
        <div class="campo"><label>Email</label><input id="u-email" type="email" /></div>
        <div class="campo"><label>Contraseña provisoria</label><input id="u-contrasena" type="password" minlength="6" /></div>
        <div class="campo">
          <label>Empresas con acceso</label>
          <div>
            <label style="font-weight: 400; display:inline-flex; align-items:center; gap:4px; margin-right: var(--espacio-4);">
              <input type="checkbox" id="u-emp-fullservice" value="fullservice" checked /> Full Service
            </label>
            <label style="font-weight: 400; display:inline-flex; align-items:center; gap:4px;">
              <input type="checkbox" id="u-emp-tei" value="tei" /> Tecnologías e Insumos
            </label>
          </div>
        </div>
        <div class="campo">
          <label>Rol</label>
          <select id="u-rol">
            <option value="operador">Operador</option>
            <option value="administrador">Administrador</option>
          </select>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secundario" id="cancelar-modal-usuario">Cancelar</button>
        <button class="btn btn-primario" id="guardar-modal-usuario">Crear usuario</button>
      </div>
    </div>
  `;
  document.body.appendChild(fondo);

  const cerrar = () => fondo.remove();
  fondo.querySelector("#cerrar-modal-usuario").addEventListener("click", cerrar);
  fondo.querySelector("#cancelar-modal-usuario").addEventListener("click", cerrar);

  fondo.querySelector("#guardar-modal-usuario").addEventListener("click", () => {
    const nombre = fondo.querySelector("#u-nombre").value.trim();
    const email = fondo.querySelector("#u-email").value.trim();
    const contrasena = fondo.querySelector("#u-contrasena").value;

    const empresas = [];
    if (fondo.querySelector("#u-emp-fullservice").checked) empresas.push("fullservice");
    if (fondo.querySelector("#u-emp-tei").checked) empresas.push("tei");

    if (!nombre || !email || contrasena.length < 6) {
      mostrarError("Completá nombre, email y una contraseña de al menos 6 caracteres.");
      return;
    }
    if (empresas.length === 0) {
      mostrarError("Seleccioná al menos una empresa.");
      return;
    }

    alGuardar({
      nombre, email, contrasena, empresas,
      empresaPorDefecto: empresas[0],
      rol: fondo.querySelector("#u-rol").value
    });
    cerrar();
  });
}

// ===================== CLIENTES =====================

async function renderizarClientes(panel, sesion) {
  const clientes = await listarClientes();

  panel.innerHTML = `
    <div class="barra-acciones">
      <input type="search" id="buscar-cliente-config" placeholder="Buscar cliente..." class="input-busqueda" />
      <button id="boton-nuevo-cliente" class="btn btn-primario">+ Nuevo cliente</button>
    </div>
    <div class="superficie tabla-envoltorio" style="margin-top: var(--espacio-4);">
      <table class="tabla">
        <thead><tr><th>Nombre</th><th>Teléfono</th><th>Email</th><th>Dirección</th><th>Estado</th></tr></thead>
        <tbody id="cuerpo-clientes"></tbody>
      </table>
    </div>
    <style>.input-busqueda { flex:1; min-width:220px; padding: var(--espacio-3); border:1px solid var(--color-borde); border-radius: var(--radio-sm); }</style>
  `;

  function pintar(lista) {
    const cuerpo = panel.querySelector("#cuerpo-clientes");
    cuerpo.innerHTML = lista.map((c) => `
      <tr>
        <td>${c.nombre}</td>
        <td>${c.telefono || "—"}</td>
        <td>${c.email || "—"}</td>
        <td>${c.direccion || "—"}</td>
        <td>
          <select class="selector-estado-cliente" data-id="${c.id}">
            <option value="activo" ${c.estado === "activo" ? "selected" : ""}>Activo</option>
            <option value="inactivo" ${c.estado === "inactivo" ? "selected" : ""}>Inactivo</option>
          </select>
        </td>
      </tr>
    `).join("");

    cuerpo.querySelectorAll(".selector-estado-cliente").forEach((select) => {
      select.addEventListener("change", async (evento) => {
        try {
          await actualizarCliente(evento.target.dataset.id, { estado: evento.target.value });
          mostrarExito("Estado actualizado.");
        } catch (error) {
          console.error(error);
          mostrarError("No se pudo actualizar el estado.");
        }
      });
    });
  }

  pintar(clientes);

  panel.querySelector("#buscar-cliente-config").addEventListener("input", (evento) => {
    const termino = evento.target.value.toLowerCase();
    pintar(clientes.filter((c) => c.nombre.toLowerCase().includes(termino)));
  });

  panel.querySelector("#boton-nuevo-cliente").addEventListener("click", () => {
    abrirModalContacto("Nuevo cliente", async (datos) => {
      try {
        await crearCliente(datos);
        mostrarExito("Cliente creado correctamente.");
        renderizarClientes(panel, sesion);
      } catch (error) {
        console.error(error);
        mostrarError("No se pudo crear el cliente.");
      }
    }, { incluirCuit: true });
  });
}

// ===================== PROVEEDORES =====================

async function renderizarProveedores(panel, sesion) {
  const proveedores = await listarProveedores();

  panel.innerHTML = `
    <div class="barra-acciones">
      <button id="boton-nuevo-proveedor" class="btn btn-primario">+ Nuevo proveedor</button>
    </div>
    <div class="superficie tabla-envoltorio" style="margin-top: var(--espacio-4);">
      <table class="tabla">
        <thead><tr><th>Razón social</th><th>Teléfono</th><th>Email</th><th>Dirección</th><th>Estado</th></tr></thead>
        <tbody id="cuerpo-proveedores"></tbody>
      </table>
    </div>
  `;

  function pintar() {
    const cuerpo = panel.querySelector("#cuerpo-proveedores");
    cuerpo.innerHTML = proveedores.map((p) => `
      <tr>
        <td>${p.razonSocial}</td>
        <td>${p.telefono || "—"}</td>
        <td>${p.email || "—"}</td>
        <td>${p.direccion || "—"}</td>
        <td>
          <select class="selector-estado-proveedor" data-id="${p.id}">
            <option value="activo" ${p.estado === "activo" ? "selected" : ""}>Activo</option>
            <option value="inactivo" ${p.estado === "inactivo" ? "selected" : ""}>Inactivo</option>
          </select>
        </td>
      </tr>
    `).join("");

    cuerpo.querySelectorAll(".selector-estado-proveedor").forEach((select) => {
      select.addEventListener("change", async (evento) => {
        try {
          await actualizarProveedor(evento.target.dataset.id, { estado: evento.target.value });
          mostrarExito("Estado actualizado.");
        } catch (error) {
          console.error(error);
          mostrarError("No se pudo actualizar el estado.");
        }
      });
    });
  }

  pintar();

  panel.querySelector("#boton-nuevo-proveedor").addEventListener("click", () => {
    abrirModalContacto("Nuevo proveedor", async (datos) => {
      try {
        await crearProveedor({ razonSocial: datos.nombre, telefono: datos.telefono, email: datos.email, direccion: datos.direccion });
        mostrarExito("Proveedor creado correctamente.");
        renderizarProveedores(panel, sesion);
      } catch (error) {
        console.error(error);
        mostrarError("No se pudo crear el proveedor.");
      }
    }, { etiquetaNombre: "Razón social" });
  });
}

// ===================== Modal genérico Cliente/Proveedor =====================
// Ambos comparten la misma forma (nombre/razón social, teléfono, email,
// dirección) — se reutiliza un único modal en vez de duplicar el markup.

function abrirModalContacto(titulo, alGuardar, opciones = {}) {
  const { incluirCuit = false, etiquetaNombre = "Nombre" } = opciones;

  const fondo = document.createElement("div");
  fondo.className = "modal-fondo";
  fondo.innerHTML = `
    <div class="modal">
      <div class="modal-header"><h3>${titulo}</h3><button class="btn-icono" id="cerrar-modal-contacto">✕</button></div>
      <div class="modal-body">
        <div class="campo"><label>${etiquetaNombre}</label><input id="c-nombre" /></div>
        ${incluirCuit ? `<div class="campo"><label>CUIT/CUIL</label><input id="c-cuit" /></div>` : ""}
        <div class="fila-campos">
          <div class="campo"><label>Teléfono</label><input id="c-telefono" /></div>
          <div class="campo"><label>Email</label><input id="c-email" type="email" /></div>
        </div>
        <div class="campo"><label>Dirección</label><input id="c-direccion" /></div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secundario" id="cancelar-modal-contacto">Cancelar</button>
        <button class="btn btn-primario" id="guardar-modal-contacto">Guardar</button>
      </div>
    </div>
  `;
  document.body.appendChild(fondo);

  const cerrar = () => fondo.remove();
  fondo.querySelector("#cerrar-modal-contacto").addEventListener("click", cerrar);
  fondo.querySelector("#cancelar-modal-contacto").addEventListener("click", cerrar);

  fondo.querySelector("#guardar-modal-contacto").addEventListener("click", () => {
    const nombre = fondo.querySelector("#c-nombre").value.trim();
    if (!nombre) {
      mostrarError(`El campo "${etiquetaNombre}" es obligatorio.`);
      return;
    }

    alGuardar({
      nombre,
      cuitCuit: incluirCuit ? fondo.querySelector("#c-cuit").value.trim() : undefined,
      telefono: fondo.querySelector("#c-telefono").value.trim(),
      email: fondo.querySelector("#c-email").value.trim(),
      direccion: fondo.querySelector("#c-direccion").value.trim()
    });
    cerrar();
  });
}
