const router = require("express").Router();
const c = require("../controllers/cajaController");

router.get("/", c.estado);
router.get("/abrir", c.formAbrir);
router.post("/abrir", c.abrir);
router.post("/movimientos", c.movimiento);
router.get("/cerrar", c.formCerrar);
router.post("/cerrar", c.cerrar);
router.get("/historial", c.historial);
router.get("/:id", c.detalle);

module.exports = router;
