// Inicialización centralizada de Firebase.
// Cualquier módulo que necesite Firestore/Auth importa desde acá,
// nunca inicializa la app por su cuenta.

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getFirestore
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
  getAuth
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import { FIREBASE_CONFIG } from "../config.js";

const app = initializeApp(FIREBASE_CONFIG);

export const db = getFirestore(app);
export const auth = getAuth(app);
