import * as duckdb from '@duckdb/duckdb-wasm';

/**
 * loadDb — cria e devolve uma instância assíncrona do DuckDB-WASM pronta para uso, sem precisar de bundler.
 * Como: (1) getJsDelivrBundles lista os pacotes do DuckDB hospedados no CDN jsDelivr e selectBundle escolhe o
 * mais adequado ao navegador; (2) como o script do worker está em outro domínio (o navegador não deixa criar um
 * Worker direto de outra origem), cria-se um pequeno worker local via Blob que apenas executa importScripts()
 * do script do CDN; (3) cria o AsyncDuckDB com esse worker e o instancia carregando o módulo WebAssembly;
 * (4) libera a URL temporária do Blob e devolve o banco (a classe Cpi abre a conexão depois).
 */
export async function loadDb() {
  const bundle = await duckdb.selectBundle(duckdb.getJsDelivrBundles());

  const url = URL.createObjectURL(new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' }));
  const db = new duckdb.AsyncDuckDB(new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING), new Worker(url));
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(url);

  return db;
}
