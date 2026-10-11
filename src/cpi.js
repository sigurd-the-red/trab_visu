import { loadDb } from './config.js';

/**
 * sqlList — transforma uma lista de nomes em texto pronto para a cláusula SQL "IN (...)".
 * Como: envolve cada nome em aspas simples e duplica as aspas internas (regra de escape do SQL),
 * o que é necessário para nomes como "Cote d'Ivoire"; depois une tudo com vírgulas.
 */
const sqlList = names => names.map(c => `'${c.replace(/'/g, "''")}'`).join(",");

// Camada de dados do projeto (papel equivalente ao taxi.js do exemplo): abre o DuckDB, carrega o CSV,
// cria as tabelas de trabalho e responde às consultas usadas pelos gráficos.
export class Cpi {
  /**
   * init — abre o banco e uma conexão.
   * Como: chama loadDb() (config.js), abre uma conexão e cria a "fila" de consultas (uma Promise
   * encadeada) usada por query().
   */
  async init() {
    this.db = await loadDb();
    this.conn = await this.db.connect();
    this.queue = Promise.resolve();
  }

  /**
   * loadCsv — traz o CSV da pasta data para dentro do DuckDB.
   * Como: faz fetch do arquivo, lê o texto e o registra como arquivo virtual "cpi.csv" no DuckDB-WASM;
   * a partir daí o SQL pode ler o arquivo com read_csv_auto('cpi.csv').
   */
  async loadCsv(url = 'data/cpi.csv') {
    if (!this.db) throw new Error('Database not initialized. Please call init() first.');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Não foi possível carregar ${url} (HTTP ${res.status})`);
    await this.db.registerFileText('cpi.csv', await res.text());
  }

  /**
   * query — executa um SQL e devolve as linhas como objetos JavaScript.
   * Como: o DuckDB-WASM não aceita duas consultas ao mesmo tempo na mesma conexão, então cada chamada
   * é encadeada em "this.queue" (executa só quando a anterior termina). O resultado Arrow vira array
   * (toArray) e cada linha vira objeto (toJSON). Os SQL convertem números com ::INT / ::DOUBLE para
   * evitar BigInt.
   */
  query(sql) {
    if (!this.conn) throw new Error('Database not initialized. Please call init() first.');
    this.queue = this.queue.catch(() => {}).then(async () => (await this.conn.query(sql)).toArray().map(r => r.toJSON()));
    return this.queue;
  }

  /**
   * prepare — cria as tabelas de trabalho; NENHUMA linha do CSV é descartada.
   * Como: (1) allrows = todas as linhas do CSV, com nomes de colunas simples; a região, que só vem
   * preenchida nas linhas de 2023, é propagada para todos os anos do país (any_value ... FILTER +
   * junção por país). (2) ent = uma linha por entidade, com CPI de 2012 e 2024 (max ... FILTER),
   * quantidade de anos com CPI, primeiro/último ano e valor (min/max e arg_min/arg_max). (3) pair =
   * visão com as entidades que têm CPI em 2012 e 2024.
   */
  async prepare() {
    await this.query(`
      CREATE TABLE allrows AS
      WITH raw AS (
        SELECT Entity AS country, Code AS iso3, Year AS year, "Corruption Perceptions Index"::DOUBLE AS score,
               "World regions according to OWID" AS region FROM read_csv_auto('cpi.csv')),
      reg AS (SELECT country, any_value(region) FILTER (WHERE region IS NOT NULL) AS region FROM raw GROUP BY country)
      SELECT r.country, r.iso3, r.year, r.score, g.region FROM raw r JOIN reg g USING (country)`);
    await this.query(`
      CREATE TABLE ent AS
      SELECT country, any_value(iso3) AS iso3, any_value(region) AS region,
             max(score) FILTER (WHERE year = 2012) AS s12, max(score) FILTER (WHERE year = 2024) AS s24,
             count(score)::INT AS n,
             min(year) FILTER (WHERE score IS NOT NULL) AS y0, max(year) FILTER (WHERE score IS NOT NULL) AS y1,
             arg_min(score, year) FILTER (WHERE score IS NOT NULL) AS f0, arg_max(score, year) FILTER (WHERE score IS NOT NULL) AS f1
      FROM allrows GROUP BY country`);
    await this.query(`CREATE VIEW pair AS SELECT * FROM ent WHERE s12 IS NOT NULL AND s24 IS NOT NULL`);
  }

  /**
   * validation — devolve as verificações de qualidade dos dados (rótulo k, valor v).
   * Como: uma única consulta com UNION ALL; cada bloco conta algo (linhas, vazios, entidades, duplicatas
   * país-ano, valores fora de 0–100), permitindo conferir que nada se perdeu na carga.
   */
  validation() {
    return this.query(`
      SELECT 'Linhas do CSV' k, COUNT(*)::INT v FROM allrows
      UNION ALL SELECT 'Linhas com CPI', COUNT(score)::INT FROM allrows
      UNION ALL SELECT 'Linhas com CPI vazio (sem valor para desenhar)', (COUNT(*) - COUNT(score))::INT FROM allrows
      UNION ALL SELECT 'Entidades no CSV', COUNT(*)::INT FROM ent
      UNION ALL SELECT 'Entidades sem nenhum CPI', COUNT(*)::INT FROM ent WHERE n = 0
      UNION ALL SELECT 'Entidades com CPI só em parte (sem 2012 ou sem 2024)', COUNT(*)::INT FROM ent WHERE n > 0 AND (s12 IS NULL OR s24 IS NULL)
      UNION ALL SELECT 'Entidades com CPI em 2012 e 2024 (pontos do Design 1)', COUNT(*)::INT FROM pair
      UNION ALL SELECT 'Duplicatas país-ano', (COUNT(*) - COUNT(DISTINCT (country, year)))::INT FROM allrows
      UNION ALL SELECT 'Valores fora de [0, 100]', COUNT(*)::INT FROM allrows WHERE score < 0 OR score > 100`);
  }

  /**
   * entities — devolve as entidades que têm algum CPI (as selecionáveis nos dois designs).
   * Como: lê a tabela "ent" filtrando n > 0 e calcula a variação d = s24 - s12 (nula se faltar um dos anos).
   */
  entities() {
    return this.query(`SELECT country, region, s12::DOUBLE s12, s24::DOUBLE s24, (s24 - s12)::DOUBLE d FROM ent WHERE n > 0 ORDER BY country`);
  }

  /**
   * withoutCpi — devolve os nomes das entidades sem nenhum CPI no CSV.
   * Como: filtra a tabela "ent" por n = 0. Elas não têm o que desenhar e são listadas na página.
   */
  withoutCpi() {
    return this.query(`SELECT country FROM ent WHERE n = 0 ORDER BY country`);
  }

  /**
   * series — devolve os pontos (país, ano, CPI) dos países pedidos, para o gráfico de linhas.
   * Como: consulta "allrows" ignorando valores vazios e filtrando com IN (sqlList(...)).
   */
  series(countries) {
    return this.query(`SELECT country, year::INT AS year, score::DOUBLE AS score FROM allrows
                       WHERE score IS NOT NULL AND country IN (${sqlList(countries)}) ORDER BY country, year`);
  }

  /**
   * countValues — conta quantos valores de CPI o CSV tem para os países pedidos.
   * Como: COUNT(score) ignora nulos. Serve de referência para a conferência "valores desenhados × CSV".
   */
  async countValues(countries) {
    return (await this.query(`SELECT COUNT(score)::INT AS c FROM allrows WHERE country IN (${sqlList(countries)})`))[0].c;
  }
}
