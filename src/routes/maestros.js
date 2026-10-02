// Arma el router de un maestro simple a partir de su controlador
const express = require("express");
const { requiereRol } = require("../middlewares/auth");

module.exports = (c, escribe = ["admin", "cajero"]) => {
  const router = express.Router();
  router.get("/", c.listar);
  router.post("/", requiereRol(...escribe), c.crear);
  router.put("/:id", requiereRol(...escribe), c.actualizar);
  router.delete("/:id", requiereRol("admin"), c.eliminar);
  return router;
};
