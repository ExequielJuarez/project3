/* ===== Reportes: ancho de las barras (se define por JS para no usar estilos en línea) ===== */
document.querySelectorAll(".relleno[data-ancho]").forEach((el) => el.style.setProperty("--ancho", el.dataset.ancho + "%"));
