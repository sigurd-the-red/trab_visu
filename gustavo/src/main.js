import { CatsData } from "./cats.js";
import { loadScatterPlot, loadBarChart, clearChart } from "./plot.js";

// Atualiza a mensagem de status na página.
function setStatus(mensagem, erro = false) {
  const elemento = document.querySelector("#status");

  if (elemento) {
    elemento.textContent = mensagem;
    elemento.classList.toggle("erro", erro);
  }

  if (erro) {
    console.error(mensagem);
  } else {
    console.log(mensagem);
  }
}

// Guarda os dados carregados para evitar inicializações repetidas.
let dadosPromise = null;

function carregarDados() {
  if (!dadosPromise) {
    dadosPromise = (async () => {
      setStatus("Inicializando DuckDB e carregando dados...");

      const cats = new CatsData();

      // Inicializa o banco DuckDB-WASM.
      await cats.init();

      // Lê o CSV e cria a tabela de dados.
      await cats.loadCsv();

      // Consulta os dados necessários para cada redesign.
      const dadosAtividades = await cats.getActivityData();
      const dadosRepouso = await cats.getRestData();

      if (!dadosAtividades.length || !dadosRepouso.length) {
        throw new Error("Nenhum dado disponível para desenhar os gráficos.");
      }

      return {
        dadosAtividades,
        dadosRepouso,
      };
    })();

    // Permite tentar carregar novamente se ocorrer um erro.
    dadosPromise.catch(() => {
      dadosPromise = null;
    });
  }

  return dadosPromise;
}

// Referências aos botões da página.
const loadBtn = document.querySelector("#loadBtn");
const clearBtn = document.querySelector("#clearBtn");

// Desenha os dois gráficos.
loadBtn?.addEventListener("click", async () => {
  if (loadBtn.disabled) return;

  loadBtn.disabled = true;

  try {
    const { dadosAtividades, dadosRepouso } = await carregarDados();

    // Design A: barras horizontais agrupadas.
    loadScatterPlot(dadosAtividades);

    // Design B: comparação do repouso entre estações.
    loadBarChart(dadosRepouso);

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

// Limpa os desenhos sem apagar os dados carregados.
clearBtn?.addEventListener("click", () => {
  clearChart();
  setStatus('Gráficos limpos. Clique em "Load Chart" para desenhá-los novamente.');
});

// Inicializa e valida os dados assim que a página abre.
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
