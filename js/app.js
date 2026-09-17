// Punto de entrada de la aplicación.
// Responsabilidad única: manejar el login, armar el shell según la sesión
// (empresa activa, rol) y despachar la vista correspondiente al hash.

import { iniciarSesion, cerrarSesion, suscribirCambiosDeSesion, cambiarEmpresaActiva } from "./services/auth.js";
import { EMPRESAS, ROLES } from "./config.js";
import { mostrarError } from "./utils.js";

import { renderizarInicio } from "./modules/inicio.js";
import { renderizarProductos } from "./modules/productos.js";
import { renderizarReparaciones } from "./modules/reparaciones.js";
import { renderizarFacturacion } from "./modules/facturacion.js";
import { renderizarConfiguracion } from "./modules/configuracion.js";

const VISTAS = {
  inicio: { titulo: "Inicio", render: renderizarInicio },
  productos: { titulo: "Productos", render: renderizarProductos },
  reparaciones: { titulo: "Reparaciones", render: renderizarReparaciones },
  facturacion: { titulo: "Facturación", render: renderizarFacturacion },
  configuracion: { titulo: "Configuración", render: renderizarConfiguracion }
};

const pantallaLogin = document.getElementById("pantalla-login");
const appShell = document.getElementById("app-shell");
const formLogin = document.getElementById("form-login");
const loginError = document.getElementById("login-error");

let sesion = null;

// --- Login ---

formLogin.addEventListener("submit", async (evento) => {
  evento.preventDefault();
  loginError.hidden = true;

  const email = document.getElementById("login-email").value.trim();
  const contrasena = document.getElementById("login-contrasena").value;

  const boton = formLogin.querySelector("button[type=submit]");
  boton.disabled = true;
  boton.textContent = "Ingresando...";

  try {
    await iniciarSesion(email, contrasena);
    // El shell se arma solo mediante suscribirCambiosDeSesion.
  } catch (error) {
    loginError.textContent = error.message;
    loginError.hidden = false;
  } finally {
    boton.disabled = false;
    boton.textContent = "Ingresar";
  }
});

document.getElementById("boton-ver-contrasena").addEventListener("click", (evento) => {
  const input = document.getElementById("login-contrasena");
  const boton = evento.currentTarget;
  const seVaAMostrar = input.type === "password";
  input.type = seVaAMostrar ? "text" : "password";
  boton.textContent = seVaAMostrar ? "🙈" : "👁";
  boton.title = seVaAMostrar ? "Ocultar contraseña" : "Mostrar contraseña";
});

document.getElementById("boton-cerrar-sesion").addEventListener("click", async () => {
  await cerrarSesion();
});

// --- Reacciona a cambios de sesión (login/logout) ---

suscribirCambiosDeSesion((perfil) => {
  sesion = perfil;

  if (sesion) {
    pantallaLogin.hidden = true;
    appShell.hidden = false;
    armarShellSegunSesion();
    despacharVistaActual();
  } else {
    appShell.hidden = true;
    pantallaLogin.hidden = false;
    formLogin.reset();
  }
});

// --- Shell: datos de usuario, selector de empresa si aplica ---

function armarShellSegunSesion() {
  document.getElementById("sidebar-usuario-nombre").textContent = sesion.nombre || sesion.email;
  document.getElementById("sidebar-usuario-rol").textContent = ROLES[sesion.rol] || sesion.rol;
  document.getElementById("sidebar-empresa-nombre").textContent =
    EMPRESAS[sesion.empresaActiva]?.nombre || "—";

  const contenedorSelector = document.getElementById("selector-empresa-contenedor");
  contenedorSelector.innerHTML = "";

  // Solo se muestra un selector si el usuario tiene acceso a más de una empresa.
  // Si solo tiene una, no hay nada que elegir — se resuelve solo, como se definió.
  if (sesion.empresas.length > 1) {
    const select = document.createElement("select");
    select.id = "selector-empresa";
    sesion.empresas.forEach((empresaId) => {
      const opcion = document.createElement("option");
      opcion.value = empresaId;
      opcion.textContent = EMPRESAS[empresaId]?.nombre || empresaId;
      opcion.selected = empresaId === sesion.empresaActiva;
      select.appendChild(opcion);
    });
    select.addEventListener("change", (evento) => {
      cambiarEmpresaActiva(evento.target.value);
      document.getElementById("sidebar-empresa-nombre").textContent =
        EMPRESAS[evento.target.value]?.nombre || "—";
      despacharVistaActual();
    });
    contenedorSelector.appendChild(select);
  }
}

// --- Router simple por hash ---

function obtenerVistaDesdeHash() {
  const nombre = (location.hash || "#inicio").replace("#", "");
  return VISTAS[nombre] ? nombre : "inicio";
}

async function despacharVistaActual() {
  const nombreVista = obtenerVistaDesdeHash();
  const vista = VISTAS[nombreVista];

  document.getElementById("titulo-vista").textContent = vista.titulo;

  document.querySelectorAll(".sidebar-link").forEach((link) => {
    link.classList.toggle("activo", link.dataset.vista === nombreVista);
  });

  const contenedor = document.getElementById("vista-contenido");
  contenedor.innerHTML = '<div class="loader"></div>';

  try {
    await vista.render(contenedor, sesion);
  } catch (error) {
    console.error(error);
    contenedor.innerHTML = `
      <div class="superficie estado-vacio">
        <p><strong>No se pudo cargar esta sección.</strong></p>
        <p style="margin-top: 8px; font-size: var(--texto-sm);">
          Puede deberse a un problema de conexión o de configuración de la base de datos.
          Si el problema persiste, revisá la consola del navegador (F12) y avisá al desarrollador.
        </p>
      </div>
    `;
    mostrarError("No se pudo cargar la sección.");
  }
}

window.addEventListener("hashchange", () => {
  if (sesion) despacharVistaActual();
});