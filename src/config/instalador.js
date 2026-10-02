// Crea la base de datos y las tablas si faltan, y carga la configuración inicial.
const fs = require("fs");
const path = require("path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const db = require("./db");

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

async function instalar() {
  const { database, ...conexion } = db.opciones;
  // 1) La base de datos
  const admin = await mysql.createConnection({ ...conexion, multipleStatements: true });
  await admin.query(`CREATE DATABASE IF NOT EXISTS \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  // 2) Las tablas (database/schema.sql)
  await admin.query(`USE \`${database}\``);
  await admin.query(fs.readFileSync(path.join(__dirname, "../../database/schema.sql"), "utf8"));
  await admin.end();

  // 3) Configuración y usuario inicial
  for (const [k, v] of Object.entries(CONFIG_INICIAL)) {
    await db.run("INSERT IGNORE INTO configuracion (clave, valor) VALUES (?, ?)", [k, v]);
  }
  const { n } = await db.uno("SELECT COUNT(*) AS n FROM usuarios");
  if (n === 0) {
    await db.run("INSERT INTO usuarios (nombre, usuario, clave_hash, rol, debe_cambiar_clave) VALUES (?,?,?,?,1)", [
      "Administrador", "admin", bcrypt.hashSync("admin123", 10), "admin",
    ]);
    console.log("👤 Usuario inicial creado → usuario: admin · clave: admin123 (te pedirá cambiarla)");
  }
}

module.exports = instalar;
