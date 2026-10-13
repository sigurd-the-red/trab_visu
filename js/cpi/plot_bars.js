import * as d3 from 'd3';
import { PT, regionColor, showTip, hideTip } from './shared.js';

const YEARS = d3.range(2012, 2025);

//Cor de cada ano
const yearColor = d3.scaleLinear().domain([2012, 2024]).range(["#8fd3c1", "#0b1f4d"]).interpolate(d3.interpolateLab);

/**
 * DESIGN 1
 * consulta os dados por meio do metodo cpi.series, da uma cor p/cada ano, desenha uma barra por ano
 * p/cada pais. escreve o valor no topo da barra e o nome do pais embaixo. No hover, mostra ano e valor da barra.
 */
export async function drawBars(cpi, entities, selected) {
  const key = document.getElementById("barSort").value, regs = Object.keys(PT);
  document.getElementById("selCount").textContent = `${selected.size} país(es) selecionado(s)`;
  const val = d => d[key] == null ? -Infinity : d[key];

  const data = entities.filter(e => selected.has(e.country)).sort((a, b) =>
    regs.indexOf(a.region) - regs.indexOf(b.region) || (key === "country" ? a.country.localeCompare(b.country) : val(b) - val(a)));
  const host = d3.select("#chart1").html(""), recon = document.getElementById("recon1");
    if (!data.length)
    {
        host.append("p").attr("class", "sub").text("Selecione ao menos um país acima.");
        recon.textContent = "";
        return;
    }

  const rows = await cpi.series(data.map(d => d.country));
  const byCountry = d3.rollup(rows, v => new Map(v.map(r => [r.year, r.score])), r => r.country);

  //13 barras por pais, com espaco entre paises diferentes
  const BW = 15, GW = YEARS.length * BW, STEP = GW + 70, PLOTH = 330;
  const m = { t: 70, r: 20, b: 50, l: 20 }, W = Math.max(700, m.l + m.r + STEP * data.length), H = m.t + PLOTH + m.b;
  const gx = new Map(data.map((d, i) => [d.country, m.l + i * STEP]));   // x inicial do grupo de cada país
  const y = d3.scaleLinear([0, 100], [m.t + PLOTH, m.t]);
  const svg = host.append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W);

  //legenda(um retangulo colorido por ano, com o ano escrito abaixo)
  YEARS.forEach((yr, i) => {
    svg.append("rect").attr("x", m.l + i * 34).attr("y", 8).attr("width", 30).attr("height", 10).attr("fill", yearColor(yr));
    svg.append("text").attr("x", m.l + i * 34 + 15).attr("y", 32).attr("text-anchor", "middle").style("font-size", "10px").text(yr);
  });
  svg.append("text").attr("x", m.l + YEARS.length * 34 + 16).attr("y", 18).style("fill", "#6b7280")
    .text("CPI de 0 (muito corrupto) a 100 (muito limpo) · eixo começa em zero · em cada país, os anos vão de 2012 (esquerda) a 2024 (direita)");

  //faixa de fundo e titulo de cada continente
  regs.forEach(r => {
    const g = data.filter(d => d.region === r); if (!g.length) return;
    const xa = gx.get(g[0].country) - 8, xb = gx.get(g[g.length - 1].country) + GW + 8;
    svg.append("rect").attr("x", xa).attr("y", m.t - 16).attr("width", xb - xa).attr("height", PLOTH + 16 + 34).attr("fill", regionColor(r)).attr("fill-opacity", .08);
    svg.append("text").attr("x", xa + 4).attr("y", m.t - 5).style("font-weight", 600).text(PT[r]);
  });

  //uma barra por pais/ano. sem valor = "s/d"
  const cells = data.flatMap(d => YEARS.map(yr => ({ country: d.country, region: d.region, yr, v: byCountry.get(d.country)?.get(yr) ?? null, x: gx.get(d.country) + (yr - 2012) * BW })));
  svg.selectAll("rect.b").data(cells.filter(c => c.v != null)).join("rect").attr("class", "b")
    .attr("x", c => c.x).attr("width", BW - 2).attr("y", c => y(c.v)).attr("height", c => y(0) - y(c.v)).attr("fill", c => yearColor(c.yr))
    .on("mousemove", (e, c) => showTip(e, `<b>${c.country}</b> (${PT[c.region]})<br>${c.yr}: ${c.v}`)).on("mouseleave", hideTip);
  svg.selectAll("text.v").data(cells).join("text").attr("class", "v")
    .attr("x", c => c.x + (BW - 2) / 2).attr("y", c => (c.v == null ? y(0) : y(c.v)) - 3).attr("text-anchor", "middle")
    .style("font-size", c => c.v == null ? "7px" : "9px").style("fill", c => c.v == null ? "#9ca3af" : null)
    .text(c => c.v == null ? "s/d" : c.v);                                       // valor do CPI no topo de cada barra

  //nome de cada pais centralizado
  svg.selectAll("text.cn").data(data).join("text").attr("class", "cn")
    .attr("x", d => gx.get(d.country) + GW / 2).attr("y", m.t + PLOTH + 20).attr("text-anchor", "middle").style("font-weight", 600).text(d => d.country);
}
