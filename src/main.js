import * as d3 from 'd3';
import { Cpi } from './cpi.js';
import { createPicker } from './picker.js';
import { drawBars } from './plot_bars.js';
import { drawLines } from './plot_lines.js';

// Estado da página: lista de países selecionáveis e os países marcados em cada design (independentes).
let entities = [];
let cpi;                           // camada de dados (DuckDB), criada em start() e usada pelos dois gráficos
const selectedBars = new Set();    // Design 1
const selectedLines = new Set();   // Design 2

/**
 * renderChecks — mostra na página a tabela de validação dos dados (feita pelo DuckDB).
 * Como: recebe as linhas {k, v} de cpi.validation() e cria, com o padrão join do D3, uma linha <tr> de
 * duas colunas (rótulo e valor) dentro da tabela #checks.
 */
function renderChecks(rows) {
  d3.select("#checks").selectAll("tr").data(rows).join("tr").html(d => `<td>${d.k}</td><td><b>${d.v}</b></td>`);
}

/**
 * renderNoCpi — lista as entidades sem nenhum CPI no CSV (não têm o que desenhar).
 * Como: escreve em #extra um bloco <details> recolhível com a contagem no título e o nome de cada entidade em
 * uma coluna; assim nenhuma linha do CSV fica sem ser mostrada.
 */
function renderNoCpi(rows) {
  d3.select("#extra").html(`<details><summary><b>Entidades sem nenhum CPI no CSV (${rows.length})</b> — não há valor para desenhar (nem barras nem linhas)</summary>
    <div class="none">${rows.map(d => `<div>${d.country}</div>`).join("")}</div></details>`);
}

/**
 * redrawBars — redesenha o Design 1 com o estado atual, mostrando erros no próprio gráfico.
 * Como: espera drawBars (assíncrona, pois agora consulta no DuckDB todos os anos dos países marcados); se der
 * erro, escreve a mensagem dentro de #chart1 e no console. É a função passada ao seletor e ao menu de ordenação.
 */
async function redrawBars() {
  try {
    await drawBars(cpi, entities, selectedBars);
  } catch (err) {
    d3.select("#chart1").html(`<p style="padding:8px;color:#b91c1c">Erro no Design 1: ${err.message}</p>`);
    console.error(err);
  }
}

/**
 * redrawLines — redesenha o Design 2 com o estado atual, mostrando erros no próprio gráfico.
 * Como: espera drawLines (assíncrona, pois consulta o DuckDB); se der erro, escreve a mensagem dentro de
 * #chart2 e no console, em vez de deixar o gráfico simplesmente vazio.
 */
async function redrawLines(cpi) {
  try {
    await drawLines(cpi, entities, selectedLines);
  } catch (err) {
    d3.select("#chart2").html(`<p style="padding:8px;color:#b91c1c">Erro no Design 2: ${err.message}</p>`);
    console.error(err);
  }
}

/**
 * start — ponto de entrada: carrega os dados e liga a interface.
 * Como: (1) abre o DuckDB, carrega data/cpi.csv e cria as tabelas; (2) mostra a tabela de validação;
 * (3) busca as entidades com CPI e marca a América do Sul nos dois designs; (4) cria os dois seletores de países
 * e liga os botões "Selecionar todos"/"Limpar seleção" e o menu de ordenação; (5) desenha os dois gráficos e a
 * lista de entidades sem CPI; (6) atualiza o texto de status (ou o erro, se algo falhar).
 */
async function start() {
  const status = document.getElementById("status");
  try {
    cpi = new Cpi();
    await cpi.init();
    await cpi.loadCsv();
    await cpi.prepare();
    renderChecks(await cpi.validation());

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
