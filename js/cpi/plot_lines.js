import * as d3 from 'd3';
import { PT, showTip, hideTip } from './shared.js';

// Paleta categórica (13 cores): Okabe-Ito sem amarelo + Paul Tol "muted". Mais de ~10 matizes já é o limite da
// percepção; por isso, acima disso a cor se repete e a identificação passa a depender do rótulo direto e do destaque.
const LINE_COLORS = ["#0072B2", "#D55E00", "#009E73", "#CC79A7", "#56B4E9", "#E69F00", "#882255", "#117733", "#332288", "#AA4499", "#44AA99", "#999933", "#555555"];

/**
 * label — texto exibido no fim de cada linha e na dica.
 * Como: troca "Brazil" por "BRASIL" e coloca os demais nomes (que seguem o arquivo, em inglês) em maiúsculas.
 */
const label = c => c === "Brazil" ? "BRASIL" : c.toUpperCase();

/**
 * spread — afasta verticalmente rótulos que se sobreporiam.
 * Como: ordena os itens pela posição y real do fim da linha e define em "ly" (posição do rótulo) um mínimo de
 * "gap" pixels entre rótulos vizinhos, varrendo de cima para baixo. Se o último passar do limite "hi", sobe-o
 * até o limite e empurra os anteriores para cima, também respeitando o espaçamento. Modifica os itens
 * recebidos (campo ly); o rótulo fica o mais perto possível da linha que ele nomeia.
 */
function spread(items, gap, hi) {
  items.sort((a, b) => a.y - b.y);
  items.forEach((d, i) => d.ly = i ? Math.max(d.y, items[i - 1].ly + gap) : d.y);
  const over = items.length ? items[items.length - 1].ly - hi : 0;
  if (over > 0) { items[items.length - 1].ly -= over; for (let i = items.length - 2; i >= 0; i--) items[i].ly = Math.min(items[i].ly, items[i + 1].ly - gap); }
}

/**
 * drawLines — desenha o Design 2: um gráfico de linhas único com todos os países marcados, na mesma escala.
 * Como: (1) pede ao DuckDB (cpi.series) os pontos dos países marcados e monta, por país, a lista de pontos, um
 * mapa ano→valor e o último ponto; (2) ordena os países pelo valor final e atribui cores da paleta em ciclo, de
 * modo que linhas e rótulos vizinhos nunca repitam cor; (3) calcula a altura do gráfico para caber o maior grupo
 * de rótulos que terminam no mesmo ano e cria as escalas (x: 2012–2024, y: 0–100) e os eixos com grade leve;
 * (4) posiciona os rótulos finais com spread(); (5) para cada país desenha a linha (d3.line com defined, então
 * anos sem valor viram lacunas), os pontos, uma linha-guia curta e o nome no fim da linha, mais um traço
 * transparente e largo que amplia a área sensível ao mouse; (6) no hover destaca o país (classe "hot"), esmaece
 * os outros (classe "dim") e mostra nome, continente e valor do ano sob o cursor; (7) por fim confere se o número
 * de pontos desenhados é igual ao de valores do CSV para esses países e escreve o resultado em #recon.
 *  - cpi: instância de Cpi (consultas); entities: entidades com CPI; selected: Set com os países marcados.
 */
