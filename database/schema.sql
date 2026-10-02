-- =====================================================================
--  SISTEMA DE GESTIÓN DE NEGOCIO · Esquema SQL (SQLite)
--  Se aplica solo al iniciar (CREATE ... IF NOT EXISTS), no borra datos.
--  Fechas en hora local del negocio: 'YYYY-MM-DD HH:MM:SS'
--  Dinero: REAL con 2 decimales (se redondea en la aplicación).
-- =====================================================================
PRAGMA foreign_keys = ON;

-- Configuración general (nombre del negocio, datos del ticket, numeración)
CREATE TABLE IF NOT EXISTS configuracion (
  clave TEXT PRIMARY KEY,
  valor TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS usuarios (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  usuario TEXT NOT NULL UNIQUE COLLATE NOCASE,
  clave_hash TEXT NOT NULL,
  rol TEXT NOT NULL DEFAULT 'cajero' CHECK (rol IN ('admin','cajero')),
  activo INTEGER NOT NULL DEFAULT 1,
  debe_cambiar_clave INTEGER NOT NULL DEFAULT 0,
  creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS categorias (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL UNIQUE COLLATE NOCASE
);

CREATE TABLE IF NOT EXISTS productos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  codigo_barras TEXT UNIQUE,            -- lo que lee la pistola
  codigo_interno TEXT UNIQUE,           -- código manual / abreviado
  nombre TEXT NOT NULL,
  categoria_id INTEGER REFERENCES categorias(id) ON DELETE SET NULL,
  costo REAL NOT NULL DEFAULT 0 CHECK (costo >= 0),
  precio REAL NOT NULL DEFAULT 0 CHECK (precio >= 0),
  stock REAL NOT NULL DEFAULT 0,
  stock_minimo REAL NOT NULL DEFAULT 0,
  unidad TEXT NOT NULL DEFAULT 'u',     -- u, kg, lt, etc.
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  actualizado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_productos_nombre ON productos(nombre COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_productos_categoria ON productos(categoria_id);

CREATE TABLE IF NOT EXISTS clientes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  documento TEXT,
  telefono TEXT,
  email TEXT,
  direccion TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

CREATE TABLE IF NOT EXISTS proveedores (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nombre TEXT NOT NULL,
  contacto TEXT,
  telefono TEXT,
  email TEXT,
  activo INTEGER NOT NULL DEFAULT 1,
  creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Cada apertura/cierre de caja es un turno. Solo puede haber una abierta.
CREATE TABLE IF NOT EXISTS cajas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fecha TEXT NOT NULL DEFAULT (date('now','localtime')),
  abierta_en TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  usuario_apertura_id INTEGER NOT NULL REFERENCES usuarios(id),
  monto_inicial REAL NOT NULL CHECK (monto_inicial >= 0),
  estado TEXT NOT NULL DEFAULT 'abierta' CHECK (estado IN ('abierta','cerrada')),
  cerrada_en TEXT,
  usuario_cierre_id INTEGER REFERENCES usuarios(id),
  -- Foto del cierre (queda guardada aunque después cambien los datos)
  cant_ventas INTEGER,
  total_ventas REAL,
  total_efectivo REAL,
  total_tarjeta REAL,
  total_transferencia REAL,
  ingresos_extra REAL,
  egresos REAL,
  monto_esperado REAL,                  -- efectivo que debería haber en caja
  monto_contado REAL,                   -- efectivo contado por el cajero
  diferencia REAL,                      -- contado - esperado
  notas_cierre TEXT
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_una_caja_abierta ON cajas(estado) WHERE estado = 'abierta';
CREATE INDEX IF NOT EXISTS idx_cajas_fecha ON cajas(fecha);

-- Retiros e ingresos de efectivo durante el turno (pago a proveedor, cambio, etc.)
CREATE TABLE IF NOT EXISTS caja_movimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  caja_id INTEGER NOT NULL REFERENCES cajas(id),
  tipo TEXT NOT NULL CHECK (tipo IN ('ingreso','egreso')),
  concepto TEXT NOT NULL,
  monto REAL NOT NULL CHECK (monto > 0),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);

-- Ventas / facturas
CREATE TABLE IF NOT EXISTS ventas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  numero TEXT NOT NULL UNIQUE,          -- 0001-00000001
  caja_id INTEGER NOT NULL REFERENCES cajas(id),
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  cliente_id INTEGER REFERENCES clientes(id) ON DELETE SET NULL,
  fecha_dia TEXT NOT NULL DEFAULT (date('now','localtime')),
  fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  subtotal REAL NOT NULL,
  descuento REAL NOT NULL DEFAULT 0 CHECK (descuento >= 0),
  total REAL NOT NULL CHECK (total >= 0),
  pago_efectivo REAL NOT NULL DEFAULT 0,   -- ya descontado el vuelto
  pago_tarjeta REAL NOT NULL DEFAULT 0,
  pago_transferencia REAL NOT NULL DEFAULT 0,
  recibido REAL NOT NULL DEFAULT 0,        -- lo que entregó el cliente
  vuelto REAL NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'completada' CHECK (estado IN ('completada','anulada')),
  anulada_en TEXT,
  anulada_por INTEGER REFERENCES usuarios(id),
  motivo_anulacion TEXT,
  notas TEXT
);
CREATE INDEX IF NOT EXISTS idx_ventas_dia ON ventas(fecha_dia);
CREATE INDEX IF NOT EXISTS idx_ventas_caja ON ventas(caja_id);

CREATE TABLE IF NOT EXISTS venta_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  venta_id INTEGER NOT NULL REFERENCES ventas(id) ON DELETE CASCADE,
  producto_id INTEGER REFERENCES productos(id) ON DELETE SET NULL,
  codigo TEXT,
  descripcion TEXT NOT NULL,            -- copia del nombre al momento de vender
  cantidad REAL NOT NULL CHECK (cantidad > 0),
  precio_unitario REAL NOT NULL,
  costo_unitario REAL NOT NULL DEFAULT 0,
  subtotal REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_venta ON venta_items(venta_id);
CREATE INDEX IF NOT EXISTS idx_items_producto ON venta_items(producto_id);

-- Historial de todo cambio de stock (kardex)
CREATE TABLE IF NOT EXISTS stock_movimientos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  producto_id INTEGER NOT NULL REFERENCES productos(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('inicial','venta','anulacion','compra','ajuste')),
  cantidad REAL NOT NULL,               -- positivo entra, negativo sale
  stock_resultante REAL NOT NULL,
  referencia TEXT,                      -- nº de factura, compra, etc.
  nota TEXT,
  usuario_id INTEGER REFERENCES usuarios(id),
  creado_en TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE INDEX IF NOT EXISTS idx_stockmov_producto ON stock_movimientos(producto_id, id);

-- Compras a proveedores (ingreso de mercadería)
CREATE TABLE IF NOT EXISTS compras (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  proveedor_id INTEGER REFERENCES proveedores(id) ON DELETE SET NULL,
  usuario_id INTEGER NOT NULL REFERENCES usuarios(id),
  comprobante TEXT,
  fecha TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  total REAL NOT NULL DEFAULT 0,
  notas TEXT
);

CREATE TABLE IF NOT EXISTS compra_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  compra_id INTEGER NOT NULL REFERENCES compras(id) ON DELETE CASCADE,
  producto_id INTEGER NOT NULL REFERENCES productos(id),
  cantidad REAL NOT NULL CHECK (cantidad > 0),
  costo_unitario REAL NOT NULL,
  subtotal REAL NOT NULL
);

-- Resumen de ventas por día (registro diario consultable)
CREATE VIEW IF NOT EXISTS v_resumen_diario AS
SELECT
  fecha_dia,
  COUNT(*)                          AS cant_ventas,
  ROUND(SUM(total), 2)              AS total_ventas,
  ROUND(SUM(pago_efectivo), 2)      AS efectivo,
  ROUND(SUM(pago_tarjeta), 2)       AS tarjeta,
  ROUND(SUM(pago_transferencia), 2) AS transferencia
FROM ventas
WHERE estado = 'completada'
GROUP BY fecha_dia;
