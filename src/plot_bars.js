import * as d3 from 'd3';
import { PT, regionColor, sign, showTip, hideTip } from './shared.js';

// Cores dos anos no Design 1: azul = 2012, vermelho = 2024.
const C12 = "#2563eb", C24 = "#dc2626";

/**
 * drawBars — desenha o Design 1: barras agrupadas por país (2012 azul ao lado de 2024 vermelho).
 * Como: (1) filtra as entidades marcadas, agrupa por continente (ordem fixa) e ordena dentro de cada um pelo
 * critério escolhido em #barSort; (2) cria as escalas: x0 (banda por país, com espaço entre países), x1 (duas
 * bandas coladas dentro do país, uma por ano) e y linear 0–100 a partir do zero; (3) desenha a legenda, uma
 * faixa de fundo com o título de cada continente, as barras (altura = y(0) - y(valor)), o valor do CPI no topo
 * de cada barra ("s/d" se não há dado) e os nomes dos países rotacionados; (4) a dica de mouse mostra 2012,
 * 2024 e a variação. O gráfico é reconstruído do zero a cada chamada. Não há eixo vertical nem grade, para
 * deixar a figura limpa: o valor está escrito em cada barra.
 *  - entities: entidades com CPI (do DuckDB); selected: Set com os países marcados.
 */
export function drawBars(entities, selected) {
  const key = document.getElementById("barSort").value, regs = Object.keys(PT);
  document.getElementById("selCount").textContent = `${selected.size} país(es) selecionado(s)`;

  /**
   * val — valor usado para ordenar (CPI 2012, CPI 2024 ou variação).
   * Como: devolve -Infinity quando o valor é nulo, para que países sem dado fiquem por último na ordem decrescente.
   */
  const val = d => d[key] == null ? -Infinity : d[key];

  const data = entities.filter(e => selected.has(e.country)).sort((a, b) =>
    regs.indexOf(a.region) - regs.indexOf(b.region) || (key === "country" ? a.country.localeCompare(b.country) : val(b) - val(a)));
  const host = d3.select("#chart1").html("");
  if (!data.length) { host.append("p").attr("class", "sub").text("Selecione ao menos um país acima."); return; }

  const m = { t: 46, r: 20, b: 120, l: 20 }, step = 64, W = Math.max(700, m.l + m.r + step * data.length), H = 420;
  const x0 = d3.scaleBand(data.map(d => d.country), [m.l, W - m.r]).paddingInner(.4);
  const x1 = d3.scaleBand(["2012", "2024"], [0, x0.bandwidth()]).padding(.04);   // as duas barras do país ficam juntas
  const y = d3.scaleLinear([0, 100], [H - m.b, m.t]);
  const svg = host.append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W);

  // legenda
  [["2012", C12], ["2024", C24]].forEach(([l, c], i) => { svg.append("rect").attr("x", m.l + i * 70).attr("y", 8).attr("width", 14).attr("height", 14).attr("fill", c); svg.append("text").attr("x", m.l + i * 70 + 20).attr("y", 20).text(l); });
  svg.append("text").attr("x", m.l + 150).attr("y", 20).style("fill", "#6b7280").text("CPI de 0 (muito corrupto) a 100 (muito limpo) · eixo começa em zero");

  // faixa e título de cada continente
  regs.forEach(r => {
    const g = data.filter(d => d.region === r); if (!g.length) return;
    const xa = x0(g[0].country) - 3, xb = x0(g[g.length - 1].country) + x0.bandwidth() + 3;
    svg.append("rect").attr("x", xa).attr("y", m.t - 16).attr("width", xb - xa).attr("height", H - m.b - m.t + 16).attr("fill", regionColor(r)).attr("fill-opacity", .08);
    svg.append("text").attr("x", xa + 4).attr("y", m.t - 5).style("font-weight", 600).text(PT[r]);
  });

  // barras (uma por ano); valor ausente vira "s/d"
  const groups = svg.selectAll("g.p").data(data).join("g").attr("class", "p").attr("transform", d => `translate(${x0(d.country)},0)`)
    .on("mousemove", (e, d) => showTip(e, `<b>${d.country}</b> (${PT[d.region]})<br>2012: ${d.s12 ?? "sem dado"} · 2024: ${d.s24 ?? "sem dado"}${d.d == null ? "" : ` (${sign(d.d)})`}`)).on("mouseleave", hideTip);
  [["s12", "2012", C12], ["s24", "2024", C24]].forEach(([k, yr, c]) => {
    groups.append("rect").attr("x", x1(yr)).attr("width", x1.bandwidth()).attr("fill", c)
      .attr("y", d => d[k] == null ? y(0) : y(d[k])).attr("height", d => d[k] == null ? 0 : y(0) - y(d[k]));
    groups.append("text").attr("x", x1(yr) + x1.bandwidth() / 2).attr("y", d => (d[k] == null ? y(0) : y(d[k])) - 3).attr("text-anchor", "middle").style("font-size", "10px")
      .text(d => d[k] == null ? "s/d" : d[k]);                                       // valor do CPI no topo de cada barra
  });
  // nomes dos países (rotacionados)
  svg.selectAll("text.cn").data(data).join("text").attr("class", "cn")
    .attr("transform", d => `translate(${x0(d.country) + x0.bandwidth() / 2},${H - m.b + 10}) rotate(-55)`).attr("text-anchor", "end").text(d => d.country);
}
