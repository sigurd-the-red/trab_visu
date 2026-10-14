import { CatsData } from "./cats.js";
import { loadScatterPlot, loadBarChart, clearChart } from "./plot.js";

// Atualiza a mensagem de status exibida na página
// O parâmetro "erro" indica se a mensagem representa uma falha
function setStatus(mensagem, erro = false) {
  const elemento = document.querySelector("#status");

  if (elemento) {
    elemento.textContent = mensagem;
    elemento.classList.toggle("erro", erro);
  }
}

// Armazena a Promise do carregamento para evitar inicializações repetidas
let dadosPromise = null;

function carregarDados() {
  // Só inicia o carregamento se ainda não existir uma Promise ativa
  if (!dadosPromise) {
    dadosPromise = (async () => {
      setStatus("Inicializando DuckDB e carregando dados...");

      const cats = new CatsData();

      // Inicializa o banco e estabelece a conexão
      await cats.init();

      // Importa o CSV e cria a tabela no DuckDB
      await cats.loadCsv();

      // Busca os dados necessários para cada gráfico.
      const dadosAtividades = await cats.getActivityData();
      const dadosRepouso = await cats.getRestData();

      // Impede a continuação caso alguma consulta não retorne registros
      if (!dadosAtividades.length || !dadosRepouso.length) {
        throw new Error("Nenhum dado disponível para desenhar os gráficos.");
      }

      // Retorna os dois conjuntos de dados em um único objeto
      return {
        dadosAtividades,
        dadosRepouso,
      };
    })();

    // Se o carregamento falhar, permite uma nova tentativa posteriormente
    dadosPromise.catch(() => {
      dadosPromise = null;
    });
  }

  // Retorna a Promise existente ou a recém-criada
  return dadosPromise;
}

const loadBtn = document.querySelector("#loadBtn");
const clearBtn = document.querySelector("#clearBtn");

// Executa esta função quando o usuário clicar para carregar os gráficos
loadBtn?.addEventListener("click", async () => {
  if (loadBtn.disabled) return;

  loadBtn.disabled = true;

  try {
    // Aguarda os dados e recupera os dois conjuntos de resultados
    const { dadosAtividades, dadosRepouso } = await carregarDados();

    // Desenha o gráfico de dispersão com os dados de atividade
    loadScatterPlot(dadosAtividades);

    // Desenha o gráfico de barras com os dados de repouso
    loadBarChart(dadosRepouso);

    // Informa que os gráficos foram carregados e mostra a quantidade de registros
    setStatus(
      `Gráficos carregados. ` +
        `${dadosAtividades.length} registros no Design A e ` +
        `${dadosRepouso.length} registros no Design B.`,
    );
  } catch (erro) {
    setStatus(`Erro ao carregar os gráficos: ${erro.message}`, true);
  } finally {
    loadBtn.disabled = false;
  }
});

// Executa esta função quando o usuário clicar para limpar os gráficos
clearBtn?.addEventListener("click", () => {
  clearChart();

  setStatus('Gráficos limpos. Clique em "Load Chart" para desenhá-los novamente.');
});

// Carrega os dados assim que o arquivo JavaScript é executado
// sem exigir que o usuário clique primeiro no botão
carregarDados()
  .then(({ dadosAtividades, dadosRepouso }) => {
    setStatus(
      `Dados prontos: ${dadosAtividades.length} registros de atividades ` +
        `e ${dadosRepouso.length} registros de repouso. Clique em "Load Chart".`,
    );
  })
  .catch((erro) => {
    setStatus(`Erro ao inicializar os dados: ${erro.message}`, true);
  });
