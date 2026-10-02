/* ===== Formulario de producto: margen de ganancia en vivo ===== */
(function () {
  "use strict";
  const costo = document.getElementById("costo"), precio = document.getElementById("precio"), margen = document.getElementById("margen");
  function calcular() {
    const c = App.dinero(costo.value), p = App.dinero(precio.value);
    if (!(p > 0) || Number.isNaN(c)) { margen.textContent = "—"; return; }
    const ganancia = p - c;
    margen.textContent = `${App.precio(ganancia)} (${((ganancia / p) * 100).toFixed(1).replace(".", ",")}%)`;
    margen.className = "negrita " + (ganancia < 0 ? "negativo" : "positivo");
  }
  costo.addEventListener("input", calcular);
  precio.addEventListener("input", calcular);
  calcular();
})();
