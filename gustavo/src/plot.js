import * as d3 from "d3";

// ======================================================
// CONFIGURAÇÕES
// ======================================================

const ORDEM_PESO = ["Ideal", "Overweight", "Heavy", "Obese"];

const CORES_PESO = {
  Ideal: "#BFDBFE",
  Overweight: "#60A5FA",
  Heavy: "#2563EB",
  Obese: "#1E3A8A",
};

const ROTULOS_PESO = {
  Ideal: "Ideal",
  Overweight: "Sobrepeso",
  Heavy: "Acima do peso",
  Obese: "Obeso",
};

const PAINEIS = [
  {
    season: "Winter",
    housing: "Indoor",
    titulo: "Inverno — Indoor",
  },
  {
    season: "Winter",
    housing: "Indoor Outdoor",
    titulo: "Inverno — Indoor Outdoor",
  },
  {
    season: "Summer",
    housing: "Indoor",
    titulo: "Verão — Indoor",
  },
  {
    season: "Summer",
    housing: "Indoor Outdoor",
    titulo: "Verão — Indoor Outdoor",
  },
];

const MARGEM = {
  top: 65,
  right: 0,
  bottom: 65,
  left: 65,
};

const GAP_X = 35;
const GAP_Y = 45;

const fmt = d3.format(".1f");

// ======================================================
// NORMALIZAÇÃO E UTILITÁRIOS
// ======================================================

function normalizarEstacao(valor) {
  const texto = String(valor ?? "")
    .trim()
    .toLowerCase();

  if (texto === "summer") return "Summer";
  if (texto === "winter") return "Winter";

  return texto;
}

function normalizarAmbiente(valor) {
  const texto = String(valor ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");

  if (texto === "indoor") return "Indoor";
  if (texto === "indoor outdoor") return "Indoor Outdoor";

  return texto;
}

function numeroValido(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") {
    return null;
  }

  const numero = Number(valor);

  return Number.isFinite(numero) ? numero : null;
}

function prepararSvg(seletor) {
  const svg = d3.select(seletor);

  if (svg.empty()) {
    throw new Error(`SVG não encontrado: ${seletor}`);
  }

  svg.selectAll("*").remove();

  const viewBox = svg.attr("viewBox");

  let width = Number(svg.attr("width")) || 900;
  let height = Number(svg.attr("height")) || 620;

  if (viewBox) {
    const valores = viewBox.trim().split(/\s+/).map(Number);
    width = valores[2] || width;
    height = valores[3] || height;
  }

  return { svg, width, height };
}

function obterDimensoes(width, height) {
  const colunas = 2;
  const linhas = 2;

  return {
    colunas,
    linhas,
    larguraPainel: (width - MARGEM.left - MARGEM.right - GAP_X) / colunas,
    alturaPainel: (height - MARGEM.top - MARGEM.bottom - GAP_Y) / linhas,
  };
}

function criarPainel(svg, painel, indice, dimensoes) {
  const { colunas, larguraPainel, alturaPainel } = dimensoes;

  const coluna = indice % colunas;
  const linha = Math.floor(indice / colunas);

  const x = MARGEM.left + coluna * (larguraPainel + GAP_X);
  const y = MARGEM.top + linha * (alturaPainel + GAP_Y);

  const grupo = svg
    .append("g")
    .attr("class", "painel")
    .attr("transform", `translate(${x},${y})`);

  grupo
    .append("text")
    .attr("class", "panel-title")
    .attr("x", 0)
    .attr("y", 0)
    .text(painel.titulo);

  return {
    grupo,
    larguraPainel,
    alturaPainel,
  };
}

function filtrarPainel(data, painel) {
  return data.filter(
    (d) =>
      normalizarEstacao(d.season) === painel.season &&
      normalizarAmbiente(d.housing) === painel.housing &&
      ORDEM_PESO.includes(d.bcs_ord),
  );
}

function adicionarLegenda(svg, height, tipo = "circulo") {
  const legenda = svg
    .append("g")
    .attr("transform", `translate(${MARGEM.left},${height - 15})`);

  ORDEM_PESO.forEach((peso, indice) => {
    const item = legenda.append("g").attr("transform", `translate(${indice * 190},0)`);

    if (tipo === "circulo") {
      item
        .append("circle")
        .attr("cx", 6)
        .attr("cy", -4)
        .attr("r", 6)
        .attr("fill", CORES_PESO[peso]);
    } else {
      item
        .append("rect")
        .attr("width", 12)
        .attr("height", 12)
        .attr("rx", 2)
        .attr("fill", CORES_PESO[peso]);
    }

    item
      .append("text")
      .attr("class", "legend-text")
      .attr("x", 18)
      .attr("y", tipo === "circulo" ? 0 : 10)
      .text(ROTULOS_PESO[peso]);
  });
}

