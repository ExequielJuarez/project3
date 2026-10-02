// Prepara la base de datos: crea las tablas (database/schema.sql) y el usuario inicial.
//   npm run db:instalar         → base vacía lista para usar
//   npm run db:demo             → además carga productos de ejemplo
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const db = require("../src/config/db");

console.log(`🗄️  Base de datos lista en: ${db.rutaArchivo}`);
if (process.argv.includes("--demo")) {
  db.exec(fs.readFileSync(path.join(__dirname, "datos-demo.sql"), "utf8"));
  console.log("📦 Datos de ejemplo cargados (productos, categorías, un cliente y un proveedor).");
}
const { n } = db.prepare("SELECT COUNT(*) n FROM productos").get();
console.log(`   Productos cargados: ${n}`);
