// Vista Reparaciones: sub-tabs "En proceso" / "Entregadas", listado y
// formulario de nuevo ingreso con autocompletado de cliente existente.
// Ver docs/modelo-datos.md, colección reparaciones.

import { listarReparaciones, listarClientes, crearReparacion, actualizarEstadoReparacion, crearCliente } from "../services/datos.js";
import { formatearMoneda, formatearFecha, normalizarBusqueda, mostrarExito, mostrarError } from "../utils.js";
import { ESTADOS_REPARACION } from "../config.js";

const TABS = {
  en_proceso: { titulo: "En proceso", estados: ["pendiente", "en_proceso"] },
  entregadas: { titulo: "Entregadas", estados: ["terminado", "entregado"] }
};

export async function renderizarReparaciones(contenedor, sesion) {
  const empresaId = sesion.empresaActiva;
  let tabActiva = "en_proceso";

  contenedor.innerHTML = `
    <div class="barra-acciones">
      <div class="tabs-reparaciones">
        <button class="tab-boton activo" data-tab="en_proceso">En proceso</button>
        <button class="tab-boton" data-tab="entregadas">Entregadas</button>
      </div>
      <button id="boton-nueva-reparacion" class="btn btn-primario">+ Nuevo ingreso</button>
    </div>

    <div class="superficie tabla-envoltorio" style="margin-top: var(--espacio-4);">
      <table class="tabla">
        <thead>
          <tr>
            <th>Nro</th><th>Ingreso</th><th>Cliente</th><th>Equipo</th>
            <th>Teléfono</th><th>Estado</th><th>Presupuesto</th><th></th>
          </tr>
        </thead>
        <tbody id="cuerpo-tabla-reparaciones"></tbody>
      </table>
    </div>

    <style>
      .tabs-reparaciones { display: flex; gap: var(--espacio-2); }
      .tab-boton {
        padding: var(--espacio-2) var(--espacio-4);
        border-radius: var(--radio-sm);
        border: 1px solid var(--color-borde);
        background: var(--color-superficie);
        color: var(--color-texto-suave);
        font-size: var(--texto-sm);
        font-weight: 600;
      }
      .tab-boton.activo {
        background: var(--color-acento);
        color: #fff;
        border-color: var(--color-acento);
      }
    </style>
  `;

  const botonesTab = contenedor.querySelectorAll(".tab-boton");
  const botonNuevo = contenedor.querySelector("#boton-nueva-reparacion");

  async function cargarTab(nombreTab) {
    tabActiva = nombreTab;
    botonesTab.forEach((b) => b.classList.toggle("activo", b.dataset.tab === nombreTab));

    const cuerpo = contenedor.querySelector("#cuerpo-tabla-reparaciones");
    cuerpo.innerHTML = `<tr><td colspan="8"><div class="loader"></div></td></tr>`;

    const reparaciones = await listarReparaciones(empresaId, TABS[nombreTab].estados);
    pintarFilas(reparaciones, cuerpo);
  }

  function pintarFilas(lista, cuerpo) {
    if (lista.length === 0) {
      cuerpo.innerHTML = `<tr><td colspan="8"><p class="estado-vacio">No hay reparaciones en esta sección.</p></td></tr>`;
      return;
    }

    cuerpo.innerHTML = lista.map((r) => {
      const estadoInfo = ESTADOS_REPARACION[r.estado] || { label: r.estado, color: "" };
      const fecha = r.fechaIngreso
        ? formatearFecha(r.fechaIngreso.toDate ? r.fechaIngreso.toDate() : r.fechaIngreso)
        : "—";
      return `
        <tr>
          <td class="numerico">${r.numero ?? "—"}</td>
          <td>${fecha}</td>
          <td>${r.clienteNombreCache || "—"}</td>
          <td>${r.equipo || "—"}${r.marca ? ` (${r.marca})` : ""}</td>
          <td>${r.clienteTelefonoCache || "—"}</td>
          <td><span class="badge ${estadoInfo.color}">${estadoInfo.label}</span></td>
          <td class="numerico">${r.presupuesto ? formatearMoneda(r.presupuesto) : "—"}</td>
          <td>
            <select class="selector-estado-reparacion" data-id="${r.id}">
              ${Object.entries(ESTADOS_REPARACION).map(([valor, info]) =>
                `<option value="${valor}" ${valor === r.estado ? "selected" : ""}>${info.label}</option>`
              ).join("")}
            </select>
          </td>
        </tr>
      `;
    }).join("");

    cuerpo.querySelectorAll(".selector-estado-reparacion").forEach((select) => {
      select.addEventListener("change", async (evento) => {
        try {
          await actualizarEstadoReparacion(evento.target.dataset.id, evento.target.value);
          mostrarExito("Estado actualizado.");
          cargarTab(tabActiva);
        } catch (error) {
          console.error(error);
          mostrarError("No se pudo actualizar el estado.");
        }
      });
    });
  }

  botonesTab.forEach((boton) => {
    boton.addEventListener("click", () => cargarTab(boton.dataset.tab));
  });

  botonNuevo.addEventListener("click", async () => {
    const clientes = await listarClientes();
    abrirModalNuevaReparacion(clientes, async (datos) => {
      try {
        await crearReparacion(empresaId, datos);
        mostrarExito("Reparación ingresada correctamente.");
        cargarTab("en_proceso");
      } catch (error) {
        console.error(error);
        mostrarError("No se pudo ingresar la reparación.");
      }
    });
  });

  cargarTab(tabActiva);
}

