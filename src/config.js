import * as duckdb from '@duckdb/duckdb-wasm';
import duckdb_wasm from '@duckdb/duckdb-wasm/dist/duckdb-mvp.wasm?url';
import mvp_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-mvp.worker.js?url';
import duckdb_wasm_eh from '@duckdb/duckdb-wasm/dist/duckdb-eh.wasm?url';
import eh_worker from '@duckdb/duckdb-wasm/dist/duckdb-browser-eh.worker.js?url';

// Pacotes do DuckDB-WASM disponíveis: "mvp" (compatível com qualquer navegador) e "eh" (com tratamento
// de exceções nativo, mais rápido). O sufixo "?url" faz o Vite devolver o endereço final de cada arquivo.
const MANUAL_BUNDLES = {
  mvp: {
    mainModule: duckdb_wasm,
    mainWorker: mvp_worker,
  },
  eh: {
    mainModule: duckdb_wasm_eh,
    mainWorker: eh_worker,
  },
};

/**
 * loadDb — cria e devolve uma instância assíncrona do DuckDB-WASM pronta para uso.
 * Como: (1) selectBundle testa os recursos do navegador e escolhe "eh" ou "mvp"; (2) cria um Web Worker
 * com o script do pacote escolhido, onde o banco roda sem travar a página; (3) cria o AsyncDuckDB com um
 * logger de console e o instancia carregando o módulo WebAssembly; (4) devolve o banco para quem chamou
 * (a classe Cpi abre a conexão depois).
 */
export async function loadDb() {
  // Seleciona o pacote conforme as verificações do navegador
  const bundle = await duckdb.selectBundle(MANUAL_BUNDLES);

  // Instancia a versão assíncrona do DuckDB-WASM
  const worker = new Worker(bundle.mainWorker);
  const logger = new duckdb.ConsoleLogger();
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);

  return db;
}
