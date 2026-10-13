import { loadDb } from '../config.js';


//transforma uma lista de nomes em texto pronto p/SQL "IN (...)"
const sqlList = names => names.map(c => `'${c.replace(/'/g, "''")}'`).join(",");

//abre o DuckDB, carrega o CSV, cria as tabelas e reponde as consultas
export class Cpi {
  
  //abre o banco e uma conexao
  async init() {
    this.db = await loadDb();
    this.conn = await this.db.connect();
    this.queue = Promise.resolve();
  }

  //traz o CSV da pasta data para dentro do DuckDB
  async loadCsv(url = '../../data/cpi.csv') {
    if (!this.db) throw new Error('Database not initialized. Please call init() first.');
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Não foi possível carregar ${url} (HTTP ${res.status})`);
    await this.db.registerFileText('cpi.csv', await res.text());
  }

   // executa SQL e devolve linhas como objetos JavaScript
    query(sql) {
    if (!this.conn) throw new Error('Database not initialized. Please call init() first.');
    this.queue = this.queue.catch(() => {}).then(async () => (await this.conn.query(sql)).toArray().map(r => r.toJSON()));
    return this.queue;
  }
  
  // cria as tabelas de trabalho
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
  
  //retorna entidades q tem algum CPI
  entities() {
    return this.query(`SELECT country, region, s12::DOUBLE s12, s24::DOUBLE s24, (s24 - s12)::DOUBLE d FROM ent WHERE n > 0 ORDER BY country`);
  }

  //retorna nome de entidades sem CPI
  withoutCpi() {
    return this.query(`SELECT country FROM ent WHERE n = 0 ORDER BY country`);
  }

  //devolve (país, ano, CPI) dos paises pedidos p/os graficos
  series(countries) {
    return this.query(`SELECT country, year::INT AS year, score::DOUBLE AS score FROM allrows
                       WHERE score IS NOT NULL AND country IN (${sqlList(countries)}) ORDER BY country, year`);
  }

  //conta quantos valores de CPI o CSV tem para os países pedidos.
  async countValues(countries) {
    return (await this.query(`SELECT COUNT(score)::INT AS c FROM allrows WHERE country IN (${sqlList(countries)})`))[0].c;
  }
}
