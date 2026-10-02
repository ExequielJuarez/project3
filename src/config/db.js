// Conexión a SQLite (better-sqlite3): rápida, sin servidor aparte y con
// transacciones, ideal para un negocio con una o varias cajas en un mismo local.
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");
const bcrypt = require("bcryptjs");

const RAIZ = path.join(__dirname, "../..");
const rutaDb = path.resolve(RAIZ, process.env.DB_PATH || "database/negocio.db");
fs.mkdirSync(path.dirname(rutaDb), { recursive: true });

const db = new Database(rutaDb);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

// Crea las tablas que falten (no borra nada)
db.exec(fs.readFileSync(path.join(RAIZ, "database/schema.sql"), "utf8"));

const CONFIG_INICIAL = {
  negocio_nombre: "Mi Negocio",
  negocio_cuit: "",
  negocio_direccion: "",
  negocio_telefono: "",
  punto_venta: "1",
  proximo_numero: "1",
  pie_ticket: "¡Gracias por su compra!",
  stock_negativo: "0",
  descuento_maximo: "100",
};
const insertarConfig = db.prepare("INSERT OR IGNORE INTO configuracion (clave, valor) VALUES (?, ?)");
for (const [k, v] of Object.entries(CONFIG_INICIAL)) insertarConfig.run(k, v);

// Primer arranque: usuario administrador que debe cambiar su clave
if (db.prepare("SELECT COUNT(*) n FROM usuarios").get().n === 0) {
  db.prepare(
    "INSERT INTO usuarios (nombre, usuario, clave_hash, rol, debe_cambiar_clave) VALUES (?,?,?,?,1)"
  ).run("Administrador", "admin", bcrypt.hashSync("admin123", 10), "admin");
  console.log("👤 Usuario inicial creado → usuario: admin · clave: admin123 (te pedirá cambiarla)");
}

db.rutaArchivo = rutaDb;
module.exports = db;
