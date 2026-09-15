# Modelo de Datos — Tecnologías e Insumos / FullService

## Principio de diseño

Una sola base de datos (Firestore) para las dos empresas. El catálogo de
productos, clientes y proveedores es compartido; lo que cambia por empresa es
el **stock**, el **precio de venta** (si aplica) y las **facturas/reparaciones**,
que pertenecen a una sola empresa a la vez.

Cada documento relevante lleva un campo `empresa: "fullservice" | "tei"` para
filtrar, salvo el catálogo de productos (compartido) y clientes/proveedores
(compartidos).

## Colecciones

### `empresas/{empresaId}`
Documento de configuración por empresa (reemplaza la pantalla "Perfil").
```
{
  id: "fullservice" | "tei",
  nombre: "Full Service" | "Tecnologías e Insumos",
  telefono, email, direccion, ciudad, region, codigoPostal,
  logoUrl,
  monedaSimbolo: "$",
  ivaPorcentaje: 21
}
```
Dos documentos fijos, uno por empresa. `empresaId` se usa como identificador
corto en el resto del sistema.

### `usuarios/{uid}`
Espeja el usuario de Firebase Authentication. Reemplaza a "Punto de
facturación" — de acá se infiere la empresa automáticamente al loguearse.
```
{
  uid,
  nombre,
  email,
  empresas: ["fullservice"] | ["tei"] | ["fullservice", "tei"],
  empresaPorDefecto: "fullservice",
  rol: "administrador" | "operador",
  permisos: { ... } // solo si rol = operador con permisos acotados
  activo: true
}
```
Un usuario puede tener acceso a una o ambas empresas (útil para un dueño que
opera en los dos locales). Si tiene ambas, la app le muestra un selector
simple al loguearse o un switch en el header — pero nunca vuelve a pedir
"puesto".

### `productos/{productoId}`
Catálogo **compartido** entre ambas empresas.
```
{
  id,
  codigo,
  nombre,
  descripcion,
  categoriaId,
  marca,
  proveedorId,
  condicionIva: "21%" | ...,
  activoWeb: true,
  creadoEn, actualizadoEn
}
```

### `productos/{productoId}/stock/{empresaId}`
Subcolección: stock y precios por empresa. Documento con id fijo
`"fullservice"` o `"tei"`.
```
{
  cantidad,
  stockMinimo,
  precioCompra,
  calculoVentaPorcentaje,
  precioVenta
}
```
Esto reproduce exactamente lo que se veía en el sistema viejo (columnas de
stock por local) pero de forma normalizada: un producto, un doc de stock por
empresa.

### `categorias/{categoriaId}`
Compartidas entre ambas empresas.
```
{ nombre, descripcion, creadoEn }
```

### `clientes/{clienteId}`
Compartidos entre ambas empresas (confirmado por Corcho).
```
{
  nombre, cuitCuil, telefono, email, direccion,
  estado: "activo" | "inactivo",
  creadoEn
}
```

### `proveedores/{proveedorId}`
Compartidos entre ambas empresas (confirmado por Corcho).
```
{
  razonSocial, telefono, email, direccion,
  estado: "activo" | "inactivo",
  creadoEn
}
```

### `reparaciones/{reparacionId}`
Pertenece a **una** empresa (campo `empresaId`).
```
{
  empresaId: "fullservice" | "tei",
  numero, // correlativo, puede ser por empresa
  clienteId, clienteNombreCache, clienteTelefonoCache,
  equipo, marca, modelo, numeroSerie,
  fechaIngreso, fechaEntrega,
  usuarioAsignadoUid,
  presupuesto,
  observaciones,
  estado: "pendiente" | "en_proceso" | "terminado" | "entregado",
  creadoEn, actualizadoEn
}
```
`clienteNombreCache`/`clienteTelefonoCache`: copia de solo lectura para no
tener que resolver el cliente en cada fila de la tabla (patrón ya usado en
otros proyectos Kaizek para listas grandes).

### `facturas/{facturaId}`
Pertenece a **una** empresa.
```
{
  empresaId,
  numero, puntoVenta,
  tipo: "presupuesto" | "factura" | "comprobante" | "nota_credito",
  facturaTipo: "A" | "B" | null,
  clienteId, clienteNombreCache, clienteCuitCache,
  formaPago,
  items: [
    { productoId, nombreCache, cantidad, precioUnitario, ivaPorcentaje, subtotal }
  ],
  subtotal, iva, total,
  observaciones,
  fecha, creadoPorUid
}
```
Sin integración fiscal (ARCA/Facturatrón aparte, confirmado). El campo
`facturaTipo` A/B se guarda solo como dato del comprobante, no dispara
ninguna validación fiscal real.

## Por qué este modelo y no otro

- **Catálogo/clientes/proveedores compartidos, stock separado**: evita
  duplicar 105+ categorías y todo el catálogo de productos dos veces: se
  carga un producto una vez y cada empresa solo administra su cantidad y
  precio. Esto es exactamente el patrón "catálogo maestro" que ya funciona
  en Tira e' Molla.
- **Subcolección de stock en vez de un mapa `stock: { fullservice: {...}, tei:
  {...} }` dentro del producto**: permite consultar/escuchar el stock de una
  sola empresa sin traer el documento completo del producto, y escala mejor
  si en el futuro se agrega una tercera empresa o sucursal.
- **`empresaId` en reparaciones/facturas en vez de subcolecciones separadas
  por empresa**: simplifica reportes que crucen ambas empresas (ej. "cuántas
  reparaciones totales hizo el negocio este mes") sin tener que consultar dos
  colecciones distintas.
- **Sin campo de "Puesto de facturación"**: reemplazado por la relación
  usuario → empresa(s), que es más simple y evita que alguien tenga que
  recordar seleccionar el puesto correcto cada vez (fuente de errores en el
  sistema viejo).
