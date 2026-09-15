// Utilidades generales reutilizables en todo el proyecto.

import { MONEDA_SIMBOLO } from "./config.js";

export function formatearMoneda(valor) {
  const numero = Number(valor) || 0;
  return `${MONEDA_SIMBOLO} ${numero.toLocaleString("es-AR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
}

export function formatearFecha(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return d.toLocaleDateString("es-AR");
}

export function formatearFechaHora(fecha) {
  const d = fecha instanceof Date ? fecha : new Date(fecha);
  return d.toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/** Genera un correlativo simple con prefijo, ej: generarId("REP") -> "REP-1734567890123" */
export function generarId(prefijo = "") {
  const marca = Date.now().toString(36).toUpperCase();
  return prefijo ? `${prefijo}-${marca}` : marca;
}

export function normalizarBusqueda(texto) {
  return (texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

// --- Sistema de notificaciones (toasts) ---

let contenedorToasts = null;

function obtenerContenedorToasts() {
  if (!contenedorToasts) {
    contenedorToasts = document.createElement("div");
    contenedorToasts.className = "toast-contenedor";
    document.body.appendChild(contenedorToasts);
  }
  return contenedorToasts;
}

export function mostrarToast(mensaje, tipo = "info", duracionMs = 3500) {
  const contenedor = obtenerContenedorToasts();
  const toast = document.createElement("div");
  toast.className = `toast ${tipo}`;
  toast.textContent = mensaje;
  contenedor.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, duracionMs);
}

export function mostrarError(mensaje) {
  mostrarToast(mensaje, "error", 4500);
}

export function mostrarExito(mensaje) {
  mostrarToast(mensaje, "exito");
}
