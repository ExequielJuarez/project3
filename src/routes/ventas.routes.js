const router = require("express").Router();
const c = require("../controllers/ventaController");
const { requiereRol } = require("../middlewares/auth");

router.get("/", c.listar);
router.get("/:id", c.detalle);
router.get("/:id/imprimir", c.imprimir);
router.post("/:id/anular", requiereRol("admin"), c.anular);

module.exports = router;
