import * as d3 from "d3";

// Ordem das categorias de peso
const ORDEM_PESO = ["Ideal", "Overweight", "Heavy", "Obese"];

// Define uma cor para cada categoria
const CORES_PESO = {
  Ideal: "#BFDBFE",
  Overweight: "#60A5FA",
  Heavy: "#2563EB",
  Obese: "#1E3A8A",
};

// Define os quatro painéis que serão apresentados em cada gráfico
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
  left: 45,
};

const GAP_X = 35;
const GAP_Y = 45;

// formatação numérica com uma casa decimal
const fmt = d3.format(".1f");

// Normaliza o nome da estação para facilitar a comparação
function normalizarEstacao(valor) {
  // Converte o valor para texto, remove espaços externos
  // e transforma todas as letras em minúsculas
  // O operador ?? substitui null ou undefined por uma string vazia
  const texto = String(valor ?? "")
    .trim()
    .toLowerCase();

  if (texto === "summer") return "Summer";
  if (texto === "winter") return "Winter";

  return texto;
}

// Normaliza o nome do ambiente
function normalizarAmbiente(valor) {
  const texto = String(valor ?? "")
    .trim()
    .toLowerCase();

  if (texto === "indoor") return "Indoor";
  if (texto === "indoor outdoor") return "Indoor Outdoor";

  return texto;
}

// Verifica se um valor pode ser utilizado como número
// Retorna null para valores ausentes, vazios ou inválidos
function numeroValido(valor) {
  if (valor === null || valor === undefined || String(valor).trim() === "") {
    return null;
  }

  const numero = Number(valor);
  return Number.isFinite(numero) ? numero : null;
}

// Seleciona o elemento SVG e recupera suas dimensões
function prepararSvg(seletor) {
  const svg = d3.select(seletor);

  if (svg.empty()) {
    throw new Error(`SVG não encontrado: ${seletor}`);
  }

  svg.selectAll("*").remove();

  const viewBox = svg.attr("viewBox");

  // Usa os atributos width e height como dimensões iniciais
  // Se forem ausentes/inválidos, utiliza valores padrão
  let width = Number(svg.attr("width")) || 900;
  let height = Number(svg.attr("height")) || 620;

  if (viewBox) {
    // Divide os valores do viewBox e converte cada um para número
    // O formato esperado é: "minX minY largura altura"
    const valores = viewBox.trim().split(/\s+/).map(Number);

    // Utiliza a largura e a altura do viewBox, se forem válidas
    width = valores[2] || width;
    height = valores[3] || height;
  }

  return { svg, width, height };
}

// Calcula as dimensões dos quatro painéis organizados em uma grade 2 × 2
function obterDimensoes(width, height) {
  const colunas = 2;
  const linhas = 2;

  return {
    colunas,
    larguraPainel: (width - MARGEM.left - MARGEM.right - GAP_X) / colunas,
    alturaPainel: (height - MARGEM.top - MARGEM.bottom - GAP_Y) / linhas,
  };
}

// Cria um grupo SVG para um painel e posiciona seu título
// O parâmetro indice determina a posição do painel na grade
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

  return grupo;
}

// Seleciona os registros que pertencem a determinado painel
// Os dados precisam corresponder à estação, ao ambiente
// e a uma categoria de condição corporal conhecida
function filtrarPainel(data, painel) {
  return data.filter(
    (d) =>
      normalizarEstacao(d.season) === painel.season &&
      normalizarAmbiente(d.housing) === painel.housing &&
      ORDEM_PESO.includes(d.bcs_ord),
  );
}

// Adiciona uma legenda na parte inferior do SVG
// O parâmetro tipo define se os símbolos serão círculos ou retângulos
function adicionarLegenda(svg, height, tipo = "circulo") {
  const legenda = svg
    .append("g")
    .attr("transform", `translate(${MARGEM.left},${height - 15})`);

  ORDEM_PESO.forEach((peso, indice) => {
    // Cria um grupo para cada item da legenda
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
      .text(peso);
  });
}

// Exibe uma mensagem no centro da área do gráfico
// quando não existem registros para a combinação selecionada
function adicionarMensagemVazia(grafico, largura, altura) {
  grafico
    .append("text")
    .attr("class", "empty-message")
    .attr("x", largura / 2)
    .attr("y", altura / 2)
    .attr("text-anchor", "middle")
    .text("Sem dados para esta combinação");
}

