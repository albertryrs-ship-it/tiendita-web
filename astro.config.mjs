// @ts-check
import { defineConfig, fontProviders } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
	site: 'https://mitiendita.wuju.dev',
	trailingSlash: 'always',
	build: { format: 'directory' },
	integrations: [sitemap()],
	fonts: [
		{
			// Noto Sans variable (100–900). El build la descarga de Google Fonts y la sirve desde
			// nuestro dominio: sin preconnect ni CSS de terceros en cada visita.
			provider: fontProviders.google(),
			name: 'Noto Sans',
			cssVariable: '--font-brand',
			weights: ['100 900'],
			styles: ['normal', 'italic'],
			subsets: ['latin'],
			display: 'swap',
			fallbacks: ['system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
		},
	],
});
