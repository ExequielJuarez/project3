-- =====================================================================
--  SISTEMA DE GESTIÓN DE NEGOCIO · Esquema SQL (MySQL / MariaDB)
--  Se aplica solo al iniciar (CREATE ... IF NOT EXISTS): no borra datos.
--  Motor InnoDB (transacciones), utf8mb4, dinero en DECIMAL(12,2).
-- =====================================================================

-- Configuración general (nombre del negocio, datos del ticket, numeración)
CREATE TABLE IF NOT EXISTS configuracion (
  clave VARCHAR(60) PRIMARY KEY,
  valor VARCHAR(500) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS usuarios (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  usuario VARCHAR(50) NOT NULL UNIQUE,
  clave_hash VARCHAR(100) NOT NULL,
  rol ENUM('admin','cajero') NOT NULL DEFAULT 'cajero',
  activo TINYINT(1) NOT NULL DEFAULT 1,
  debe_cambiar_clave TINYINT(1) NOT NULL DEFAULT 0,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categorias (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(80) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS productos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  codigo_barras VARCHAR(50) NULL UNIQUE,      -- lo que lee la pistola
  codigo_interno VARCHAR(30) NULL UNIQUE,     -- código manual / abreviado
  nombre VARCHAR(150) NOT NULL,
  categoria_id INT UNSIGNED NULL,
  costo DECIMAL(12,2) NOT NULL DEFAULT 0,
  precio DECIMAL(12,2) NOT NULL DEFAULT 0,
  stock DECIMAL(12,3) NOT NULL DEFAULT 0,
  stock_minimo DECIMAL(12,3) NOT NULL DEFAULT 0,
  unidad VARCHAR(10) NOT NULL DEFAULT 'u',    -- u, kg, lt, etc.
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_productos_nombre (nombre),
  CONSTRAINT fk_prod_cat FOREIGN KEY (categoria_id) REFERENCES categorias(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS clientes (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  documento VARCHAR(30) NULL,
  telefono VARCHAR(40) NULL,
  email VARCHAR(120) NULL,
  direccion VARCHAR(200) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS proveedores (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(120) NOT NULL,
  contacto VARCHAR(120) NULL,
  telefono VARCHAR(40) NULL,
  email VARCHAR(120) NULL,
  activo TINYINT(1) NOT NULL DEFAULT 1,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Cada apertura/cierre de caja es un turno. Solo puede haber una abierta.
CREATE TABLE IF NOT EXISTS cajas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  fecha DATE NOT NULL,
  abierta_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  usuario_apertura_id INT UNSIGNED NOT NULL,
  monto_inicial DECIMAL(12,2) NOT NULL,
  estado ENUM('abierta','cerrada') NOT NULL DEFAULT 'abierta',
  -- Garantiza a nivel base de datos que no haya dos cajas abiertas a la vez
  abierta_unica TINYINT GENERATED ALWAYS AS (IF(estado = 'abierta', 1, NULL)) STORED,
  cerrada_en DATETIME NULL,
  usuario_cierre_id INT UNSIGNED NULL,
  -- Foto del cierre (queda guardada aunque después cambien los datos)
  cant_ventas INT NULL,
  total_ventas DECIMAL(12,2) NULL,
  total_efectivo DECIMAL(12,2) NULL,
  total_tarjeta DECIMAL(12,2) NULL,
  total_transferencia DECIMAL(12,2) NULL,
  ingresos_extra DECIMAL(12,2) NULL,
  egresos DECIMAL(12,2) NULL,
  monto_esperado DECIMAL(12,2) NULL,          -- efectivo que debería haber en caja
  monto_contado DECIMAL(12,2) NULL,           -- efectivo contado por el cajero
  diferencia DECIMAL(12,2) NULL,              -- contado - esperado
  notas_cierre VARCHAR(500) NULL,
  UNIQUE KEY uq_una_caja_abierta (abierta_unica),
  KEY idx_cajas_fecha (fecha),
  CONSTRAINT fk_caja_uap FOREIGN KEY (usuario_apertura_id) REFERENCES usuarios(id),
  CONSTRAINT fk_caja_uci FOREIGN KEY (usuario_cierre_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Retiros e ingresos de efectivo durante el turno (pago a proveedor, cambio, etc.)
CREATE TABLE IF NOT EXISTS caja_movimientos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  caja_id INT UNSIGNED NOT NULL,
  tipo ENUM('ingreso','egreso') NOT NULL,
  concepto VARCHAR(120) NOT NULL,
  monto DECIMAL(12,2) NOT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_mov_caja FOREIGN KEY (caja_id) REFERENCES cajas(id),
  CONSTRAINT fk_mov_usr FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Ventas / facturas
CREATE TABLE IF NOT EXISTS ventas (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  numero VARCHAR(20) NOT NULL UNIQUE,         -- 0001-00000001
  caja_id INT UNSIGNED NOT NULL,
  usuario_id INT UNSIGNED NOT NULL,
  cliente_id INT UNSIGNED NULL,
  fecha_dia DATE NOT NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  subtotal DECIMAL(12,2) NOT NULL,
  descuento DECIMAL(12,2) NOT NULL DEFAULT 0,
  total DECIMAL(12,2) NOT NULL,
  pago_efectivo DECIMAL(12,2) NOT NULL DEFAULT 0,   -- ya descontado el vuelto
  pago_tarjeta DECIMAL(12,2) NOT NULL DEFAULT 0,
  pago_transferencia DECIMAL(12,2) NOT NULL DEFAULT 0,
  recibido DECIMAL(12,2) NOT NULL DEFAULT 0,        -- lo que entregó el cliente
  vuelto DECIMAL(12,2) NOT NULL DEFAULT 0,
  estado ENUM('completada','anulada') NOT NULL DEFAULT 'completada',
  anulada_en DATETIME NULL,
  anulada_por INT UNSIGNED NULL,
  motivo_anulacion VARCHAR(200) NULL,
  notas VARCHAR(200) NULL,
  KEY idx_ventas_dia (fecha_dia),
  KEY idx_ventas_caja (caja_id),
  CONSTRAINT fk_venta_caja FOREIGN KEY (caja_id) REFERENCES cajas(id),
  CONSTRAINT fk_venta_usr FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
  CONSTRAINT fk_venta_cli FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE SET NULL,
  CONSTRAINT fk_venta_anu FOREIGN KEY (anulada_por) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS venta_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  venta_id INT UNSIGNED NOT NULL,
  producto_id INT UNSIGNED NULL,
  codigo VARCHAR(50) NULL,
  descripcion VARCHAR(150) NOT NULL,          -- copia del nombre al momento de vender
  cantidad DECIMAL(12,3) NOT NULL,
  precio_unitario DECIMAL(12,2) NOT NULL,
  costo_unitario DECIMAL(12,2) NOT NULL DEFAULT 0,
  subtotal DECIMAL(12,2) NOT NULL,
  KEY idx_items_venta (venta_id),
  KEY idx_items_producto (producto_id),
  CONSTRAINT fk_item_venta FOREIGN KEY (venta_id) REFERENCES ventas(id) ON DELETE CASCADE,
  CONSTRAINT fk_item_prod FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Historial de todo cambio de stock (kardex)
CREATE TABLE IF NOT EXISTS stock_movimientos (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  producto_id INT UNSIGNED NOT NULL,
  tipo ENUM('inicial','venta','anulacion','compra','ajuste') NOT NULL,
  cantidad DECIMAL(12,3) NOT NULL,            -- positivo entra, negativo sale
  stock_resultante DECIMAL(12,3) NOT NULL,
  referencia VARCHAR(60) NULL,                -- nº de factura, compra, etc.
  nota VARCHAR(200) NULL,
  usuario_id INT UNSIGNED NULL,
  creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_stockmov_producto (producto_id, id),
  CONSTRAINT fk_smov_prod FOREIGN KEY (producto_id) REFERENCES productos(id) ON DELETE CASCADE,
  CONSTRAINT fk_smov_usr FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Compras a proveedores (ingreso de mercadería)
CREATE TABLE IF NOT EXISTS compras (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  proveedor_id INT UNSIGNED NULL,
  usuario_id INT UNSIGNED NOT NULL,
  comprobante VARCHAR(60) NULL,
  fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  total DECIMAL(12,2) NOT NULL DEFAULT 0,
  notas VARCHAR(200) NULL,
  CONSTRAINT fk_compra_prov FOREIGN KEY (proveedor_id) REFERENCES proveedores(id) ON DELETE SET NULL,
  CONSTRAINT fk_compra_usr FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS compra_items (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  compra_id INT UNSIGNED NOT NULL,
  producto_id INT UNSIGNED NOT NULL,
  cantidad DECIMAL(12,3) NOT NULL,
  costo_unitario DECIMAL(12,2) NOT NULL,
  subtotal DECIMAL(12,2) NOT NULL,
  CONSTRAINT fk_citem_compra FOREIGN KEY (compra_id) REFERENCES compras(id) ON DELETE CASCADE,
  CONSTRAINT fk_citem_prod FOREIGN KEY (producto_id) REFERENCES productos(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Resumen de ventas por día (registro diario consultable)
CREATE OR REPLACE VIEW v_resumen_diario AS
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