// Exporta a função para que o arquivo principal possa utilizá-la
// O gráfico compara o tempo deitado com o tempo sentado dos gatos
export function loadScatterPlot(data) {
  const { svg, width, height } = prepararSvg("#dotSvg");
  const dimensoes = obterDimensoes(width, height);

  const larguraGrafico = dimensoes.larguraPainel - 105;
  const alturaGrafico = dimensoes.alturaPainel - 75;

  const escalaX = d3.scaleLinear().domain([0, 100]).range([0, larguraGrafico]);

  const escalaY = d3.scaleLinear().domain([0, 100]).range([alturaGrafico, 0]);

  PAINEIS.forEach((painel, indice) => {
    const grupo = criarPainel(svg, painel, indice, dimensoes);
    const grafico = grupo.append("g").attr("transform", "translate(75,25)");

    // Filtra os registros do painel
    // Depois, converte os valores deitado e sentado para números
    const registros = filtrarPainel(data, painel)
      .map((d) => ({
        ...d,
        lyingNum: numeroValido(d.lying),
        sittingNum: numeroValido(d.sitting),
      }))
      .filter((d) => d.lyingNum !== null && d.sittingNum !== null);

    // Cria a grade horizontal do gráfico
    grafico
      .append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(escalaY).ticks(5).tickSize(-larguraGrafico).tickFormat(""));

    // Cria a grade vertical do gráfico
    grafico
      .append("g")
      .attr("class", "grid")
      .attr("transform", `translate(0,${alturaGrafico})`)
      .call(d3.axisBottom(escalaX).ticks(5).tickSize(-alturaGrafico).tickFormat(""));

    // Desenha o eixo X na parte inferior do gráfico
    grafico
      .append("g")
      .attr("transform", `translate(0,${alturaGrafico})`)
      .call(
        d3
          .axisBottom(escalaX)
          .ticks(5)
          .tickFormat((d) => `${d}%`),
      );

    // Desenha o eixo Y à esquerda do gráfico
    grafico.append("g").call(
      d3
        .axisLeft(escalaY)
        .ticks(5)
        .tickFormat((d) => `${d}%`),
    );

    // Adiciona o rótulo do eixo X
    grafico
      .append("text")
      .attr("class", "axis-label")
      .attr("x", larguraGrafico / 2)
      .attr("y", alturaGrafico + 48)
      .attr("text-anchor", "middle")
      .text("Tempo deitado (%)");

    // Adiciona o rótulo do eixo Y
    grafico
      .append("text")
      .attr("class", "axis-label")
      .attr("transform", "rotate(-90)")
      .attr("x", -alturaGrafico / 2)
      .attr("y", -55)
      .attr("text-anchor", "middle")
      .text("Tempo sentado (%)");

    // Desenha os pontos que representam os gatos
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
      .attr("stroke-width", 0.8);

    // Se o painel não tiver registros válidos, mostra uma mensagem
    if (registros.length === 0) {
      adicionarMensagemVazia(grafico, larguraGrafico, alturaGrafico);
    }
  });

  // Adiciona a legenda que explica as cores dos pontos
  adicionarLegenda(svg, height, "circulo");
}

// Exporta a função que constrói o gráfico de barras horizontais
// O objetivo é comparar o tempo médio de repouso entre as categorias
export function loadBarChart(data) {
  const { svg, width, height } = prepararSvg("#barSvg");
  const dimensoes = obterDimensoes(width, height);

  const larguraGrafico = dimensoes.larguraPainel - MARGEM.left;
  const alturaGrafico = dimensoes.alturaPainel - MARGEM.top - MARGEM.bottom;

  // Prepara os dados resumidos para cada painel
  // Cada resumo conterá a média e a quantidade de registros por categoria
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
      };
    });

    // Retorna os dados do painel junto com as categorias resumidas
    return {
      ...painel,
      categorias,
    };
  });

  // Encontra a maior média entre todas as categorias e painéis
  const maxValor =
    d3.max(resumos, (painel) => d3.max(painel.categorias, (d) => d.media ?? 0)) ?? 0;

  // Define o limite inicial da escala horizontal
  // Acrescenta 10% ao maior valor para deixar espaço após as barras
  // Math.max garante que o limite seja pelo menos 1
  const maxEscala = Math.max(1, maxValor * 1.1);

  // Percorre os painéis e desenha cada gráfico de barras
  PAINEIS.forEach((painel, indice) => {
    const resumo = resumos[indice];
    const grupo = criarPainel(svg, painel, indice, dimensoes);

    // Cria a área interna do gráfico
    const grafico = grupo.append("g").attr("transform", `translate(${MARGEM.left},25)`);

    // Cria a escala linear do eixo X
    const escalaX = d3
      .scaleLinear()
      .domain([0, maxEscala])
      .nice()
      .range([0, larguraGrafico]);

    // Cria a escala de faixas do eixo Y
    const escalaY = d3
      .scaleBand()
      .domain(ORDEM_PESO)
      .range([0, alturaGrafico])
      .padding(0.25);

    // Desenha a grade vertical
    grafico
      .append("g")
      .attr("class", "grid")
      .call(d3.axisBottom(escalaX).ticks(5).tickSize(alturaGrafico).tickFormat(""))
      .call((g) => g.select(".domain").remove());

    // Desenha o eixo X na parte inferior do gráfico
    grafico
      .append("g")
      .attr("transform", `translate(0,${alturaGrafico})`)
      .call(
        d3
          .axisBottom(escalaX)
          .ticks(5)
          .tickFormat((d) => `${fmt(d)}%`),
      );

    // Desenha o eixo Y com os nomes das categorias
    grafico.append("g").call(d3.axisLeft(escalaY).tickFormat((peso) => peso));

    // Seleciona as barras existentes e associa os dados resumidos
    // join("rect") cria um retângulo para cada categoria
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
      .attr("fill", (d) => CORES_PESO[d.peso]);

    // Adiciona o valor numérico ao lado de cada barra que possui dados
    grafico
      .selectAll(".valor-barra")
      .data(resumo.categorias.filter((d) => d.media !== null))
      .join("text")
      .attr("class", "valor-barra")
      .attr("x", (d) => escalaX(d.media) + 5)
      .attr("y", (d) => escalaY(d.peso) + escalaY.bandwidth() / 2)
      .attr("dy", "0.35em")
      .text((d) => `${fmt(d.media)}%`);

    // Identifica as categorias que não possuem dados para calcular a média
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

    // Adiciona o título do eixo horizontal
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

// Remove os elementos desenhados dentro dos dois SVGs
export function clearChart() {
  d3.select("#dotSvg").selectAll("*").remove();
  d3.select("#barSvg").selectAll("*").remove();
}
