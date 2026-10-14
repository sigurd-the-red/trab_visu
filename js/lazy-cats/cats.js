import { loadDb } from "../config";

const CSV_FILE = "../../data/lazy-cats.csv";

export class CatsData {
  // Inicializa o banco de dados e cria uma conexão para executar consultas
  async init() {
    this.db = await loadDb();
    this.conn = await this.db.connect();
  }

  // Carrega o arquivo CSV e transforma seus dados em uma tabela SQL
  async loadCsv() {
    const response = await fetch(CSV_FILE);
    const csvText = await response.text();

    await this.db.registerFileText(CSV_FILE, csvText);
    await this.conn.query(`
      CREATE OR REPLACE TABLE cats AS
      SELECT *
      FROM read_csv_auto(
        '${CSV_FILE}',
        header = true,
        delim = ',',
        normalize_names = true
      );
    `);
  }

  // Executa uma consulta SQL e converte os resultados em objetos JavaScript
  async query(sql) {
    const result = await this.conn.query(sql);
    return result.toArray().map((row) => row.toJSON());
  }

  // Dados de atividade dos gatos para o gráfico de dispersão
  async getActivityData() {
    return this.query(`
      SELECT
        cat_id,
        season,
        housing,
        bcs_ord,
        CAST(proplying AS DOUBLE) * 100 AS lying,
        CAST(propsitting AS DOUBLE) * 100 AS sitting
      FROM cats
      WHERE
        proplying IS NOT NULL
        AND propsitting IS NOT NULL
      ORDER BY bcs_ord, season, housing, cat_id;
    `);
  }

  // Dados de repouso para o gráfico de barras
  async getRestData() {
    return this.query(`
      SELECT
        cat_id,
        season,
        housing,
        bcs_ord,
        (
          CAST(proplying AS DOUBLE) +
          CAST(propsitting AS DOUBLE)
        ) * 100 AS resting
      FROM cats
      WHERE
        proplying IS NOT NULL
        AND propsitting IS NOT NULL
      ORDER BY bcs_ord, housing, cat_id, season;
    `);
  }
}
