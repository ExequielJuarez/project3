const router = require("express").Router();
const c = require("../controllers/reporteController");
const { requiereRol } = require("../middlewares/auth");

router.use(requiereRol("admin"));
router.get("/", c.ver);
router.get("/ventas.csv", c.ventasCsv);

module.exports = router;
