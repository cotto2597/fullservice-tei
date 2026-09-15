# Changelog

## [0.5.0] - Firestore Security Rules

- Reglas completas en `firestore.rules`, alineadas con las decisiones
  confirmadas: catálogo/stock/clientes/proveedores editables por cualquier
  usuario activo (sin distinción de rol); reparaciones y facturas
  restringidas a usuarios con acceso a esa empresa; usuarios y perfil de
  empresa editables solo por administrador.
- `empresaId` protegido contra modificación posterior en reparaciones y
  facturas (evita "mover" un registro de una empresa a otra editándolo).
- Facturas sin permiso de borrado — una anulación se modela como Nota de
  Crédito, no como delete.
- Se ajustó `crearReparacion`/`crearFactura` en `js/services/datos.js` para
  guardar un campo `empresaId` explícito en los documentos de
  `contadores/`, evitando depender de parsear el id del documento (más
  robusto para que las reglas lo validen).
- Se agregó una validación de stock inexistente en `crearFactura` (mensaje
  claro si un producto no tiene documento de stock cargado para la
  empresa, en vez de un error críptico de Firestore).

## [0.4.0] - Módulo Configuración + backend mínimo

- Tabs Perfil / Usuarios / Clientes / Proveedores.
- **Perfil**: edición de datos de la empresa activa (nombre, contacto,
  dirección, IVA%, símbolo de moneda).
- **Usuarios**: listado con empresas asignadas y rol, alta de nuevo usuario,
  activar/desactivar. La creación de usuarios corre por una **Netlify
  Function** (`netlify/functions/crear-usuario.js`) con Firebase Admin SDK
  — necesario porque crear un usuario desde el SDK de cliente loguearía
  automáticamente como ese usuario nuevo, echando al administrador de su
  propia sesión. La función valida que quien llama sea administrador antes
  de crear a nadie.
- **Clientes**: listado con búsqueda, alta con CUIT/CUIL opcional,
  activar/desactivar.
- **Proveedores**: listado, alta de razón social, activar/desactivar.
- Se agregó `package.json` (dependencia `firebase-admin`) y `netlify.toml`
  apuntando a `netlify/functions`.

## [0.3.0] - Módulo Facturación

- Listado de comprobantes filtrado por mes, con tipo, forma de pago y total.
- Formulario de nuevo comprobante: tipo (Presupuesto/Factura/Comprobante/NC),
  Factura A/B como dato sin validación fiscal, forma de pago, cliente
  opcional (Consumidor Final por defecto o autocompletado de cliente
  existente).
- Buscador de productos con agregado a una tabla de ítems editable
  (cantidad ajustable, cálculo de subtotal/IVA/total en vivo).
- **Descuento de stock atómico**: al generar el comprobante, la resta de
  stock de cada producto y la creación de la factura ocurren en una sola
  transacción de Firestore. Si el stock de algún ítem no alcanza en el
  momento de confirmar, se bloquea toda la operación (no se genera la
  factura ni se descuenta nada) — decisión validada con Corcho.
- Numeración correlativa por empresa con el mismo mecanismo de contador
  atómico usado en Reparaciones (`contadores/facturas_{empresaId}`).

## [0.2.0] - Módulo Reparaciones

- Sub-tabs "En proceso" (pendiente + en_proceso) / "Entregadas" (terminado
  + entregado).
- Listado con cambio de estado inline (sin abrir modal).
- Formulario de nuevo ingreso con autocompletado de cliente existente por
  nombre/teléfono; si no hay coincidencia, crea el cliente al vuelo.
- Numeración correlativa por empresa mediante contador atómico en Firestore
  (`contadores/reparaciones_{empresaId}`), usando una transacción para
  evitar colisiones si dos ingresos se cargan al mismo tiempo.

## [0.1.0] - Esqueleto inicial

- Estructura de carpetas y arquitectura base (Nivel 2 del Starter Kit Kaizek).
- Modelo de datos de Firestore diseñado y documentado (`docs/modelo-datos.md`).
- Sistema de diseño propio: paleta cobre/pizarra, tipografía Inter, sidebar
  de navegación (identidad Kaizek, no una copia del sistema anterior).
- Login con Firebase Authentication (usuario/contraseña) con resolución
  automática de empresa activa por usuario — reemplaza el selector manual
  de "Puesto de facturación".
- Módulo Inicio: dashboard resumen (mejora nueva, no existía antes).
- Módulo Productos: catálogo compartido + stock por empresa, con alta de
  producto y búsqueda/filtro por categoría.
- Módulos Reparaciones, Facturación y Configuración: esqueleto pendiente de
  desarrollo en la próxima etapa.
