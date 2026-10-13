import * as d3 from 'd3';

// Ordem dos tipos (igual à legenda original) e paleta de alto contraste.
// Cada região tem um matiz próprio (vermelho, azul, verde, roxo); dentro da região,
// o BEV usa a versão escura e o PHEV a versão clara/vibrante, de modo que
// nenhum par de cores fica parecido.
const TIPOS = [
    'China BEV', 'China PHEV',
    'Europe BEV', 'Europe PHEV',
    'United States BEV', 'United States PHEV',
    'Rest of the world BEV', 'Rest of the world PHEV'
];
const CORES = [
    '#c1121f', // China BEV            - vermelho escuro
    '#ff9f1c', // China PHEV           - laranja
    '#1d3557', // Europe BEV           - azul marinho
    '#2ec4f1', // Europe PHEV          - ciano
    '#1b7a3d', // United States BEV    - verde escuro
    '#b5e61d', // United States PHEV   - verde limão
    '#6a1b9a', // Rest of the world BEV  - roxo
    '#f06ec1'  // Rest of the world PHEV - rosa
];

// Formato dos rótulos de dados: uma casa decimal (como no CSV)
const fmt = d3.format('.1f');

/**
 * Desenha o gráfico de colunas agrupadas: para cada ano, uma coluna por tipo de veículo,
 * com o valor exato no topo de cada coluna.
 * @param data    array de { ano, tipo, estoque } (formato longo, vindo do DuckDB)
 * @param margens margens internas do SVG
 */
// Margens: "top" menor (a legenda saiu do topo) e "bottom" maior, para caber o eixo dos anos e a legenda abaixo do gráfico.
export async function loadChart(data, margens = { left: 70, right: 30, top: 50, bottom: 120 }) {
    const svg = d3.select('#barSvg');
    if (svg.empty()) return;

    // Dimensões lidas dos atributos do SVG (definidos no index.html)
    const width  = +svg.attr('width');
    const height = +svg.attr('height');
    const innerW = width  - margens.left - margens.right;
    const innerH = height - margens.top  - margens.bottom;

    // ---- Escalas
    const anos = [...new Set(data.map(d => d.ano))].sort(d3.ascending);

    // Escala externa: uma faixa por ano
    const x0 = d3.scaleBand().domain(anos).range([0, innerW]).paddingInner(0.15);
    // Escala interna: uma faixa por posição (0..7) dentro de cada ano; a posição é definida pela ordenação crescente
    const x1 = d3.scaleBand().domain(d3.range(TIPOS.length)).range([0, x0.bandwidth()]).padding(0.05);
    // Escala vertical linear (estoque em milhões), com topo arredondado ("nice") para folga dos rótulos
    const y = d3.scaleLinear()
        .domain([0, d3.max(data, d => d.estoque)]).nice()
        .range([innerH, 0]);
    // Escala de cores por tipo
    const cor = d3.scaleOrdinal().domain(TIPOS).range(CORES);

    // Limpa o desenho anterior antes de redesenhar (evita duplicar elementos)
    clearBarChart();

    // ---- Grade horizontal
    svg.append('g')
        .attr('id', 'grid')
        .attr('transform', `translate(${margens.left}, ${margens.top})`)
        .selectAll('line')
        .data(y.ticks())
        .join('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', d => y(d)).attr('y2', d => y(d))
        .attr('class', 'gridline');

    // ---- Eixos
    svg.append('g')
        .attr('id', 'axisX')
        .attr('class', 'x axis')
        .attr('transform', `translate(${margens.left}, ${margens.top + innerH})`)
        .call(d3.axisBottom(x0));

    svg.append('g')
        .attr('id', 'axisY')
        .attr('class', 'y axis')
        .attr('transform', `translate(${margens.left}, ${margens.top})`)
        .call(d3.axisLeft(y));

    // Título da unidade no eixo Y
    svg.append('text')
        .attr('id', 'axisYLabel')
        .attr('class', 'axis-label')
        .attr('x', margens.left)
        .attr('y', margens.top - 12)
        .attr('text-anchor', 'end')
        .text('milhões');

    // ---- Colunas: um grupo <g> por ano, com uma coluna por tipo
    const grupos = svg.append('g')
        .attr('id', 'group')
        .attr('transform', `translate(${margens.left}, ${margens.top})`)
        .selectAll('g.ano')
        .data(anos)
        .join('g')
        .attr('class', 'ano')
        .attr('transform', ano => `translate(${x0(ano)}, 0)`);

    // Dados de cada grupo = registros daquele ano.
    // Dentro de cada ano, ordena as colunas de forma crescente pelo valor (em empate, mantém a ordem da legenda)
    // e guarda a posição (pos) de cada coluna dentro do grupo.
    const porAno = new Map(
        [...d3.group(data, d => d.ano)].map(([ano, regs]) => [
            ano,
            [...regs]
                .sort((a, b) => d3.ascending(a.estoque, b.estoque) || TIPOS.indexOf(a.tipo) - TIPOS.indexOf(b.tipo))
                .map((d, i) => ({ ...d, pos: i }))
        ])
    );

    // Cada coluna é posicionada pela posição (pos) na ordenação crescente, não pelo tipo
    grupos.selectAll('rect')
        .data(ano => porAno.get(ano))
        .join('rect')
        .attr('x', d => x1(d.pos))
        .attr('y', d => y(d.estoque))
        .attr('width', x1.bandwidth())
        .attr('height', d => innerH - y(d.estoque))
        .attr('fill', d => cor(d.tipo))
        .append('title') // tooltip nativo com o valor exato
        .text(d => `${d.tipo} (${d.ano}): ${fmt(d.estoque)} milhões`);

    // ---- Rótulos de dados no topo de cada coluna (girados 90° para caber)
    grupos.selectAll('text.rotulo')
        .data(ano => porAno.get(ano))
        .join('text')
        .attr('class', 'rotulo')
        .attr('transform', d => `translate(${x1(d.pos) + x1.bandwidth() / 2}, ${y(d.estoque) - 4}) rotate(-90)`)
        .attr('text-anchor', 'start')
        .attr('dominant-baseline', 'middle')
        .text(d => fmt(d.estoque));

    // ---- Legenda (compartilhada com o gráfico de linhas)
    desenharLegenda(svg, margens, innerH, cor);
}

