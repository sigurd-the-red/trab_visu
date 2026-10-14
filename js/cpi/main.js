import * as d3 from 'd3';
import { Cpi } from './cpi.js';
import { createPicker } from './picker.js';
import { drawBars } from './plot_bars.js';
import { drawLines } from './plot_lines.js';

//estado da pagina: lista de paises selecionaveis e os paises marcados marcados em cada design
let entities = [];
let cpi;                           // camada de dados (DuckDB), criada em start() e usada pelos designs
const selectedBars = new Set();    // Design 1
const selectedLines = new Set();   // Design 2

//lista as entidades sem nenhum CPI no CSV(sem dados p/desenhar)
function renderNoCpi(rows) {
  d3.select("#extra").html(`<details><summary><b>Entidades sem nenhum CPI no CSV (${rows.length})</b> — não há valor para desenhar (nem barras nem linhas)</summary>
    <div class="none">${rows.map(d => `<div>${d.country}</div>`).join("")}</div></details>`);
}

//redesenha o Design 1 com o estado atual
async function redrawBars() {
  try {
    await drawBars(cpi, entities, selectedBars);
  } catch (err) {
    d3.select("#chart1").html(`<p style="padding:8px;color:#b91c1c">Erro no Design 1: ${err.message}</p>`);
    console.error(err);
  }
}


//redesenha o Design 2 com o estado atual
async function redrawLines(cpi) {
  try {
    await drawLines(cpi, entities, selectedLines);
  } catch (err) {
    d3.select("#chart2").html(`<p style="padding:8px;color:#b91c1c">Erro no Design 2: ${err.message}</p>`);
    console.error(err);
  }
}
 
 //carrega os dados e liga a interface
async function start() {
  const status = document.getElementById("status");
  try {
    cpi = new Cpi();
    await cpi.init();
    await cpi.loadCsv();
    await cpi.prepare();

    entities = await cpi.entities();
    entities.filter(e => e.region === "South America").forEach(e => { selectedBars.add(e.country); selectedLines.add(e.country); });

    const changeBars = createPicker("#picker", entities, selectedBars, redrawBars);
    const changeLines = createPicker("#picker2", entities, selectedLines, () => redrawLines(cpi));
    document.getElementById("barSort").onchange = redrawBars;
    document.getElementById("selAll").onclick = () => { entities.forEach(e => selectedBars.add(e.country)); changeBars(); };
    document.getElementById("selNone").onclick = () => { selectedBars.clear(); changeBars(); };
    document.getElementById("selAll2").onclick = () => { entities.forEach(e => selectedLines.add(e.country)); changeLines(); };
    document.getElementById("selNone2").onclick = () => { selectedLines.clear(); changeLines(); };

    await redrawBars();
    renderNoCpi(await cpi.withoutCpi());
    await redrawLines(cpi);
    status.textContent = "Pronto.";
  } catch (err) {
    status.textContent = "Erro ao carregar: " + err.message;
    console.error(err);
  }
}

window.onload = start;