function adicionarMensagemVazia(grafico, largura, altura) {
  grafico
    .append("text")
    .attr("class", "empty-message")
    .attr("x", largura / 2)
    .attr("y", altura / 2)
    .attr("text-anchor", "middle")
    .text("Sem dados para esta combinação");
}

// ======================================================
// DESIGN A — SCATTERPLOT
//
// X: tempo deitado
// Y: tempo sentado
// Cada ponto representa um gato.
// ======================================================

export function loadScatterPlot(data) {
  const { svg, width, height } = prepararSvg("#barSvg");
  const dimensoes = obterDimensoes(width, height);

  const larguraGrafico = dimensoes.larguraPainel - 105;
  const alturaGrafico = dimensoes.alturaPainel - 75;

  const escalaX = d3.scaleLinear().domain([0, 100]).range([0, larguraGrafico]);

  const escalaY = d3.scaleLinear().domain([0, 100]).range([alturaGrafico, 0]);

  PAINEIS.forEach((painel, indice) => {
    const { grupo } = criarPainel(svg, painel, indice, dimensoes);

    const grafico = grupo.append("g").attr("transform", "translate(75,25)");

    const registros = filtrarPainel(data, painel)
      .map((d) => ({
        ...d,
        lyingNum: numeroValido(d.lying),
        sittingNum: numeroValido(d.sitting),
      }))
      .filter((d) => d.lyingNum !== null && d.sittingNum !== null);

    // Grade.
    grafico
      .append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(escalaY).ticks(5).tickSize(-larguraGrafico).tickFormat(""));

    grafico
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${alturaGrafico})`)
      .call(d3.axisBottom(escalaX).ticks(5).tickSize(-alturaGrafico).tickFormat(""));

    // Eixos.
    grafico
      .append("g")
      .attr("transform", `translate(0,${alturaGrafico})`)
      .call(
        d3
          .axisBottom(escalaX)
          .ticks(5)
          .tickFormat((d) => `${d}%`),
      );

    grafico.append("g").call(
      d3
        .axisLeft(escalaY)
        .ticks(5)
        .tickFormat((d) => `${d}%`),
    );

    // Rótulos.
    grafico
      .append("text")
      .attr("class", "axis-label")
      .attr("x", larguraGrafico / 2)
      .attr("y", alturaGrafico + 48)
      .attr("text-anchor", "middle")
      .text("Tempo deitado (%)");

    grafico
      .append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -alturaGrafico / 2)
      .attr("y", -55)
      .attr("text-anchor", "middle")
      .text("Tempo sentado (%)");

    // Pontos.
    grafico
      .selectAll(".ponto-gato")
      .data(registros)
      .join("circle")
      .attr("class", "ponto-gato")
      .attr("cx", (d) => escalaX(d.lyingNum))
      .attr("cy", (d) => escalaY(d.sittingNum))
      .attr("r", 5)
      .attr("fill", (d) => CORES_PESO[d.bcs_ord])
      .attr("fill-opacity", 0.8)
      .attr("stroke", (d) => CORES_PESO[d.bcs_ord])
      .attr("stroke-width", 0.8)
      .append("title")
      .text(
        (d) =>
          `Gato: ${d.cat_id}\n` +
          `Condição corporal: ${ROTULOS_PESO[d.bcs_ord]}\n` +
          `Deitado: ${fmt(d.lyingNum)}%\n` +
          `Sentado: ${fmt(d.sittingNum)}%`,
      );

    if (registros.length === 0) {
      adicionarMensagemVazia(grafico, larguraGrafico, alturaGrafico);
    }
  });

  adicionarLegenda(svg, height, "circulo");
}

// ======================================================
// DESIGN B — BARRAS HORIZONTAIS
//
// X: média de resting
// Y: categoria de peso
// Cada barra mostra a média e a quantidade de registros.
// ======================================================

export function loadBarChart(data) {
  const { svg, width, height } = prepararSvg("#lineSvg");
  const dimensoes = obterDimensoes(width, height);

  const margemEsquerda = 115;
  const margemDireita = 65;
  const margemSuperior = 25;
  const margemInferior = 45;

  const larguraGrafico = dimensoes.larguraPainel - margemEsquerda - margemDireita;

  const alturaGrafico = dimensoes.alturaPainel - margemSuperior - margemInferior;

  // Calcula a média e a quantidade de registros válidos.
  const resumos = PAINEIS.map((painel) => {
    const registros = filtrarPainel(data, painel);

    const categorias = ORDEM_PESO.map((peso) => {
      const valores = registros
        .filter((d) => d.bcs_ord === peso)
        .map((d) => numeroValido(d.resting))
        .filter((valor) => valor !== null);

      return {
        peso,
        media: valores.length ? d3.mean(valores) : null,
        n: valores.length,
      };
    });

    return {
      ...painel,
      categorias,
    };
  });

  // Escala comum para todos os painéis.
  const maxValor =
    d3.max(resumos, (painel) => d3.max(painel.categorias, (d) => d.media ?? 0)) ?? 0;

  const maxEscala = Math.max(1, maxValor * 1.1);

  PAINEIS.forEach((painel, indice) => {
    const resumo = resumos[indice];

    const { grupo } = criarPainel(svg, painel, indice, dimensoes);

    const grafico = grupo
      .append("g")
      .attr("transform", `translate(${margemEsquerda},${margemSuperior})`);

    const escalaX = d3
      .scaleLinear()
      .domain([0, maxEscala])
      .nice()
      .range([0, larguraGrafico]);

    const escalaY = d3
      .scaleBand()
      .domain(ORDEM_PESO)
      .range([0, alturaGrafico])
      .padding(0.25);

    // Grade vertical.
    grafico
      .append("g")
      .attr("class", "grid")
      .call(d3.axisBottom(escalaX).ticks(5).tickSize(alturaGrafico).tickFormat(""))
      .call((g) => g.select(".domain").remove());

    // Eixo X.
    grafico
      .append("g")
      .attr("transform", `translate(0,${alturaGrafico})`)
      .call(
        d3
          .axisBottom(escalaX)
          .ticks(5)
          .tickFormat((d) => `${fmt(d)}%`),
      );

    // Eixo Y.
    grafico
      .append("g")
      .call(d3.axisLeft(escalaY).tickFormat((peso) => ROTULOS_PESO[peso] ?? peso));

    // Barras.
    grafico
      .selectAll(".barra")
      .data(resumo.categorias)
      .join("rect")
      .attr("class", "barra")
      .attr("x", 0)
      .attr("y", (d) => escalaY(d.peso))
      .attr("width", (d) => (d.media === null ? 0 : escalaX(d.media)))
      .attr("height", escalaY.bandwidth())
      .attr("rx", 3)
      .attr("fill", (d) => CORES_PESO[d.peso])
      .append("title")
      .text(
        (d) =>
          `${ROTULOS_PESO[d.peso]}\n` +
          `Tempo médio de descanso: ${
            d.media === null ? "sem dados" : `${fmt(d.media)}%`
          }\n` +
          `Quantidade de registros: ${d.n}`,
      );

    // Média e quantidade ao final da barra.
    grafico
      .selectAll(".valor-barra")
      .data(resumo.categorias.filter((d) => d.media !== null))
      .join("text")
      .attr("class", "valor-barra")
      .attr("x", (d) => escalaX(d.media) + 5)
      .attr("y", (d) => escalaY(d.peso) + escalaY.bandwidth() / 2)
      .attr("dy", "0.35em")
      .text((d) => `${fmt(d.media)}%`);

    // Categorias sem dados.
    resumo.categorias
      .filter((d) => d.media === null)
      .forEach((d) => {
        grafico
          .append("text")
          .attr("class", "empty-category")
          .attr("x", 5)
          .attr("y", escalaY(d.peso) + escalaY.bandwidth() / 2)
          .attr("dy", "0.35em")
          .text("Sem dados");
      });

    // Rótulo do eixo X.
    grafico
      .append("text")
      .attr("class", "axis-label")
      .attr("x", larguraGrafico / 2)
      .attr("y", alturaGrafico + 38)
      .attr("text-anchor", "middle")
      .text("Tempo médio de descanso (%)");
  });

  adicionarLegenda(svg, height, "retangulo");
}

// ======================================================
// LIMPEZA
// ======================================================

export function clearChart() {
  d3.select("#barSvg").selectAll("*").remove();
  d3.select("#lineSvg").selectAll("*").remove();
}