/**
 * Desenha a legenda abaixo do gráfico, em duas linhas de 4 itens.
 * Usada tanto pelo gráfico de colunas quanto pelo de linhas.
 */
function desenharLegenda(svg, margens, innerH, cor) {
    const itemW = 260; // largura fixa de cada item da legenda (o SVG é largo)
    // A legenda fica abaixo do eixo X: topo da área do gráfico + altura útil + 65px (espaço dos rótulos dos anos)
    const legenda = svg.append('g')
        .attr('id', 'legend')
        .attr('transform', `translate(${margens.left + 10}, ${margens.top + innerH + 65})`);

    const itens = legenda.selectAll('g')
        .data(TIPOS)
        .join('g')
        .attr('transform', (d, i) => `translate(${(i % 4) * itemW}, ${Math.floor(i / 4) * 24})`);

    itens.append('rect').attr('width', 16).attr('height', 16).attr('fill', d => cor(d));
    itens.append('text').attr('x', 24).attr('y', 13).attr('class', 'legend-text').text(d => d);
}

/**
 * Afasta verticalmente rótulos que se sobreporiam.
 * Recebe os itens já ordenados de cima para baixo (campo y = posição desejada) e define yRot = posição final.
 * Enquanto dois rótulos vizinhos estiverem a menos de "folga" px, eles são empurrados em sentidos opostos;
 * depois todos são mantidos entre limiteTopo e limiteBase.
 */
function evitarSobreposicao(itens, folga, limiteTopo, limiteBase) {
    itens.forEach(d => { d.yRot = d.y; });
    for (let iter = 0; iter < 300; iter++) {
        let moveu = false;
        for (let k = 1; k < itens.length; k++) {
            const dif = itens[k].yRot - itens[k - 1].yRot;
            if (dif < folga - 0.01) {
                const desloc = (folga - dif) / 2;
                itens[k - 1].yRot -= desloc;
                itens[k].yRot += desloc;
                moveu = true;
            }
        }
        // Mantém dentro da área do gráfico
        itens.forEach(d => { d.yRot = Math.min(limiteBase, Math.max(limiteTopo, d.yRot)); });
        if (!moveu) break;
    }
}

/**
 * Desenha o gráfico de linhas: uma linha por tipo de veículo, mostrando a evolução do estoque ao longo dos anos.
 * Usa as mesmas margens, cores e posições dos anos do gráfico de colunas (os pontos ficam alinhados com cada grupo de colunas).
 * @param data    array de { ano, tipo, estoque } (formato longo, vindo do DuckDB)
 * @param margens margens internas do SVG
 */
