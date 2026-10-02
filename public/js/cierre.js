/* ===== Cierre de caja: muestra la diferencia mientras se cuenta ===== */
(function () {
  "use strict";
  const form = document.getElementById("form-cierre");
  const campo = document.getElementById("monto_contado");
  const caja = document.getElementById("diferencia");
  const esperado = Number(form.dataset.esperado);

  campo.addEventListener("input", () => {
    if (campo.value.trim() === "") { caja.hidden = true; return; }
    const dif = App.redondear(App.dinero(campo.value) - esperado);
    caja.hidden = false;
    caja.className = "diferencia " + (dif === 0 ? "cero" : dif < 0 ? "falta" : "sobra");
    caja.textContent = dif === 0 ? "Caja cuadrada ✔" : (dif < 0 ? "Faltante: " : "Sobrante: ") + App.precio(Math.abs(dif));
  });
})();
