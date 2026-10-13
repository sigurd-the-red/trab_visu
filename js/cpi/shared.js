import * as d3 from 'd3';

//Nomes dos continentes
export const PT = {
  "Africa": "África", "Asia": "Ásia", "Europe": "Europa",
  "North America": "América do Norte", "Oceania": "Oceania", "South America": "América do Sul"
};

//Cor de cada continente
export const regionColor = d3.scaleOrdinal(Object.keys(PT),
  ["#c0392b", "#2980b9", "#27ae60", "#8e44ad", "#d68910", "#148f77"]);

//Revela o valor se mouse passa encima
export const showTip = (e, html) => d3.select("#tip").html(html).style("opacity", 1)
  .style("left", (e.clientX + 12) + "px").style("top", (e.clientY + 12) + "px");

//esconde a tip
export const hideTip = () => d3.select("#tip").style("opacity", 0);
