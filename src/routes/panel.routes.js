const router = require("express").Router();
const c = require("../controllers/panelController");
const { requiereCaja } = require("../middlewares/auth");

router.get("/", c.inicio);
router.get("/pos", requiereCaja, c.pos);
router.get("/precios", c.consultaPrecio);

module.exports = router;
