const router = require("express").Router();
const c = require("../controllers/configController");
const { requiereRol } = require("../middlewares/auth");

router.use(requiereRol("admin"));
router.get("/", c.ver);
router.post("/", c.guardar);
router.get("/respaldo", c.respaldo);

module.exports = router;
