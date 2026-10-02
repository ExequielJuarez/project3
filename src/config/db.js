// Conexión a MySQL (mysql2) con pool. Todas las consultas son asíncronas.
require("dotenv").config();
const mysql = require("mysql2/promise");

const opciones = {
  host: process.env.DB_HOST || "127.0.0.1",
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "negocio_db",
};
// Zona horaria del negocio (Argentina por defecto): afecta NOW() y CURDATE()
const zona = process.env.DB_TIMEZONE || "-03:00";

const pool = mysql.createPool({
  ...opciones,
  waitForConnections: true,
  connectionLimit: 10,
  charset: "utf8mb4",
  decimalNumbers: true, // los DECIMAL llegan como número y no como texto
  dateStrings: true,    // fechas como "2026-10-02 14:35:10" (sin conversiones de zona)
});
pool.pool.on("connection", (c) => c.query(`SET time_zone = '${zona}'`));

// Mismas funciones para el pool y para una conexión dentro de una transacción
const envolver = (ex) => ({
  // Devuelve todas las filas
  todos: async (sql, params) => (await ex.query(sql, params))[0],
  // Devuelve la primera fila (o undefined)
  uno: async (sql, params) => (await ex.query(sql, params))[0][0],
  // INSERT / UPDATE / DELETE → { insertId, affectedRows }
  run: async (sql, params) => (await ex.query(sql, params))[0],
});

const db = {
  ...envolver(pool),
  opciones,
  pool,
  // db.transaccion(async (t) => { ... }) → todo o nada. `t` tiene todos/uno/run.
  async transaccion(fn) {
    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      const resultado = await fn(envolver(conn));
      await conn.commit();
      return resultado;
    } catch (e) {
      await conn.rollback();
      throw e;
    } finally {
      conn.release();
    }
  },
  esDuplicado: (e) => e && e.code === "ER_DUP_ENTRY",
  cerrar: () => pool.end(),
};

module.exports = db;
