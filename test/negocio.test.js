// Prueba la lógica de negocio contra una base MySQL de pruebas: npm test
// Usa la conexión del .env pero con la base "<DB_NAME>_test" (se recrea vacía en cada corrida).
const test = require("node:test");
const assert = require("node:assert/strict");
const mysql = require("mysql2/promise");

require("dotenv").config();
process.env.DB_NAME = `${process.env.DB_NAME || "negocio_db"}_test`;

const db = require("../src/config/db");
const instalar = require("../src/config/instalador");
const cajaService = require("../src/services/cajaService");
const ventaService = require("../src/services/ventaService");
const productoService = require("../src/services/productoService");
const compraService = require("../src/services/compraService");

let admin;
const crearProducto = (nombre, precio, stock, codigo) =>
  productoService.crear({ codigo_barras: codigo, codigo_interno: null, nombre, categoria_id: null, costo: precio / 2, precio, stock_minimo: 0, unidad: "u", activo: 1 }, stock, admin);

test.before(async () => {
  const { database, ...conexion } = db.opciones;
  const c = await mysql.createConnection(conexion);
  await c.query(`DROP DATABASE IF EXISTS \`${database}\``);
  await c.end();
  await instalar();
  admin = (await db.uno("SELECT id FROM usuarios WHERE usuario = 'admin'")).id;
});

test("la pistola encuentra el producto por código de barras o interno", async () => {
  const id = await crearProducto("Galletitas", 1000, 10, "7790001");
  await db.run("UPDATE productos SET codigo_interno = '55' WHERE id = ?", [id]);
  assert.equal((await productoService.porCodigo("7790001")).id, id);
  assert.equal((await productoService.porCodigo("55")).id, id);
  assert.equal(await productoService.porCodigo("no-existe"), undefined);
});

test("no se repite un código de barras", async () => {
  await assert.rejects(() => crearProducto("Otro", 5, 0, "7790001"), (e) => db.esDuplicado(e));
});

test("se abre la caja con monto inicial y no puede haber dos abiertas", async () => {
  assert.equal(await cajaService.actual(), undefined);
  await cajaService.abrir(admin, 1000);
  await assert.rejects(() => cajaService.abrir(admin, 5), /Ya hay una caja abierta/);
});

test("una venta descuenta stock, numera la factura y calcula el vuelto", async () => {
  const caja = await cajaService.actual();
  const id = (await productoService.porCodigo("7790001")).id;
  const r = await ventaService.crear({ usuarioId: admin, cajaId: caja.id, items: [{ producto_id: id, cantidad: 3 }], descuento: 0, pagos: { efectivo: 5000 } });
  assert.equal(r.numero, "0001-00000001");
  assert.equal(r.total, 3000);
  assert.equal(r.vuelto, 2000);
  assert.equal((await productoService.obtener(id)).stock, 7);
});

test("si algo falla no se guarda nada (ni stock ni número de factura)", async () => {
  const caja = await cajaService.actual();
  const a = (await productoService.porCodigo("7790001")).id;
  const b = await crearProducto("Alfajor", 500, 1, "7790002");
  await assert.rejects(
    () => ventaService.crear({ usuarioId: admin, cajaId: caja.id, items: [{ producto_id: a, cantidad: 2 }, { producto_id: b, cantidad: 5 }], pagos: { efectivo: 99999 } }),
    /Stock insuficiente/);
  assert.equal((await productoService.obtener(a)).stock, 7);
  assert.equal((await db.uno("SELECT COUNT(*) AS n FROM ventas")).n, 1);
  await assert.rejects(() => ventaService.crear({ usuarioId: admin, cajaId: caja.id, items: [{ producto_id: a, cantidad: 1 }], pagos: { efectivo: 10 } }), /no alcanza/);
});

test("dos cajas vendiendo a la vez el último producto: solo una lo consigue", async () => {
  const caja = await cajaService.actual();
  const id = await crearProducto("Último", 100, 1, "7790003");
  const vender = () => ventaService.crear({ usuarioId: admin, cajaId: caja.id, items: [{ producto_id: id, cantidad: 1 }], pagos: { efectivo: 100 } });
  const r = await Promise.allSettled([vender(), vender()]);
  assert.equal(r.filter((x) => x.status === "fulfilled").length, 1);
  assert.equal((await productoService.obtener(id)).stock, 0);
});

test("pago mixto: el vuelto solo sale del efectivo", async () => {
  const caja = await cajaService.actual();
  const a = (await productoService.porCodigo("7790001")).id;
  const r = await ventaService.crear({ usuarioId: admin, cajaId: caja.id, items: [{ producto_id: a, cantidad: 1 }], pagos: { efectivo: 200, tarjeta: 900 } });
  assert.equal(r.vuelto, 100);
  const v = await ventaService.obtener(r.id);
  assert.equal(v.pago_efectivo, 100);
  assert.equal(v.pago_tarjeta, 900);
  await assert.rejects(() => ventaService.crear({ usuarioId: admin, cajaId: caja.id, items: [{ producto_id: a, cantidad: 1 }], pagos: { tarjeta: 1500 } }), /vuelto/);
});

test("anular devuelve el stock y deja de contar en los totales", async () => {
  const caja = await cajaService.actual();
  const a = (await productoService.porCodigo("7790001")).id;
  const antes = (await productoService.obtener(a)).stock;
  const r = await ventaService.crear({ usuarioId: admin, cajaId: caja.id, items: [{ producto_id: a, cantidad: 2 }], pagos: { efectivo: 2000 } });
  const totalAntes = (await cajaService.resumen(caja.id)).totalVentas;
  await ventaService.anular(r.id, admin, "prueba");
  assert.equal((await productoService.obtener(a)).stock, antes);
  assert.equal((await cajaService.resumen(caja.id)).totalVentas, totalAntes - 2000);
  await assert.rejects(() => ventaService.anular(r.id, admin, "otra vez"), /ya estaba anulada/);
});

test("la compra a proveedor suma stock y actualiza el costo", async () => {
  const a = (await productoService.porCodigo("7790001")).id;
  const antes = (await productoService.obtener(a)).stock;
  await compraService.crear({ usuarioId: admin, items: [{ producto_id: a, cantidad: 10, costo: 700 }] });
  const p = await productoService.obtener(a);
  assert.equal(p.stock, antes + 10);
  assert.equal(p.costo, 700);
});

test("el cierre de caja guarda la foto del turno y calcula la diferencia", async () => {
  const caja = await cajaService.actual();
  await cajaService.movimiento(caja.id, admin, "egreso", "Pago a proveedor", 300);
  const r = await cajaService.resumen(caja.id);
  assert.equal(r.esperado, 1000 + r.efectivo - 300); // inicial + efectivo cobrado − egresos
  await cajaService.cerrar(caja.id, admin, r.esperado - 50, "faltan 50");
  const c = await db.uno("SELECT * FROM cajas WHERE id = ?", [caja.id]);
  assert.equal(c.estado, "cerrada");
  assert.equal(c.diferencia, -50);
  assert.equal(c.total_ventas, r.totalVentas);
  assert.equal(await cajaService.actual(), undefined);
  assert.ok((await db.uno("SELECT * FROM v_resumen_diario")).cant_ventas >= 2);
});

test.after(() => db.cerrar());
