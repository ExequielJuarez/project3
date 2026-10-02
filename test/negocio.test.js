// Prueba la lógica de negocio contra una base temporal: node --test test/
const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("os");
const path = require("path");

process.env.DB_PATH = path.join(os.tmpdir(), `negocio-test-${process.pid}.db`);
const db = require("../src/config/db");
const cajaService = require("../src/services/cajaService");
const ventaService = require("../src/services/ventaService");
const productoService = require("../src/services/productoService");
const compraService = require("../src/services/compraService");

const admin = db.prepare("SELECT id FROM usuarios WHERE usuario = 'admin'").get().id;
const crearProducto = (nombre, precio, stock, codigo) =>
  productoService.crear({ codigo_barras: codigo, codigo_interno: null, nombre, categoria_id: null, costo: precio / 2, precio, stock_minimo: 0, unidad: "u", activo: 1 }, stock, admin);

test("la pistola encuentra el producto por código de barras o interno", () => {
  const id = crearProducto("Galletitas", 1000, 10, "7790001");
  db.prepare("UPDATE productos SET codigo_interno = '55' WHERE id = ?").run(id);
  assert.equal(productoService.porCodigo("7790001").id, id);
  assert.equal(productoService.porCodigo("55").id, id);
  assert.equal(productoService.porCodigo("no-existe"), undefined);
});

test("no se puede vender con la caja cerrada y se abre con monto inicial", () => {
  assert.equal(cajaService.actual(), undefined);
  cajaService.abrir(admin, 1000);
  assert.throws(() => cajaService.abrir(admin, 5), /Ya hay una caja abierta/);
});

test("una venta descuenta stock, numera la factura y calcula el vuelto", () => {
  const caja = cajaService.actual();
  const id = productoService.porCodigo("7790001").id;
  const r = ventaService.crear({ usuarioId: admin, cajaId: caja.id, items: [{ producto_id: id, cantidad: 3 }], descuento: 0, pagos: { efectivo: 5000 } });
  assert.equal(r.numero, "0001-00000001");
  assert.equal(r.total, 3000);
  assert.equal(r.vuelto, 2000);
  assert.equal(productoService.obtener(id).stock, 7);
});

test("si algo falla no se guarda nada (ni stock ni número de factura)", () => {
  const caja = cajaService.actual();
  const a = productoService.porCodigo("7790001").id;
  const b = crearProducto("Alfajor", 500, 1, "7790002");
  assert.throws(
    () => ventaService.crear({ usuarioId: admin, cajaId: caja.id, items: [{ producto_id: a, cantidad: 2 }, { producto_id: b, cantidad: 5 }], pagos: { efectivo: 99999 } }),
    /Stock insuficiente/
  );
  assert.equal(productoService.obtener(a).stock, 7);
  assert.equal(db.prepare("SELECT COUNT(*) n FROM ventas").get().n, 1);
  assert.throws(() => ventaService.crear({ usuarioId: admin, cajaId: caja.id, items: [{ producto_id: a, cantidad: 1 }], pagos: { efectivo: 10 } }), /no alcanza/);
});

test("pago mixto: el vuelto solo sale del efectivo", () => {
  const caja = cajaService.actual();
  const a = productoService.porCodigo("7790001").id;
  const r = ventaService.crear({ usuarioId: admin, cajaId: caja.id, items: [{ producto_id: a, cantidad: 1 }], pagos: { efectivo: 200, tarjeta: 900 } });
  assert.equal(r.vuelto, 100);
  const v = ventaService.obtener(r.id);
  assert.equal(v.pago_efectivo, 100);
  assert.equal(v.pago_tarjeta, 900);
  assert.throws(() => ventaService.crear({ usuarioId: admin, cajaId: caja.id, items: [{ producto_id: a, cantidad: 1 }], pagos: { tarjeta: 1500 } }), /vuelto/);
});

test("anular devuelve el stock y deja de contar en los totales", () => {
  const caja = cajaService.actual();
  const a = productoService.porCodigo("7790001").id;
  const antes = productoService.obtener(a).stock;
  const r = ventaService.crear({ usuarioId: admin, cajaId: caja.id, items: [{ producto_id: a, cantidad: 2 }], pagos: { efectivo: 2000 } });
  const totalAntes = cajaService.resumen(caja.id).totalVentas;
  ventaService.anular(r.id, admin, "prueba");
  assert.equal(productoService.obtener(a).stock, antes);
  assert.equal(cajaService.resumen(caja.id).totalVentas, totalAntes - 2000);
  assert.throws(() => ventaService.anular(r.id, admin, "otra vez"), /ya estaba anulada/);
});

test("la compra a proveedor suma stock y actualiza el costo", () => {
  const a = productoService.porCodigo("7790001").id;
  const antes = productoService.obtener(a).stock;
  compraService.crear({ usuarioId: admin, items: [{ producto_id: a, cantidad: 10, costo: 700 }] });
  const p = productoService.obtener(a);
  assert.equal(p.stock, antes + 10);
  assert.equal(p.costo, 700);
});

test("el cierre de caja guarda la foto del turno y calcula la diferencia", () => {
  const caja = cajaService.actual();
  cajaService.movimiento(caja.id, admin, "egreso", "Pago a proveedor", 300);
  const r = cajaService.resumen(caja.id);
  // inicial 1000 + efectivo cobrado − egresos
  assert.equal(r.esperado, 1000 + r.efectivo - 300);
  cajaService.cerrar(caja.id, admin, r.esperado - 50, "faltan 50");
  const c = db.prepare("SELECT * FROM cajas WHERE id = ?").get(caja.id);
  assert.equal(c.estado, "cerrada");
  assert.equal(c.diferencia, -50);
  assert.equal(c.total_ventas, r.totalVentas);
  assert.equal(cajaService.actual(), undefined);
  assert.ok(db.prepare("SELECT * FROM v_resumen_diario").get().cant_ventas >= 2);
});

test.after(() => { db.close(); for (const s of ["", "-wal", "-shm"]) try { require("fs").unlinkSync(process.env.DB_PATH + s); } catch {} });
