const db = require("../config/db");

const todo = async (ex = db) => Object.fromEntries((await ex.todos("SELECT clave, valor FROM configuracion")).map((r) => [r.clave, r.valor]));

const guardar = (obj) =>
  db.transaccion(async (t) => {
    for (const [k, v] of Object.entries(obj)) {
      await t.run("INSERT INTO configuracion (clave, valor) VALUES (?, ?) ON DUPLICATE KEY UPDATE valor = VALUES(valor)", [k, String(v ?? "")]);
    }
  });

module.exports = { todo, guardar };
