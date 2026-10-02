/* ===== Consultar precio con la pistola ===== */
(function () {
  "use strict";
  const entrada = document.getElementById("entrada");
  const salida = document.getElementById("resultado");
  let temporizador;

  const vacio = () => {
    salida.innerHTML = '<div class="estado-vacio"><svg class="ico"><use href="#i-precio"/></svg><p>Esperando un producto…</p></div>';
  };
  function mostrar(p) {
    const bajo = p.stock <= p.stock_minimo;
    salida.innerHTML = `
      <div class="consulta-nombre">${App.esc(p.nombre)}</div>
      <div class="consulta-precio num">${App.precio(p.precio)}</div>
      <div class="consulta-meta">
        <span class="insignia insignia-neutra">${App.esc(p.codigo_barras || p.codigo_interno || "sin código")}</span>
        ${p.categoria ? `<span class="insignia insignia-info">${App.esc(p.categoria)}</span>` : ""}
        <span class="insignia ${p.stock <= 0 ? "insignia-error" : bajo ? "insignia-alerta" : "insignia-ok"}">${p.stock <= 0 ? "Sin stock" : "Stock: " + App.cantidad(p.stock) + " " + App.esc(p.unidad)}</span>
      </div>`;
    clearTimeout(temporizador);
    temporizador = setTimeout(vacio, 30000); // se limpia solo para el próximo cliente
    App.pitido(true);
    entrada.value = ""; entrada.focus();
  }

  App.buscador({
    input: entrada, panel: document.getElementById("resultados"),
    alElegir: mostrar,
    alNoEncontrar: (c) => {
      salida.innerHTML = `<div class="consulta-no">No se encontró "${App.esc(c)}"</div><p class="suave">Revisá el código o buscá por nombre.</p>`;
    },
  });

  document.addEventListener("keydown", (e) => {
    const t = e.target;
    if (!/^(INPUT|SELECT|TEXTAREA)$/.test(t.tagName) && e.key.length === 1 && !e.ctrlKey && !e.metaKey) entrada.focus();
  });
  entrada.focus();
})();
