/* ===== Comprobante: imprimir y alternar entre hoja y ticket de 80 mm ===== */
(function () {
  "use strict";
  const btnFormato = document.getElementById("btn-formato");
  const guardado = (() => { try { return localStorage.getItem("formatoComprobante"); } catch { return null; } })();
  const aplicar = (ticket) => {
    document.body.classList.toggle("modo-ticket", ticket);
    btnFormato.textContent = ticket ? "Cambiar a hoja A4" : "Cambiar a ticket 80 mm";
    try { localStorage.setItem("formatoComprobante", ticket ? "ticket" : "a4"); } catch { /* sin almacenamiento */ }
  };
  aplicar(guardado === "ticket");
  btnFormato.addEventListener("click", () => aplicar(!document.body.classList.contains("modo-ticket")));
  document.getElementById("btn-imprimir").addEventListener("click", () => window.print());
  if (new URLSearchParams(location.search).has("auto")) window.print();
})();
