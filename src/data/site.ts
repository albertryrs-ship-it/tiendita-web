// Única fuente de verdad: nombre, URLs, navegación y contacto.
// Cualquier enlace del header/footer sale de aquí.

export const site = {
	name: 'Mi Tiendita',
	url: 'https://mitiendita.wuju.dev',
	locale: 'es-SV',
	ogLocale: 'es_SV',
	tagline: 'Punto de venta para tiendas locales',
	description:
		'Mi Tiendita es un punto de venta simple para tiendas locales: registrá ventas, controlá tu inventario y mirá qué conviene reponer.',
	parent: { name: 'WUJU', url: 'https://wuju.dev' },
	// Por confirmar: wuju.dev usa contacto@wuju.dev. WhatsApp pendiente.
	email: 'contacto@wuju.dev',
	whatsapp: null as string | null,
	defaultOgImage: '/og/default.jpg',
} as const;

export interface NavLink {
	label: string;
	href: string;
}

// Menú principal: 5 enlaces + CTA. "Precios" se agrega cuando existan precios reales.
export const mainNav: NavLink[] = [
	{ label: 'Funciones', href: '/funciones/' },
	{ label: 'Cómo funciona', href: '/como-funciona/' },
	{ label: 'Guías', href: '/guias/' },
	{ label: 'Ayuda', href: '/ayuda/' },
];

export const cta: NavLink = { label: 'Pedí una demo', href: '/demo/' };

export interface FooterGroup {
	title: string;
	links: (NavLink & { external?: boolean })[];
}

export const footerGroups: FooterGroup[] = [
	{
		title: 'Producto',
		links: [
			{ label: 'Funciones', href: '/funciones/' },
			{ label: 'Punto de venta', href: '/funciones/punto-de-venta/' },
			{ label: 'Inventario', href: '/funciones/inventario/' },
			{ label: 'Reportes y decisiones', href: '/funciones/reportes-y-decisiones/' },
			{ label: 'Cómo funciona', href: '/como-funciona/' },
		],
	},
	{
		title: 'Recursos',
		links: [
			{ label: 'Guías', href: '/guias/' },
			{ label: 'Ayuda', href: '/ayuda/' },
			{ label: 'Pedí una demo', href: '/demo/' },
		],
	},
	{
		title: 'Compañía',
		links: [
			{ label: 'Nosotros', href: '/nosotros/' },
			{ label: 'WUJU', href: 'https://wuju.dev', external: true },
		],
	},
	{
		title: 'Legal',
		links: [
			{ label: 'Privacidad', href: '/privacidad/' },
			{ label: 'Términos', href: '/terminos/' },
		],
	},
];