export async function drawLines(cpi, entities, selected) {
  const list = entities.filter(e => selected.has(e.country)).map(e => e.country);
  document.getElementById("selCount2").textContent = `${list.length} país(es) selecionado(s)`;
  const host = d3.select("#chart2").html(""), recon = document.getElementById("recon");
  if (!list.length) { host.append("p").attr("class", "sub").text("Selecione ao menos um país acima."); recon.textContent = ""; return; }

  // séries dos países escolhidos (SQL)
  const rows = await cpi.series(list);
  const series = d3.group(rows, r => r.country), regionOf = new Map(entities.map(e => [e.country, e.region]));
  const lines = list.map(c => { const pts = series.get(c); return { country: c, region: regionOf.get(c), pts, map: new Map(pts.map(p => [p.year, p.score])), last: pts[pts.length - 1] }; });

  lines.sort((a, b) => b.last.score - a.last.score).forEach((l, i) => l.color = LINE_COLORS[i % LINE_COLORS.length]);
  const many = lines.length > 25;                                   // com muitas linhas, marcadores menores
  // altura dinâmica: cabe o maior grupo de rótulos que terminam no mesmo ano (11,5 px por rótulo)
  const byEnd = d3.rollup(lines, v => v.length, l => l.last.year), maxGroup = d3.max(byEnd.values());
  const PLOTW = 700, ph = Math.min(2600, Math.max(440, maxGroup * 11.5)), m = { t: 24, r: 230, b: 40, l: 46 };
  const W = m.l + PLOTW + m.r, H = m.t + ph + m.b;
  const x = d3.scaleLinear([2012, 2024], [m.l, m.l + PLOTW]), y = d3.scaleLinear([0, 100], [m.t + ph, m.t]);
  const svg = host.append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("role", "img")
    .attr("aria-label", `Gráfico de linhas do CPI de 2012 a 2024 para ${lines.length} países`);

  // eixos (grade leve para ler os valores)
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(5).tickSize(-PLOTW));
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${m.t + ph})`).call(d3.axisBottom(x).tickValues(d3.range(2012, 2025)).tickFormat(d3.format("d")));
  svg.append("text").attr("x", m.l).attr("y", 12).style("fill", "#6b7280").text("CPI (0 = muito corrupto · 100 = muito limpo)");

  // posições dos rótulos finais, afastadas por grupo de ano final
  const items = lines.map(l => ({ l, x: x(l.last.year), y: y(l.last.score) }));
  d3.group(items, d => d.l.last.year).forEach(g => spread(g, 11.5, m.t + ph + 4));
  const pos = new Map(items.map(d => [d.l.country, d]));

  const line = d3.line().defined(p => p.score != null).x(p => x(p.year)).y(p => y(p.score));
  const gs = svg.selectAll("g.ln").data(lines).join("g").attr("class", "ln");
  gs.each(function (d) {
    const el = d3.select(this), col = d.color, full = d3.range(2012, 2025).map(yr => ({ year: yr, score: d.map.get(yr) ?? null }));   // lacunas quebram a linha
    el.append("path").attr("class", "vis").attr("d", line(full)).style("fill", "none").style("stroke", col).style("stroke-width", many ? 1.3 : 2).style("opacity", .9);
    el.append("path").attr("d", line(full)).style("fill", "none").style("stroke", "transparent").style("stroke-width", 12);   // área larga para o mouse
    el.selectAll("circle.v").data(d.pts).join("circle").attr("class", "v").attr("cx", p => x(p.year)).attr("cy", p => y(p.score)).attr("r", many ? 1.4 : 2.6).style("fill", col);
    const p = pos.get(d.country);                                   // nome no fim da linha (com pequena linha-guia se foi deslocado)
    el.append("line").attr("x1", p.x + 3).attr("y1", p.y).attr("x2", p.x + 10).attr("y2", p.ly).style("stroke", col).style("stroke-width", .8);
    el.append("text").attr("x", p.x + 12).attr("y", p.ly + 3.5).style("font-size", "10px").style("fill", col).text(label(d.country));
  });
  // hover: destaca a linha, esmaece as demais e mostra nome + valor do ano sob o cursor
  gs.on("mouseenter", function (e, d) { gs.classed("dim", g => g !== d); d3.select(this).classed("hot", true); })
    .on("mousemove", (e, d) => {
      const yr = Math.max(2012, Math.min(2024, Math.round(x.invert(d3.pointer(e, svg.node())[0]))));
      showTip(e, `<b>${label(d.country)}</b> (${PT[d.region]})<br>${yr}: ${d.map.get(yr) ?? "sem dado"}`);
    })
    .on("mouseleave", () => { gs.classed("dim", false).classed("hot", false); hideTip(); });

  // conferência: pontos desenhados × valores do CSV para os países escolhidos
  const shown = svg.selectAll("circle.v").size();
  const exp = await cpi.countValues(list);
  recon.textContent = `Conferência: ${lines.length} linhas · ${shown} de ${exp} valores de CPI do CSV desenhados para os países selecionados ${shown === exp ? "✓ nenhum valor perdido" : "✗ DIVERGÊNCIA"}`;
}
