require("dotenv").config();
const crypto = require("crypto");
const path = require("path");
const express = require("express");
const session = require("express-session");
const methodOverride = require("method-override");

const db = require("./config/db");
const formato = require("./helpers/formato");
const configService = require("./services/configService");
const cajaService = require("./services/cajaService");
const csrf = require("./middlewares/csrf");
const { requiereLogin } = require("./middlewares/auth");

const app = express();
const puerto = Number(process.env.PORT) || 3000;

app.disable("x-powered-by");
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use(express.static(path.join(__dirname, "../public"), { maxAge: "1h" }));
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "1mb" }));
app.use(methodOverride("_method"));

if (!process.env.SESSION_SECRET) {
  console.warn("⚠️  Falta SESSION_SECRET en .env: se usa uno temporal (las sesiones se pierden al reiniciar).");
}
app.use(
  session({
    name: "negocio.sid",
    secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString("hex"),
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: "lax", maxAge: 1000 * 60 * 60 * 12 },
  })
);

// Mensajes de un solo uso (flash)
app.use((req, res, next) => {
  req.flash = (tipo, mensaje) => { req.session.flash = { tipo, mensaje }; };
  res.locals.flash = req.session.flash || null;
  delete req.session.flash;
  next();
});

Object.assign(app.locals, formato);
app.use((req, res, next) => {
  res.locals.usuario = req.session.usuario || null;
  res.locals.rutaActual = req.path;
  res.locals.titulo = "";
  if (req.session.usuario) {
    res.locals.negocio = configService.todo();
    res.locals.cajaActual = cajaService.actual() || null;
  }
  next();
});

app.use(csrf);
app.use("/", require("./routes/auth.routes"));
app.use(requiereLogin);
app.use("/", require("./routes/panel.routes"));
app.use("/api", require("./routes/api.routes"));
app.use("/productos", require("./routes/productos.routes"));
app.use("/categorias", require("./routes/categorias.routes"));
app.use("/clientes", require("./routes/clientes.routes"));
app.use("/proveedores", require("./routes/proveedores.routes"));
app.use("/compras", require("./routes/compras.routes"));
app.use("/ventas", require("./routes/ventas.routes"));
app.use("/caja", require("./routes/caja.routes"));
app.use("/reportes", require("./routes/reportes.routes"));
app.use("/usuarios", require("./routes/usuarios.routes"));
app.use("/configuracion", require("./routes/configuracion.routes"));

app.use((req, res) => {
  if (req.originalUrl.startsWith("/api/")) return res.status(404).json({ ok: false, mensaje: "No encontrado" });
  res.status(404).render("error", { titulo: "No encontrado", mensaje: "La página que buscás no existe." });
});

app.use((err, req, res, next) => {
  console.error("❌", err);
  if (req.originalUrl.startsWith("/api/") || req.accepts(["html", "json"]) === "json") {
    return res.status(500).json({ ok: false, mensaje: "Error del servidor, probá de nuevo" });
  }
  res.status(500).render("error", { titulo: "Algo salió mal", mensaje: "Ocurrió un error inesperado. Probá de nuevo." });
});

if (require.main === module) {
  app.listen(puerto, () => {
    console.log(`🚀 Sistema listo en http://localhost:${puerto}`);
    console.log(`🗄️  Base de datos: ${db.rutaArchivo}`);
  });
}
module.exports = app;
