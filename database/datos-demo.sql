-- Datos de ejemplo para probar el sistema (npm run db:demo). No se cargan si ya hay productos.
INSERT OR IGNORE INTO categorias (nombre) VALUES ('Almacén'), ('Bebidas'), ('Lácteos'), ('Limpieza'), ('Golosinas');

INSERT OR IGNORE INTO productos (codigo_barras, codigo_interno, nombre, categoria_id, costo, precio, stock, stock_minimo, unidad) VALUES
 ('7790070411006', '101', 'Aceite de girasol 900 ml',     (SELECT id FROM categorias WHERE nombre='Almacén'),   2100, 2890, 24, 6, 'u'),
 ('7791234567890', '102', 'Arroz largo fino 1 kg',        (SELECT id FROM categorias WHERE nombre='Almacén'),    980, 1390, 40, 10, 'u'),
 ('7792222333344', '103', 'Fideos tirabuzón 500 g',       (SELECT id FROM categorias WHERE nombre='Almacén'),    720, 1050, 3, 8, 'u'),
 ('7790895000102', '201', 'Gaseosa cola 2,25 L',          (SELECT id FROM categorias WHERE nombre='Bebidas'),   1500, 2300, 30, 8, 'u'),
 ('7793456789012', '202', 'Agua mineral 1,5 L',           (SELECT id FROM categorias WHERE nombre='Bebidas'),    600,  950, 48, 12, 'u'),
 ('7798111222333', '301', 'Leche entera 1 L',             (SELECT id FROM categorias WHERE nombre='Lácteos'),    980, 1450, 36, 12, 'u'),
 ('7794567890123', '302', 'Yogur firme vainilla 190 g',   (SELECT id FROM categorias WHERE nombre='Lácteos'),    420,  690, 20, 6, 'u'),
 ('7795678901234', '401', 'Lavandina 1 L',                (SELECT id FROM categorias WHERE nombre='Limpieza'),   650,  990, 15, 5, 'u'),
 ('7796789012345', '501', 'Alfajor triple chocolate',     (SELECT id FROM categorias WHERE nombre='Golosinas'),  520,  850, 60, 20, 'u'),
 (NULL,            '502', 'Caramelos surtidos (suelto)',  (SELECT id FROM categorias WHERE nombre='Golosinas'), 3800, 5600, 4.5, 1, 'kg');

INSERT INTO stock_movimientos (producto_id, tipo, cantidad, stock_resultante, nota)
SELECT id, 'inicial', stock, stock, 'Stock inicial (demo)' FROM productos
WHERE id NOT IN (SELECT producto_id FROM stock_movimientos);

INSERT OR IGNORE INTO clientes (id, nombre, documento, telefono) VALUES (1, 'María Gómez', '27123456789', '11 5555-1234');
INSERT OR IGNORE INTO proveedores (id, nombre, contacto, telefono) VALUES (1, 'Distribuidora Central', 'Carlos', '11 4444-9876');
