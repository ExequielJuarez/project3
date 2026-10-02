// Prepara la base de datos MySQL: crea la base y las tablas (database/schema.sql) y el usuario inicial.
//   npm run db:instalar         → base vacía lista para usar
//   npm run db:demo             → además carga productos de ejemplo
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const db = require("../src/config/db");
const instalar = require("../src/config/instalador");

(async () => {
  await instalar();
  console.log(`🗄️  Base de datos "${db.opciones.database}" lista en ${db.opciones.host}`);
  if (process.argv.includes("--demo")) {
    const c = await mysql.createConnection({ ...db.opciones, multipleStatements: true, charset: "utf8mb4" });
    await c.query(fs.readFileSync(path.join(__dirname, "datos-demo.sql"), "utf8"));
    await c.end();
    console.log("📦 Datos de ejemplo cargados (productos, categorías, un cliente y un proveedor).");
  }
  const { n } = await db.uno("SELECT COUNT(*) AS n FROM productos");
  console.log(`   Productos cargados: ${n}`);
  await db.cerrar();
})().catch((e) => {
  console.error("❌ No se pudo preparar la base:", e.message);
  console.error("   Revisá DB_HOST, DB_USER, DB_PASSWORD en el .env y que MySQL esté encendido.");
  process.exit(1);
});
