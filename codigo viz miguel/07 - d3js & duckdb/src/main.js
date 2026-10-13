import { ElectricCars } from './ev';
import { loadChart, loadLineChart, clearChart } from './plot';

// Mostra uma mensagem de status/erro na página (e no console)
function setStatus(msg, erro = false) {
    const el = document.querySelector('#status');
    if (el) {
        el.textContent = msg;
        el.classList.toggle('erro', erro);
    }
    (erro ? console.error : console.log)(msg);
}

// Carrega os dados uma única vez (DuckDB + CSV + validação + consulta) e guarda o resultado
let dadosPromise = null;
function carregarDados() {
    if (!dadosPromise) {
        dadosPromise = (async () => {
            const ev = new ElectricCars();

            // 1. Inicializa o DuckDB e carrega o CSV da IEA
            setStatus('Carregando DuckDB e dados...');
            await ev.init();
            await ev.loadCsv();

            // 2. Valida os dados (88 registros = 11 anos x 8 tipos, sem nulos/negativos)
            const valido = await ev.validate();
            console.log('Dados válidos:', valido);

            // 3. Consulta no formato longo (ano, tipo, estoque) para o D3
            const data = await ev.getLongData();
            console.log(data);
            return data;
        })();
        // Se falhar, permite tentar novamente no próximo clique
        dadosPromise.catch(() => { dadosPromise = null; });
    }
    return dadosPromise;
}

// Liga os botões imediatamente, sem esperar o carregamento dos dados
const loadBtn  = document.querySelector('#loadBtn');
const clearBtn = document.querySelector('#clearBtn');

// Botão "Load Chart": carrega os dados (se ainda não carregaram) e desenha os dois gráficos
loadBtn?.addEventListener('click', async () => {
    try {
        const data = await carregarDados();
        await loadChart(data);      // gráfico de colunas
        await loadLineChart(data);  // gráfico de linhas, logo abaixo
        setStatus(`Gráficos carregados (${data.length} registros).`);
    } catch (e) {
        // Mostra o erro na página para facilitar o diagnóstico
        setStatus(`Erro: ${e.message}`, true);
    }
});

// Botão "Clear Chart": remove o desenho dos dois gráficos
clearBtn?.addEventListener('click', () => {
    clearChart();
    setStatus('Gráficos limpos.');
});

// Começa a carregar os dados em segundo plano assim que a página abre
carregarDados()
    .then(() => setStatus('Dados prontos. Clique em "Load Chart".'))
    .catch(e => setStatus(`Erro: ${e.message}`, true));
