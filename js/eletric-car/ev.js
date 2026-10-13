import { loadDb } from '../config';

// Nome do arquivo CSV (servido a partir da pasta pública definida no vite.config.js)
const CSV_FILE = '../../data/eletric-car.csv';

// Tipos de veículo (região + tecnologia), na mesma ordem das colunas do CSV.
// BEV = elétrico a bateria; PHEV = híbrido plug-in.
const TIPOS = [
    'China BEV', 'China PHEV',
    'Europe BEV', 'Europe PHEV',
    'United States BEV', 'United States PHEV',
    'Rest of the world BEV', 'Rest of the world PHEV'
];
// Nomes das colunas do arquivo: a primeira (ano) tem célula vazia no cabeçalho original,
// por isso definimos os nomes manualmente em vez de depender da detecção automática.
const COLUNAS = ['ano', ...TIPOS];

/**
 * Encapsula o acesso aos dados de estoque global de carros elétricos via DuckDB-wasm.
 */
export class ElectricCars {
    // Inicializa o DuckDB e abre uma conexão
    async init() {
        this.db = await loadDb();
        this.conn = await this.db.connect();
        this.table = 'ev_stock_wide';
    }

    // Lê o CSV e cria a tabela "larga" (uma coluna por tipo de veículo)
    async loadCsv() {
        if (!this.db || !this.conn)
            throw new Error('Database not initialized. Please call init() first.');

        // Baixa o CSV como texto
        const res = await fetch(CSV_FILE);
        if (!res.ok)
            throw new Error(`Não foi possível carregar ${CSV_FILE} (HTTP ${res.status}).`);
        const texto = await res.text();

        // O Vite devolve o index.html (status 200) quando o arquivo não existe na pasta pública.
        // Detectamos isso para dar uma mensagem de erro clara.
        if (texto.trimStart().startsWith('<'))
            throw new Error(`${CSV_FILE} não foi encontrado na pasta pública ("00 - data"): o servidor devolveu HTML.`);

        // Limpeza do texto antes de entregá-lo ao DuckDB:
        //  - normaliza qualquer tipo de quebra de linha (\r\n, \r ou \n) para \n;
        //  - descarta as linhas de metadados (fonte, termos, unidade) e o cabeçalho,
        //    mantendo só as linhas de dados, que começam com o ano (4 dígitos) e ";".
        // Isso evita que o detector automático de CSV do DuckDB se confunda com o arquivo.
        const linhas = texto
            .replace(/^﻿/, '')                       // remove BOM (marca de ordem de bytes), se houver
            .split(/\r\n|\r|\n/)
            .filter(l => /^\s*\d{4}\s*;/.test(l));
        if (linhas.length === 0)
            throw new Error(`Nenhuma linha de dados encontrada em ${CSV_FILE}.`);

        // Registra o texto limpo no sistema de arquivos virtual do DuckDB
        await this.db.registerFileText(CSV_FILE, linhas.join('\n') + '\n');

        // Define explicitamente nomes e tipos das colunas (ano inteiro, demais DOUBLE),
        // sem depender da detecção automática de formato.
        const colunas = COLUNAS
            .map(c => `'${c}': '${c === 'ano' ? 'INTEGER' : 'DOUBLE'}'`)
            .join(', ');

        // Cria a tabela larga. Opções: separador ";", sem cabeçalho (já removido acima),
        // fim de linha "\n" (já normalizado) e strict_mode desligado para tolerar pequenas
        // irregularidades; os tipos vêm de "columns", sem detecção automática.
        await this.conn.query(`
            CREATE OR REPLACE TABLE ${this.table} AS
                SELECT *
                FROM read_csv('${CSV_FILE}',
                              delim = ';',
                              header = false,
                              new_line = '\\n',
                              strict_mode = false,
                              columns = {${colunas}});
        `);
    }

    // SQL que transforma a tabela larga em formato "longo" (ano, tipo, estoque).
    // Usamos UNION ALL (uma SELECT por tipo), que funciona em qualquer versão do DuckDB.
    longSql() {
        return TIPOS.map(t => `
            SELECT CAST(ano AS INTEGER) AS ano,
                   '${t}'               AS tipo,
                   CAST("${t}" AS DOUBLE) AS estoque
            FROM ${this.table}`).join('\nUNION ALL');
    }

    // Consulta final: formato longo ordenado, ideal para desenhar uma coluna por (ano, tipo)
    async getLongData() {
        return await this.query(`SELECT * FROM (${this.longSql()}) ORDER BY ano, tipo`);
    }

    // Validação dos dados: 11 anos x 8 tipos = 88 registros, sem nulos nem negativos
    async validate() {
        const [r] = await this.query(`
            SELECT
                COUNT(*)                                         AS total,
                COUNT(DISTINCT ano)                              AS anos,
                COUNT(DISTINCT tipo)                             AS tipos,
                SUM(CASE WHEN estoque IS NULL THEN 1 ELSE 0 END) AS nulos,
                SUM(CASE WHEN estoque < 0 THEN 1 ELSE 0 END)     AS negativos
            FROM (${this.longSql()})
        `);
        const ok = r.total === 88 && r.anos === 11 && r.tipos === 8 && r.nulos === 0 && r.negativos === 0;
        if (!ok) console.warn('Validação dos dados falhou:', r);
        return ok;
    }

    // Executa uma consulta SQL e devolve um array de objetos JS simples
    async query(sql) {
        if (!this.db || !this.conn)
            throw new Error('Database not initialized. Please call init() first.');

        const result = await this.conn.query(sql);
        // Converte BigInt (retorno de COUNT/SUM) para Number para facilitar o uso
        return result.toArray().map(row => {
            const obj = row.toJSON();
            for (const k in obj) if (typeof obj[k] === 'bigint') obj[k] = Number(obj[k]);
            return obj;
        });
    }
}
