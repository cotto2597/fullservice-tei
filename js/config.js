// Configuración centralizada del sistema.
// Todo lo que pueda variar entre entornos o necesitar ajuste rápido vive acá.

export const FIREBASE_CONFIG = {
  apiKey: "TU_API_KEY",
  authDomain: "TU_PROYECTO.firebaseapp.com",
  projectId: "TU_PROYECTO",
  storageBucket: "TU_PROYECTO.appspot.com",
  messagingSenderId: "TU_SENDER_ID",
  appId: "TU_APP_ID"
};

export const EMPRESAS = {
  fullservice: {
    id: "fullservice",
    nombre: "Full Service",
    direccion: "12 de Octubre 3574",
    ciudad: "Mar del Plata"
  },
  tei: {
    id: "tei",
    nombre: "Tecnologías e Insumos",
    direccion: "Juan B. Justo",
    ciudad: "Mar del Plata"
  }
};

export const ESTADOS_REPARACION = {
  pendiente: { label: "Pendiente", color: "estado-pendiente" },
  en_proceso: { label: "En proceso", color: "estado-proceso" },
  terminado: { label: "Terminado", color: "estado-terminado" },
  entregado: { label: "Entregado", color: "estado-entregado" }
};

export const TIPOS_COMPROBANTE = {
  presupuesto: "Presupuesto",
  factura: "Factura",
  comprobante: "Comprobante",
  nota_credito: "Nota de Crédito"
};

export const ROLES = {
  administrador: "Administrador",
  operador: "Operador"
};

export const MONEDA_SIMBOLO = "$";
export const IVA_PORCENTAJE_DEFECTO = 21;

export const FORMAS_PAGO = ["Efectivo", "Transferencia", "Débito", "Crédito", "Mercado Pago"];
