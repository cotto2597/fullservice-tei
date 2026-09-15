// Vista Inicio: panel resumen con lo más relevante del día a día.
// No existía en el sistema anterior — se agrega porque el Manual de
// Kaizek pide que la información importante esté disponible de un
// vistazo (Cap. 16), y reduce la necesidad de entrar a cada sección
// solo para chequear el estado general del negocio.

import { listarReparaciones, listarProductos, obtenerStockProducto } from "../services/datos.js";
import { EMPRESAS } from "../config.js";

export async function renderizarInicio(contenedor, sesion) {
  const empresaId = sesion.empresaActiva;

  const reparacionesPendientes = await listarReparaciones(empresaId, ["pendiente", "en_proceso"]);

  contenedor.innerHTML = `
    <div class="grid-resumen">
      <div class="superficie tarjeta-resumen">
        <span class="tarjeta-resumen-etiqueta">Reparaciones activas</span>
        <span class="tarjeta-resumen-valor">${reparacionesPendientes.length}</span>
      </div>
      <div class="superficie tarjeta-resumen">
        <span class="tarjeta-resumen-etiqueta">Empresa activa</span>
        <span class="tarjeta-resumen-valor tarjeta-resumen-valor-texto">${EMPRESAS[empresaId]?.nombre || "—"}</span>
      </div>
    </div>

    <div class="superficie" style="margin-top: var(--espacio-5); padding: var(--espacio-5);">
      <h3 style="margin-bottom: var(--espacio-4);">Reparaciones pendientes recientes</h3>
      <div id="lista-reparaciones-inicio"></div>
    </div>

    <style>
      .grid-resumen {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        gap: var(--espacio-4);
      }
      .tarjeta-resumen {
        padding: var(--espacio-5);
        display: flex;
        flex-direction: column;
        gap: var(--espacio-2);
      }
      .tarjeta-resumen-etiqueta {
        font-size: var(--texto-sm);
        color: var(--color-texto-suave);
      }
      .tarjeta-resumen-valor {
        font-size: var(--texto-xl);
        font-weight: 700;
        color: var(--color-acento);
      }
      .tarjeta-resumen-valor-texto {
        font-size: var(--texto-md);
        color: var(--color-texto);
      }
    </style>
  `;

  const listaContenedor = contenedor.querySelector("#lista-reparaciones-inicio");

  if (reparacionesPendientes.length === 0) {
    listaContenedor.innerHTML = `<p class="estado-vacio">No hay reparaciones pendientes en este momento.</p>`;
    return;
  }

  listaContenedor.innerHTML = `
    <table class="tabla">
      <thead>
        <tr><th>Cliente</th><th>Equipo</th><th>Estado</th></tr>
      </thead>
      <tbody>
        ${reparacionesPendientes.slice(0, 8).map((r) => `
          <tr>
            <td>${r.clienteNombreCache || "—"}</td>
            <td>${r.equipo || "—"}</td>
            <td><span class="badge estado-${r.estado}">${r.estado.replace("_", " ")}</span></td>
          </tr>
        `).join("")}
      </tbody>
    </table>
  `;
}
