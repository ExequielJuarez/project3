const router = require("express").Router();
const c = require("../controllers/productoController");
const { requiereRol } = require("../middlewares/auth");

router.get("/", c.listar);
router.use(requiereRol("admin"));
router.get("/nuevo", c.nuevo);
router.post("/", c.crear);
router.get("/:id/editar", c.editar);
router.put("/:id", c.actualizar);
router.post("/:id/ajuste", c.ajustar);
router.delete("/:id", c.desactivar);

module.exports = router;
