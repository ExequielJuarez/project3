const crear = require("../controllers/maestroController");
module.exports = require("./maestros")(
  crear({
    tabla: "clientes", titulo: "Clientes", singular: "un cliente", ruta: "/clientes",
    campos: [
      { nombre: "nombre", etiqueta: "Nombre", requerido: true },
      { nombre: "documento", etiqueta: "DNI / CUIT" },
      { nombre: "telefono", etiqueta: "Teléfono" },
      { nombre: "email", etiqueta: "Email", tipo: "email" },
      { nombre: "direccion", etiqueta: "Dirección", buscar: false },
    ],
  })
);
