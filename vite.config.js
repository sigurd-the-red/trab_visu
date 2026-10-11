import { defineConfig } from 'vite';

// Tudo que está em ./public (cpi.csv e original_viz.png) é servido na raiz do site,
// por isso o código usa fetch('cpi.csv') e o HTML usa src="original_viz.png".
export default defineConfig({
  publicDir: 'public',
});
