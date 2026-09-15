# Tecnologías e Insumos / Full Service — Sistema de gestión

Reemplazo del sistema "InfoStock" (Arielinfo Sistemas) usado actualmente por
FullService y Tecnologías e Insumos. Desarrollado por Kaizek.

## Qué resuelve

Una sola aplicación para las dos empresas (originalmente una sola compañía,
hoy dos negocios relacionados que comparten catálogo, clientes y
proveedores, pero llevan su stock, reparaciones y facturación por separado).

## Stack

- HTML/CSS/JS vanilla, sin build tools (según Starter Kit Kaizek).
- Firebase: Firestore (datos) + Authentication (usuario/contraseña).
- Netlify Functions + Firebase Admin SDK: único punto con "backend", usado
  solo para crear usuarios (ver más abajo por qué).
- Despliegue: Netlify.

## Estructura del proyecto

```
index.html          Shell de la app: login + navegación + contenedor de vistas
css/
  variables.css      Tokens de diseño (color, tipografía, espaciado)
  base.css           Reset y tipografía base
  layout.css         Sidebar + layout general
  components.css     Componentes reutilizables (botones, tablas, modales, badges)
js/
  config.js          Configuración central (Firebase, empresas, catálogos de estado)
  utils.js           Formateo de moneda/fecha, notificaciones toast
  app.js             Orquestador: login, shell según sesión, router por hash
  services/
    firebase.js      Inicialización de Firebase (única fuente)
    auth.js          Login, sesión, resolución automática de empresa por usuario
    datos.js         Todas las consultas a Firestore (capa de acceso a datos)
  modules/
    inicio.js          Dashboard resumen (nuevo respecto al sistema anterior)
    productos.js       Catálogo compartido + stock por empresa
    reparaciones.js    Tabs En proceso/Entregadas, ingreso con autocompletado de cliente
    facturacion.js     Listado mensual + comprobante con descuento de stock atómico
    configuracion.js   Perfil, Usuarios (alta vía Netlify Function), Clientes, Proveedores
netlify/
  functions/
    crear-usuario.js  Alta de usuario con Firebase Admin SDK (ver nota de seguridad abajo)
docs/
  modelo-datos.md    Diseño completo de las colecciones de Firestore y su razón de ser
firestore.rules      Reglas de seguridad — quién puede leer/escribir cada colección
package.json         Dependencia firebase-admin para la Netlify Function
netlify.toml         Apunta Netlify a netlify/functions
```

## Decisiones de diseño relevantes

Ver `docs/modelo-datos.md` para el detalle completo del modelo de datos y
por qué se eligió. Resumen de las decisiones más importantes ya validadas
con el cliente:

- **Login simple usuario/contraseña**, sin 2FA (reemplaza Google
  Authenticator del sistema anterior — negocio chico, confianza interna).
- **Sin selector manual de "Puesto de facturación"**: la empresa activa se
  resuelve automáticamente según el usuario logueado.
- **Catálogo, clientes y proveedores compartidos** entre FullService y
  Tecnologías e Insumos; **stock, reparaciones y facturación separados**
  por empresa.
- La sección "Recargas" del sistema anterior quedó obsoleta y no se migra.
- La facturación de esta app **no está integrada con ARCA/Facturatrón**
  (se maneja aparte); solo emite comprobantes internos.
- **Facturar descuenta stock automáticamente**, y si el stock no alcanza la
  venta se bloquea por completo (transacción atómica en Firestore — ver
  `crearFactura` en `js/services/datos.js`).
- **Numeración correlativa por empresa** para reparaciones y facturas,
  usando contadores atómicos (`contadores/{tipo}_{empresaId}`) para evitar
  colisiones si dos personas cargan al mismo tiempo desde distintas PCs.
- **Alta de usuarios vía Netlify Function**, no desde el cliente
  directamente: `createUserWithEmailAndPassword` del SDK de cliente loguea
  automáticamente como el usuario recién creado, lo que echaría al
  administrador de su propia sesión. La función usa Firebase Admin SDK y
  valida que quien la llama sea administrador antes de crear a nadie.
- **Modelo de permisos** (`firestore.rules`): catálogo, stock, clientes y
  proveedores son editables por cualquier usuario activo de cualquiera de
  las dos empresas (decisión de Corcho: sin distinción de rol ahí).
  Reparaciones y facturas solo son visibles/editables por usuarios con
  acceso a esa empresa puntual. Usuarios y el perfil de cada empresa solo
  son editables por administrador. Las facturas no se pueden borrar desde
  la app (una anulación se modela como Nota de Crédito).

## Configuración necesaria antes de desplegar

1. **Firebase**: crear el proyecto, habilitar Firestore y Authentication
   (proveedor Email/Contraseña). Reemplazar las credenciales de ejemplo en
   `js/config.js`.
2. **Publicar las Security Rules**: subir el contenido de `firestore.rules`
   desde Firebase Console → Firestore Database → Reglas (o con `firebase
   deploy --only firestore:rules` si se instala el CLI de Firebase). Sin
   este paso, la base queda completamente abierta.
3. **Cuenta de servicio para la Netlify Function**: en Firebase Console →
   Configuración del proyecto → Cuentas de servicio → generar clave privada
   nueva. En Netlify, configurar estas variables de entorno (Site settings
   → Environment variables) con los valores del JSON descargado:
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_CLIENT_EMAIL`
   - `FIREBASE_PRIVATE_KEY` (pegar tal cual, con los `\n` — la función ya
     los convierte a saltos de línea reales)
4. **Datos iniciales en Firestore** (no hay pantalla para esto todavía,
   se carga a mano la primera vez):
   - Dos documentos en `empresas/`: uno con id `fullservice`, otro `tei`.
   - Al menos un usuario administrador: crearlo con la función de
     Configuración → Usuarios una vez que el primer administrador exista
     en Authentication (para el primerísimo usuario, puede cargarse a mano
     en Authentication + un documento en `usuarios/{uid}` con
     `rol: "administrador"`, ya que la función exige que quien crea sea
     admin).

## Pendiente (próximas etapas)

- Definir plan de migración de datos desde el sistema InfoStock actual.
- Carga inicial del catálogo de productos/categorías/clientes/proveedores
  migrados.
- Considerar paginación en Productos/Clientes si el volumen migrado es
  grande (ver notas en `js/services/datos.js` y `js/modules/productos.js`).