export async function loadLineChart(data, margens = { left: 70, right: 30, top: 50, bottom: 120 }) {
    const svg = d3.select('#lineSvg');
    if (svg.empty()) return;

    // Dimensões lidas dos atributos do SVG (definidos no index.html)
    const width  = +svg.attr('width');
    const height = +svg.attr('height');
    const innerW = width  - margens.left - margens.right;
    const innerH = height - margens.top  - margens.bottom;

    // ---- Escalas
    const anos = [...new Set(data.map(d => d.ano))].sort(d3.ascending);

    // Mesma escala de banda do gráfico de colunas; o centro de cada faixa é a posição do ano
    const x0 = d3.scaleBand().domain(anos).range([0, innerW]).paddingInner(0.15);
    const cx = ano => x0(ano) + x0.bandwidth() / 2;
    // Escala vertical em milhões, linear POR PARTES: a faixa de 0 a 2 ocupa bem mais altura que as demais,
    // para que diferenças pequenas (como 0.0 e 0.1) fiquem visíveis. Cada segmento continua linear.
    const yMax = d3.scaleLinear().domain([0, d3.max(data, d => d.estoque)]).nice().domain()[1];
    // Pontos de quebra do eixo (valores) e a fração da altura total que cada um alcança
    const quebras  = [0, 2, 6, 12].filter(v => v < yMax);
    const fracoes  = [0, 0.45, 0.65, 0.82].slice(0, quebras.length);
    const y = d3.scaleLinear()
        .domain([...quebras, yMax])
        .range([...fracoes, 1].map(f => innerH * (1 - f)));
    // Marcas do eixo Y: mais densas na faixa ampliada
    const yTicks = [0, 0.5, 1, 1.5, 2, 3, 4, 5, 6, 8, 10, 12, 14, 16, 18, 20].filter(t => t <= yMax);
    // Escala de cores por tipo (mesma paleta do gráfico de colunas)
    const cor = d3.scaleOrdinal().domain(TIPOS).range(CORES);

    // Limpa o desenho anterior antes de redesenhar
    clearLineChart();

    // ---- Faixa de 0 a 2 (região ampliada) levemente sombreada, para indicar a mudança de escala
    svg.append('rect')
        .attr('id', 'faixa')
        .attr('x', margens.left)
        .attr('y', margens.top + y(2))
        .attr('width', innerW)
        .attr('height', y(0) - y(2))
        .attr('fill', '#f4f8fc');

    // ---- Grade horizontal
    svg.append('g')
        .attr('id', 'grid')
        .attr('transform', `translate(${margens.left}, ${margens.top})`)
        .selectAll('line')
        .data(yTicks)
        .join('line')
        .attr('x1', 0).attr('x2', innerW)
        .attr('y1', d => y(d)).attr('y2', d => y(d))
        .attr('class', d => d <= 2 ? 'gridline gridline-forte' : 'gridline'); // grade mais escura na faixa ampliada (0 a 2)

    // ---- Eixos (o eixo X usa as posições centrais dos anos)
    svg.append('g')
        .attr('id', 'axisX')
        .attr('class', 'x axis')
        .attr('transform', `translate(${margens.left}, ${margens.top + innerH})`)
        .call(d3.axisBottom(x0));

    svg.append('g')
        .attr('id', 'axisY')
        .attr('class', 'y axis')
        .attr('transform', `translate(${margens.left}, ${margens.top})`)
        .call(d3.axisLeft(y).tickValues(yTicks).tickFormat(d3.format('~g')));

    // Título da unidade no eixo Y
    svg.append('text')
        .attr('id', 'axisYLabel')
        .attr('class', 'axis-label')
        .attr('x', 10)
        .attr('y', margens.top - 14)
        .attr('text-anchor', 'start')
        .text('milhões (faixa de 0 a 2 ampliada)');

    // ---- Séries: um grupo <g> por tipo, com a linha, os pontos e o rótulo final
    // Cada série é ordenada por ano para a linha ser desenhada na ordem certa.
    const series = TIPOS.map(tipo => ({
        tipo,
        valores: data.filter(d => d.tipo === tipo).sort((a, b) => d3.ascending(a.ano, b.ano))
    }));

    // Gerador de linha: x = centro do ano, y = estoque
    const linha = d3.line()
        .x(d => cx(d.ano))
        .y(d => y(d.estoque));

    const grupos = svg.append('g')
        .attr('id', 'group')
        .attr('transform', `translate(${margens.left}, ${margens.top})`)
        .selectAll('g.serie')
        .data(series)
        .join('g')
        .attr('class', 'serie');

    // Contorno escuro por baixo de cada linha: garante contraste mesmo com cores claras (limão, ciano, rosa)
    // sobre o fundo claro, principalmente na faixa ampliada de 0 a 2
    grupos.append('path')
        .attr('fill', 'none')
        .attr('stroke', '#1a1a1a')
        .attr('stroke-width', 7)
        .attr('stroke-linejoin', 'round')
        .attr('stroke-linecap', 'round')
        .attr('d', s => linha(s.valores));

    // Linha colorida de cada série, desenhada sobre o contorno
    grupos.append('path')
        .attr('fill', 'none')
        .attr('stroke', s => cor(s.tipo))
        .attr('stroke-width', 3.5)
        .attr('stroke-linejoin', 'round')
        .attr('d', s => linha(s.valores));

    // Pontos de cada série, com tooltip nativo mostrando o valor exato
    grupos.selectAll('circle')
        .data(s => s.valores)
        .join('circle')
        .attr('cx', d => cx(d.ano))
        .attr('cy', d => y(d.estoque))
        .attr('r', 6)
        .attr('fill', d => cor(d.tipo))
        .attr('stroke', '#1a1a1a')
        .attr('stroke-width', 2)
        .append('title')
        .text(d => `${d.tipo} (${d.ano}): ${fmt(d.estoque)} milhões`);

    // ---- Rótulos de dados em TODOS os pontos, sem sobreposição.
    // Para cada ano, os rótulos formam uma coluna à direita dos pontos. Eles são ordenados de cima para baixo
    // e afastados uns dos outros (mínimo de 22px) por evitarSobreposicao(). Cada rótulo é uma "pílula" na cor da
    // série (identifica a linha mesmo quando deslocado) ligada ao seu ponto por uma linha fina.
    const ALTURA = 20, LARGURA = 50, FOLGA = 22, DESLOC = 18;
    const porAno = d3.group(data, d => d.ano);
    const rotulos = [];
    for (const [ano, regs] of porAno) {
        const itens = [...regs]
            .map(d => ({ ...d, y: y(d.estoque) }))
            .sort((a, b) => a.y - b.y || TIPOS.indexOf(a.tipo) - TIPOS.indexOf(b.tipo));
        evitarSobreposicao(itens, FOLGA, ALTURA / 2, innerH - ALTURA / 2);
        rotulos.push(...itens);
    }

    const camada = svg.append('g')
        .attr('id', 'labels')
        .attr('transform', `translate(${margens.left}, ${margens.top})`);

    // Linha fina ligando o ponto ao seu rótulo
    camada.selectAll('line')
        .data(rotulos)
        .join('line')
        .attr('x1', d => cx(d.ano) + 6).attr('y1', d => d.y)
        .attr('x2', d => cx(d.ano) + DESLOC).attr('y2', d => d.yRot)
        .attr('stroke', d => cor(d.tipo))
        .attr('stroke-width', 1.5);

    // Pílula colorida de fundo
    camada.selectAll('rect')
        .data(rotulos)
        .join('rect')
        .attr('x', d => cx(d.ano) + DESLOC)
        .attr('y', d => d.yRot - ALTURA / 2)
        .attr('width', LARGURA)
        .attr('height', ALTURA)
        .attr('rx', 5)
        .attr('fill', d => cor(d.tipo));

    // Valor exato em negrito; a cor do texto (preto ou branco) depende do brilho da cor de fundo
    camada.selectAll('text')
        .data(rotulos)
        .join('text')
        .attr('class', 'rotulo-linha')
        .attr('x', d => cx(d.ano) + DESLOC + LARGURA / 2)
        .attr('y', d => d.yRot)
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', d => d3.lab(cor(d.tipo)).l > 62 ? '#111' : '#fff')
        .text(d => fmt(d.estoque));

    // ---- Legenda (a mesma do gráfico de colunas)
    desenharLegenda(svg, margens, innerH, cor);
}

// Remove o que foi desenhado no gráfico de colunas
function clearBarChart() {
    d3.select('#barSvg')
        .selectAll('#grid, #axisX, #axisY, #axisYLabel, #group, #legend')
        .remove();
}

// Remove o que foi desenhado no gráfico de linhas
function clearLineChart() {
    d3.select('#lineSvg')
        .selectAll('#faixa, #grid, #axisX, #axisY, #axisYLabel, #group, #labels, #legend')
        .remove();
}

// Remove tudo que foi desenhado pelos dois gráficos (colunas e linhas)
export function clearChart() {
    clearBarChart();
    clearLineChart();
}
