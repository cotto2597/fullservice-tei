// Servicio de autenticación.
//
// Reemplaza al selector manual de "Puesto de facturación" del sistema
// anterior: al loguearse, se lee el documento del usuario en Firestore
// y de ahí se resuelve a qué empresa(s) tiene acceso, sin que la persona
// tenga que elegir nada a mano.

import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  doc,
  getDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import { auth, db } from "./firebase.js";

// Estado de sesión en memoria: usuario de Auth + su perfil de Firestore
// (empresas asociadas, rol, permisos) ya resuelto.
let sesionActual = null;

/**
 * Inicia sesión con email y contraseña.
 * Lanza un error con mensaje en español listo para mostrar al usuario.
 */
export async function iniciarSesion(email, contrasena) {
  try {
    const credencial = await signInWithEmailAndPassword(auth, email, contrasena);
    return await cargarPerfilUsuario(credencial.user.uid);
  } catch (error) {
    throw new Error(mensajeErrorLogin(error.code));
  }
}

export async function cerrarSesion() {
  sesionActual = null;
  await signOut(auth);
}

/**
 * Carga el documento usuarios/{uid} y arma el objeto de sesión.
 * Si el usuario tiene acceso a una sola empresa, esa queda como
 * empresa activa automáticamente. Si tiene ambas, se respeta
 * empresaPorDefecto y la UI ofrece un switch para cambiar.
 */
async function cargarPerfilUsuario(uid) {
  const refUsuario = doc(db, "usuarios", uid);
  const snapUsuario = await getDoc(refUsuario);

  if (!snapUsuario.exists()) {
    throw new Error("Este usuario no tiene un perfil configurado en el sistema. Contactá a un administrador.");
  }

  const perfil = snapUsuario.data();

  if (!perfil.activo) {
    throw new Error("Tu usuario está desactivado. Contactá a un administrador.");
  }

  sesionActual = {
    uid,
    nombre: perfil.nombre,
    email: perfil.email,
    rol: perfil.rol,
    permisos: perfil.permisos || null,
    empresas: perfil.empresas || [],
    empresaActiva: perfil.empresaPorDefecto || perfil.empresas?.[0] || null
  };

  return sesionActual;
}

export function obtenerSesion() {
  return sesionActual;
}

/** Cambia la empresa activa dentro de la sesión (solo si el usuario tiene acceso a ella). */
export function cambiarEmpresaActiva(empresaId) {
  if (!sesionActual) return;
  if (!sesionActual.empresas.includes(empresaId)) {
    throw new Error("No tenés acceso a esa empresa.");
  }
  sesionActual.empresaActiva = empresaId;
}

/** Suscripción a cambios de sesión (login/logout), para que la app reaccione. */
export function suscribirCambiosDeSesion(callback) {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      const perfil = await cargarPerfilUsuario(user.uid);
      callback(perfil);
    } else {
      sesionActual = null;
      callback(null);
    }
  });
}

function mensajeErrorLogin(codigo) {
  switch (codigo) {
    case "auth/invalid-email":
      return "El email ingresado no es válido.";
    case "auth/user-disabled":
      return "Este usuario está deshabilitado.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Usuario o contraseña incorrectos.";
    case "auth/too-many-requests":
      return "Demasiados intentos fallidos. Esperá unos minutos e intentá de nuevo.";
    default:
      return "No se pudo iniciar sesión. Intentá de nuevo.";
  }
}
