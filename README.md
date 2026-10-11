# Redesign da tabela do CPI (Our World in Data)

    npm install
    npm run dev      # abre em http://localhost:5173

Estrutura: `index.html`, `index.css`, `package.json`, `vite.config.js`, `public/` (dados e imagem original) e `src/`
(`config.js` carrega o DuckDB-WASM, `cpi.js` consulta os dados, `picker.js` é o seletor de países,
`plot_bars.js` é o Design 1, `plot_lines.js` é o Design 2, `shared.js` guarda constantes e a dica de mouse, `main.js` liga tudo).
