# Redesign da tabela do CPI (Our World in Data)

Site estático: não precisa de build. D3 e DuckDB-WASM são carregados do CDN jsDelivr por um *import map* em `index.html`.

## Publicar no GitHub Pages
1. Suba o conteúdo desta pasta para a **raiz** do repositório (`index.html` na raiz, junto de `src/`, `data/` e `.nojekyll`).
2. Settings > Pages > Source: "Deploy from a branch" > branch `main` / pasta `/ (root)`.

## Rodar localmente
É preciso um servidor (abrir o arquivo com duplo clique não funciona): `npm start` ou `python -m http.server 8000`.

## Estrutura
`index.html`, `index.css`, `package.json`, `data/` (cpi.csv e imagem original) e `src/`: `config.js` (DuckDB-WASM), `cpi.js` (consultas),
`picker.js` (seletor de países), `plot_bars.js` (Design 1), `plot_lines.js` (Design 2), `shared.js`, `main.js`.