function abrirModalNuevaReparacion(clientes, alGuardar) {
  let clienteSeleccionado = null;

  const fondo = document.createElement("div");
  fondo.className = "modal-fondo";
  fondo.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Nuevo ingreso de reparación</h3>
        <button class="btn-icono" id="cerrar-modal-reparacion">✕</button>
      </div>
      <div class="modal-body">
        <div class="campo" style="position: relative;">
          <label>Cliente</label>
          <input type="text" id="campo-buscar-cliente" placeholder="Buscar por nombre o teléfono..." autocomplete="off" />
          <div id="resultados-cliente" class="lista-autocompletar" hidden></div>
          <p id="cliente-confirmado" class="texto-cliente-confirmado" hidden></p>
        </div>

        <div class="fila-campos">
          <div class="campo">
            <label>Equipo</label>
            <input type="text" id="campo-equipo" placeholder="Ej: Notebook, Impresora..." required />
          </div>
          <div class="campo">
            <label>Marca</label>
            <input type="text" id="campo-marca" />
          </div>
        </div>
        <div class="fila-campos">
          <div class="campo">
            <label>Modelo</label>
            <input type="text" id="campo-modelo" />
          </div>
          <div class="campo">
            <label>Nro de serie</label>
            <input type="text" id="campo-serie" />
          </div>
        </div>
        <div class="campo">
          <label>Presupuesto</label>
          <input type="number" id="campo-presupuesto" min="0" step="0.01" />
        </div>
        <div class="campo">
          <label>Observaciones</label>
          <textarea id="campo-observaciones" rows="2"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secundario" id="cancelar-modal-reparacion">Cancelar</button>
        <button class="btn btn-primario" id="guardar-modal-reparacion">Guardar ingreso</button>
      </div>
    </div>

    <style>
      .lista-autocompletar {
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: var(--color-superficie);
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-sm);
        box-shadow: var(--sombra-menu);
        max-height: 220px;
        overflow-y: auto;
        z-index: 10;
      }
      .opcion-cliente {
        padding: var(--espacio-3);
        cursor: pointer;
        font-size: var(--texto-sm);
      }
      .opcion-cliente:hover {
        background: var(--color-superficie-hover);
      }
      .opcion-cliente-nombre { font-weight: 600; }
      .opcion-cliente-telefono { color: var(--color-texto-suave); font-size: var(--texto-xs); }
      .texto-cliente-confirmado {
        font-size: var(--texto-sm);
        color: var(--color-estado-terminado);
        margin: 0;
      }
    </style>
  `;
  document.body.appendChild(fondo);

  const inputBuscar = fondo.querySelector("#campo-buscar-cliente");
  const listaResultados = fondo.querySelector("#resultados-cliente");
  const textoConfirmado = fondo.querySelector("#cliente-confirmado");

  inputBuscar.addEventListener("input", () => {
    clienteSeleccionado = null;
    textoConfirmado.hidden = true;

    const termino = normalizarBusqueda(inputBuscar.value);
    if (!termino) {
      listaResultados.hidden = true;
      return;
    }

    const coincidencias = clientes.filter((c) =>
      normalizarBusqueda(c.nombre).includes(termino) ||
      normalizarBusqueda(c.telefono || "").includes(termino)
    ).slice(0, 8);

    if (coincidencias.length === 0) {
      listaResultados.innerHTML = `<div class="opcion-cliente">Sin coincidencias. Se creará un cliente nuevo con este nombre.</div>`;
    } else {
      listaResultados.innerHTML = coincidencias.map((c) => `
        <div class="opcion-cliente" data-id="${c.id}">
          <div class="opcion-cliente-nombre">${c.nombre}</div>
          <div class="opcion-cliente-telefono">${c.telefono || "sin teléfono"}</div>
        </div>
      `).join("");
    }
    listaResultados.hidden = false;

    listaResultados.querySelectorAll(".opcion-cliente[data-id]").forEach((opcion) => {
      opcion.addEventListener("click", () => {
        const cliente = clientes.find((c) => c.id === opcion.dataset.id);
        clienteSeleccionado = cliente;
        inputBuscar.value = cliente.nombre;
        textoConfirmado.textContent = `Cliente seleccionado: ${cliente.nombre} — ${cliente.telefono || "sin teléfono"}`;
        textoConfirmado.hidden = false;
        listaResultados.hidden = true;
      });
    });
  });

  document.addEventListener("click", function cerrarAlHacerClickAfuera(evento) {
    if (!fondo.contains(evento.target)) return;
    if (!evento.target.closest("#campo-buscar-cliente") && !evento.target.closest("#resultados-cliente")) {
      listaResultados.hidden = true;
    }
  });

  const cerrar = () => fondo.remove();
  fondo.querySelector("#cerrar-modal-reparacion").addEventListener("click", cerrar);
  fondo.querySelector("#cancelar-modal-reparacion").addEventListener("click", cerrar);

  fondo.querySelector("#guardar-modal-reparacion").addEventListener("click", async () => {
    const nombreEscrito = inputBuscar.value.trim();
    const equipo = fondo.querySelector("#campo-equipo").value.trim();

    if (!nombreEscrito) {
      mostrarError("Ingresá o seleccioná un cliente.");
      return;
    }
    if (!equipo) {
      mostrarError("El equipo es obligatorio.");
      return;
    }

    let clienteId, clienteNombreCache, clienteTelefonoCache;

    if (clienteSeleccionado) {
      clienteId = clienteSeleccionado.id;
      clienteNombreCache = clienteSeleccionado.nombre;
      clienteTelefonoCache = clienteSeleccionado.telefono || "";
    } else {
      // No se seleccionó un cliente existente de la lista: se crea uno
      // nuevo al vuelo con el nombre escrito, como se acordó, para no
      // frenar el ingreso de la reparación por no tener el cliente cargado.
      try {
        const nuevoClienteRef = await crearCliente({ nombre: nombreEscrito, telefono: "" });
        clienteId = nuevoClienteRef.id;
        clienteNombreCache = nombreEscrito;
        clienteTelefonoCache = "";
      } catch (error) {
        console.error(error);
        mostrarError("No se pudo crear el cliente.");
        return;
      }
    }

    alGuardar({
      clienteId,
      clienteNombreCache,
      clienteTelefonoCache,
      equipo,
      marca: fondo.querySelector("#campo-marca").value.trim(),
      modelo: fondo.querySelector("#campo-modelo").value.trim(),
      numeroSerie: fondo.querySelector("#campo-serie").value.trim(),
      presupuesto: Number(fondo.querySelector("#campo-presupuesto").value) || 0,
      observaciones: fondo.querySelector("#campo-observaciones").value.trim(),
      fechaIngreso: new Date()
    });
    cerrar();
  });
}
