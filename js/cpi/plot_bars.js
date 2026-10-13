import * as d3 from 'd3';
import { PT, regionColor, showTip, hideTip } from './shared.js';

// Anos exibidos: todos os do CSV, de 2012 a 2024 (13 barras por país).
const YEARS = d3.range(2012, 2025);

// Cor de cada ano: gradiente do azul (2012) ao vermelho (2024), interpolado no espaço Lab para que os anos
// intermediários tenham passos de cor perceptualmente uniformes. As pontas mantêm as cores do desenho anterior.
const yearColor = d3.scaleLinear().domain([2012, 2024]).range(["#2563eb", "#dc2626"]).interpolate(d3.interpolateLab);

/**
 * drawBars — desenha o Design 1: barras agrupadas por país, com uma barra para CADA ano de 2012 a 2024.
 * Como: (1) filtra as entidades marcadas, agrupa por continente (ordem fixa) e ordena dentro de cada um pelo
 * critério escolhido em #barSort (nome, CPI 2012, CPI 2024 ou variação); (2) pede ao DuckDB (cpi.series) todos os
 * pontos desses países e monta, por país, um mapa ano→valor; (3) calcula a geometria: cada país ocupa um grupo de
 * 13 barras de largura fixa, e os grupos ficam separados por um espaço maior, com a posição horizontal de cada
 * grupo = margem + índice × passo; (4) desenha a legenda de cores por ano, uma faixa de fundo com o título de cada
 * continente, as barras (altura = y(0) - y(valor), em escala única de 0 a 100 a partir do zero), o valor do CPI no
 * topo de cada barra ("s/d" nos anos sem dado) e o nome de cada país sob o grupo; (5) a dica de mouse mostra país,
 * continente, ano e valor da barra; (6) confere se o número de barras desenhadas é igual ao de valores do CSV para
 * esses países e escreve o resultado em #recon1. Dentro de cada grupo os anos seguem da esquerda (2012) para a
 * direita (2024). O gráfico é reconstruído do zero a cada chamada.
 *  - cpi: instância de Cpi (consultas); entities: entidades com CPI; selected: Set com os países marcados.
 */
export async function drawBars(cpi, entities, selected) {
  const key = document.getElementById("barSort").value, regs = Object.keys(PT);
  document.getElementById("selCount").textContent = `${selected.size} país(es) selecionado(s)`;

  /**
   * val — valor usado para ordenar (CPI 2012, CPI 2024 ou variação).
   * Como: devolve -Infinity quando o valor é nulo, para que países sem dado fiquem por último na ordem decrescente.
   */
  const val = d => d[key] == null ? -Infinity : d[key];

  const data = entities.filter(e => selected.has(e.country)).sort((a, b) =>
    regs.indexOf(a.region) - regs.indexOf(b.region) || (key === "country" ? a.country.localeCompare(b.country) : val(b) - val(a)));
  const host = d3.select("#chart1").html(""), recon = document.getElementById("recon1");
  if (!data.length) { host.append("p").attr("class", "sub").text("Selecione ao menos um país acima."); recon.textContent = ""; return; }

  // todos os anos dos países marcados: país -> (ano -> CPI)
  const rows = await cpi.series(data.map(d => d.country));
  const byCountry = d3.rollup(rows, v => new Map(v.map(r => [r.year, r.score])), r => r.country);

  // geometria: 13 barras de 15 px por país; 70 px de espaço entre países diferentes
  const BW = 15, GW = YEARS.length * BW, STEP = GW + 70, PLOTH = 330;
  const m = { t: 70, r: 20, b: 50, l: 20 }, W = Math.max(700, m.l + m.r + STEP * data.length), H = m.t + PLOTH + m.b;
  const gx = new Map(data.map((d, i) => [d.country, m.l + i * STEP]));   // x inicial do grupo de cada país
  const y = d3.scaleLinear([0, 100], [m.t + PLOTH, m.t]);
  const svg = host.append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W);

  // legenda: um retângulo colorido por ano, com o ano escrito abaixo
  YEARS.forEach((yr, i) => {
    svg.append("rect").attr("x", m.l + i * 34).attr("y", 8).attr("width", 30).attr("height", 10).attr("fill", yearColor(yr));
    svg.append("text").attr("x", m.l + i * 34 + 15).attr("y", 32).attr("text-anchor", "middle").style("font-size", "10px").text(yr);
  });
  svg.append("text").attr("x", m.l + YEARS.length * 34 + 16).attr("y", 18).style("fill", "#6b7280")
    .text("CPI de 0 (muito corrupto) a 100 (muito limpo) · eixo começa em zero · em cada país, os anos vão de 2012 (esquerda) a 2024 (direita)");

  // faixa de fundo e título de cada continente
  regs.forEach(r => {
    const g = data.filter(d => d.region === r); if (!g.length) return;
    const xa = gx.get(g[0].country) - 8, xb = gx.get(g[g.length - 1].country) + GW + 8;
    svg.append("rect").attr("x", xa).attr("y", m.t - 16).attr("width", xb - xa).attr("height", PLOTH + 16 + 34).attr("fill", regionColor(r)).attr("fill-opacity", .08);
    svg.append("text").attr("x", xa + 4).attr("y", m.t - 5).style("font-weight", 600).text(PT[r]);
  });

  // uma célula por país e ano; só as que têm valor viram barra, as demais mostram "s/d"
  const cells = data.flatMap(d => YEARS.map(yr => ({ country: d.country, region: d.region, yr, v: byCountry.get(d.country)?.get(yr) ?? null, x: gx.get(d.country) + (yr - 2012) * BW })));
  svg.selectAll("rect.b").data(cells.filter(c => c.v != null)).join("rect").attr("class", "b")
    .attr("x", c => c.x).attr("width", BW - 2).attr("y", c => y(c.v)).attr("height", c => y(0) - y(c.v)).attr("fill", c => yearColor(c.yr))
    .on("mousemove", (e, c) => showTip(e, `<b>${c.country}</b> (${PT[c.region]})<br>${c.yr}: ${c.v}`)).on("mouseleave", hideTip);
  svg.selectAll("text.v").data(cells).join("text").attr("class", "v")
    .attr("x", c => c.x + (BW - 2) / 2).attr("y", c => (c.v == null ? y(0) : y(c.v)) - 3).attr("text-anchor", "middle")
    .style("font-size", c => c.v == null ? "7px" : "9px").style("fill", c => c.v == null ? "#9ca3af" : null)
    .text(c => c.v == null ? "s/d" : c.v);                                       // valor do CPI no topo de cada barra

  // nome de cada país, centralizado sob o seu grupo de barras
  svg.selectAll("text.cn").data(data).join("text").attr("class", "cn")
    .attr("x", d => gx.get(d.country) + GW / 2).attr("y", m.t + PLOTH + 20).attr("text-anchor", "middle").style("font-weight", 600).text(d => d.country);

  // conferência: barras desenhadas × valores do CSV para os países escolhidos
  const shown = svg.selectAll("rect.b").size(), exp = await cpi.countValues(data.map(d => d.country));
  recon.textContent = `Conferência: ${data.length} países · ${shown} de ${exp} valores de CPI do CSV desenhados ${shown === exp ? "✓ nenhum valor perdido" : "✗ DIVERGÊNCIA"}`;
}
