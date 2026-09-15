// Vista Productos: catálogo compartido entre ambas empresas, con
// stock y precio propios de la empresa activa (ver docs/modelo-datos.md).

import { listarProductos, listarCategorias, obtenerStockProducto, crearProducto } from "../services/datos.js";
import { formatearMoneda, normalizarBusqueda, mostrarExito, mostrarError } from "../utils.js";
import { EMPRESAS } from "../config.js";

export async function renderizarProductos(contenedor, sesion) {
  const empresaId = sesion.empresaActiva;
  const [productos, categorias] = await Promise.all([listarProductos(), listarCategorias()]);

  // Resolvemos el stock de la empresa activa para cada producto.
  // (Para catálogos muy grandes esto se podría paginar; ver nota al final del módulo.)
  const stockPorProducto = {};
  await Promise.all(
    productos.map(async (p) => {
      stockPorProducto[p.id] = await obtenerStockProducto(p.id, empresaId);
    })
  );

  contenedor.innerHTML = `
    <div class="barra-acciones">
      <input type="search" id="buscador-productos" placeholder="Buscar por nombre o código..." class="input-busqueda" />
      <select id="filtro-categoria">
        <option value="">Todas las categorías</option>
        ${categorias.map((c) => `<option value="${c.id}">${c.nombre}</option>`).join("")}
      </select>
      <button id="boton-nuevo-producto" class="btn btn-primario">+ Nuevo producto</button>
    </div>

    <div class="superficie tabla-envoltorio" style="margin-top: var(--espacio-4);">
      <table class="tabla">
        <thead>
          <tr>
            <th>Código</th><th>Nombre</th><th>Marca</th><th>Categoría</th>
            <th>Stock (${EMPRESAS[empresaId]?.nombre})</th><th>Precio venta</th>
          </tr>
        </thead>
        <tbody id="cuerpo-tabla-productos"></tbody>
      </table>
    </div>

    <style>
      .barra-acciones {
        display: flex;
        gap: var(--espacio-3);
        flex-wrap: wrap;
      }
      .input-busqueda {
        flex: 1;
        min-width: 220px;
        padding: var(--espacio-3);
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-sm);
      }
      #filtro-categoria {
        padding: var(--espacio-3);
        border: 1px solid var(--color-borde);
        border-radius: var(--radio-sm);
      }
    </style>
  `;

  function pintarFilas(lista) {
    const cuerpo = contenedor.querySelector("#cuerpo-tabla-productos");

    if (lista.length === 0) {
      cuerpo.innerHTML = `<tr><td colspan="6"><p class="estado-vacio">No se encontraron productos.</p></td></tr>`;
      return;
    }

    cuerpo.innerHTML = lista.map((p) => {
      const stock = stockPorProducto[p.id];
      const categoria = categorias.find((c) => c.id === p.categoriaId);
      return `
        <tr>
          <td>${p.codigo || "—"}</td>
          <td>${p.nombre}</td>
          <td>${p.marca || "—"}</td>
          <td>${categoria?.nombre || "—"}</td>
          <td class="numerico">${stock ? stock.cantidad : "—"}</td>
          <td class="numerico">${stock ? formatearMoneda(stock.precioVenta) : "—"}</td>
        </tr>
      `;
    }).join("");
  }

  pintarFilas(productos);

  // Búsqueda y filtro en memoria — el catálogo ya está cargado.
  function aplicarFiltros() {
    const termino = normalizarBusqueda(contenedor.querySelector("#buscador-productos").value);
    const categoriaId = contenedor.querySelector("#filtro-categoria").value;

    const filtrados = productos.filter((p) => {
      const coincideTexto = !termino ||
        normalizarBusqueda(p.nombre).includes(termino) ||
        normalizarBusqueda(p.codigo || "").includes(termino);
      const coincideCategoria = !categoriaId || p.categoriaId === categoriaId;
      return coincideTexto && coincideCategoria;
    });

    pintarFilas(filtrados);
  }

  contenedor.querySelector("#buscador-productos").addEventListener("input", aplicarFiltros);
  contenedor.querySelector("#filtro-categoria").addEventListener("change", aplicarFiltros);

  contenedor.querySelector("#boton-nuevo-producto").addEventListener("click", () => {
    abrirModalNuevoProducto(categorias, async (datos) => {
      try {
        await crearProducto(datos);
        mostrarExito("Producto creado correctamente.");
        renderizarProductos(contenedor, sesion); // recarga simple de la vista
      } catch (error) {
        console.error(error);
        mostrarError("No se pudo crear el producto.");
      }
    });
  });
}

function abrirModalNuevoProducto(categorias, alGuardar) {
  const fondo = document.createElement("div");
  fondo.className = "modal-fondo";
  fondo.innerHTML = `
    <div class="modal">
      <div class="modal-header">
        <h3>Nuevo producto</h3>
        <button class="btn-icono" id="cerrar-modal-producto">✕</button>
      </div>
      <div class="modal-body">
        <div class="campo">
          <label>Nombre</label>
          <input type="text" id="campo-nombre" required />
        </div>
        <div class="fila-campos">
          <div class="campo">
            <label>Código</label>
            <input type="text" id="campo-codigo" />
          </div>
          <div class="campo">
            <label>Marca</label>
            <input type="text" id="campo-marca" />
          </div>
        </div>
        <div class="campo">
          <label>Categoría</label>
          <select id="campo-categoria">
            <option value="">Sin categoría</option>
            ${categorias.map((c) => `<option value="${c.id}">${c.nombre}</option>`).join("")}
          </select>
        </div>
        <div class="campo">
          <label>Descripción</label>
          <textarea id="campo-descripcion" rows="2"></textarea>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-secundario" id="cancelar-modal-producto">Cancelar</button>
        <button class="btn btn-primario" id="guardar-modal-producto">Guardar</button>
      </div>
    </div>
  `;
  document.body.appendChild(fondo);

  const cerrar = () => fondo.remove();
  fondo.querySelector("#cerrar-modal-producto").addEventListener("click", cerrar);
  fondo.querySelector("#cancelar-modal-producto").addEventListener("click", cerrar);

  fondo.querySelector("#guardar-modal-producto").addEventListener("click", () => {
    const nombre = fondo.querySelector("#campo-nombre").value.trim();
    if (!nombre) {
      mostrarError("El nombre es obligatorio.");
      return;
    }
    alGuardar({
      nombre,
      codigo: fondo.querySelector("#campo-codigo").value.trim(),
      marca: fondo.querySelector("#campo-marca").value.trim(),
      categoriaId: fondo.querySelector("#campo-categoria").value || null,
      descripcion: fondo.querySelector("#campo-descripcion").value.trim(),
      activoWeb: true
    });
    cerrar();
  });
}

// NOTA para etapas futuras: si el catálogo crece mucho (100+ productos como
// en el sistema viejo), conviene paginar la tabla y resolver el stock bajo
// demanda en vez de precargarlo todo — lo dejamos simple por ahora porque
// todavía no hay datos reales migrados.
