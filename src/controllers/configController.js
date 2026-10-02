const db = require("../config/db");
const configService = require("../services/configService");

exports.ver = async (req, res) => res.render("config/index", { titulo: "Configuración", c: await configService.todo() });

exports.guardar = async (req, res) => {
  const b = req.body;
  const desc = Math.min(100, Math.max(0, Number(b.descuento_maximo) || 0));
  const pv = Math.max(1, parseInt(b.punto_venta, 10) || 1);
  await configService.guardar({
    negocio_nombre: (b.negocio_nombre || "").trim() || "Mi Negocio",
    negocio_cuit: (b.negocio_cuit || "").trim(),
    negocio_direccion: (b.negocio_direccion || "").trim(),
    negocio_telefono: (b.negocio_telefono || "").trim(),
    pie_ticket: (b.pie_ticket || "").trim(),
    punto_venta: pv,
    descuento_maximo: desc,
    stock_negativo: b.stock_negativo ? "1" : "0",
  });
  req.flash("ok", "Configuración guardada");
  res.redirect("/configuracion");
};

// Respaldo: archivo .sql con todos los datos (se restaura con el cliente de MySQL).
// Primero se crean las tablas con database/schema.sql y después se ejecuta este archivo.
const TABLAS = ["configuracion", "usuarios", "categorias", "productos", "clientes", "proveedores", "cajas", "caja_movimientos",
  "ventas", "venta_items", "stock_movimientos", "compras", "compra_items"];

exports.respaldo = async (req, res) => {
  const partes = [`-- Respaldo ${new Date().toISOString()}\nSET FOREIGN_KEY_CHECKS=0;\nSET NAMES utf8mb4;\n`];
  for (const tabla of TABLAS) {
    const filas = await db.todos(`SELECT * FROM \`${tabla}\``);
    if (!filas.length) continue;
    // Las columnas generadas no se pueden insertar
    const cols = Object.keys(filas[0]).filter((c) => c !== "abierta_unica");
    partes.push(`-- ${tabla}\nINSERT INTO \`${tabla}\` (${cols.map((c) => `\`${c}\``).join(", ")}) VALUES\n` +
      filas.map((f) => "(" + cols.map((c) => db.pool.escape(f[c])).join(", ") + ")").join(",\n") + ";\n");
  }
  partes.push("SET FOREIGN_KEY_CHECKS=1;\n");
  const nombre = `respaldo_${new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-")}.sql`;
  res.set({ "Content-Type": "application/sql; charset=utf-8", "Content-Disposition": `attachment; filename="${nombre}"` });
  res.send(partes.join("\n"));
};
