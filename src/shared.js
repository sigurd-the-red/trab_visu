import * as d3 from 'd3';

// Nomes dos continentes em português, na ordem fixa usada em seletores e gráficos.
// As chaves são os valores da coluna "World regions according to OWID".
export const PT = {
  "Africa": "África", "Asia": "Ásia", "Europe": "Europa",
  "North America": "América do Norte", "Oceania": "Oceania", "South America": "América do Sul"
};

// Cor de cada continente (usada nas faixas de fundo do Design 1).
export const regionColor = d3.scaleOrdinal(Object.keys(PT),
  ["#c0392b", "#2980b9", "#27ae60", "#8e44ad", "#d68910", "#148f77"]);

/**
 * sign — formata uma variação numérica com sinal explícito.
 * Como: se o valor é positivo, antepõe "+"; zero e negativos já saem corretos ("0", "-9").
 */
export const sign = v => (v > 0 ? "+" : "") + v;

/**
 * showTip — mostra a dica (tooltip) ao lado do cursor com um trecho de HTML.
 * Como: seleciona o elemento #tip, troca seu conteúdo, torna-o visível (opacity 1) e o posiciona com
 * position:fixed a 12 px do ponteiro, usando as coordenadas de tela do evento (clientX/clientY).
 */
export const showTip = (e, html) => d3.select("#tip").html(html).style("opacity", 1)
  .style("left", (e.clientX + 12) + "px").style("top", (e.clientY + 12) + "px");

/**
 * hideTip — esconde a dica.
 * Como: volta a opacidade do #tip para 0 (o elemento tem pointer-events:none, então nunca bloqueia o mouse).
 */
export const hideTip = () => d3.select("#tip").style("opacity", 0);
