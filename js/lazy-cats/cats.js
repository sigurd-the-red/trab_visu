import { loadDb } from "../config";

const CSV_FILE = "../../data/lazy-cats.csv";

export class CatsData {
  async init() {
    this.db = await loadDb();
    this.conn = await this.db.connect();
  }

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

  async query(sql) {
    const result = await this.conn.query(sql);
    return result.toArray().map((row) => row.toJSON());
  }

  // Design A: 
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

  // Design B: percentual de repouso por gato e estação.
  // Repouso = deitar + sentar.
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
