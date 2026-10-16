/**
 * Efecto de viento: hojas que cruzan la pantalla de izquierda a derecha contra la mascota,
 * y la mascota que se afirma contra él. Canvas 2D, sin librerías.
 *
 * Contrato con el HTML (ver WindEffect.astro e index.astro):
 *   canvas[data-wind-canvas]   capa fija a pantalla completa
 *   [data-wind-zone]           el hero: el efecto corre solo mientras se ve
 *   [data-wind-target]         imágenes de la mascota (se mueve la que está visible)
 *   [data-wind-quiet]          bloques de texto: sobre ellos las hojas se atenúan para no estorbar la lectura
 *
 * Colores: tokens --leaf-1..3 de tokens.css (verdes en claro, grises en oscuro).
 */

/** -1 = el personaje se afirma contra el viento (se inclina hacia donde mira); 1 = empujado hacia atrás. */
const LEAN_DIRECTION = -1;
const LEAN_BASE_DEG = 1.2;
const LEAN_GAIN_DEG = 3.4;
/** Empuje hacia atrás en px por unidad de viento. */
const PUSH_PX = 2.5;

const BASE_SPEED = 200; // px/s para una hoja "media" con viento 1
const FALL = 18; // px/s de caída suave
const MIN_LEAVES = 8;
const QUIET_ALPHA = 0.3; // opacidad relativa de una hoja sobre una zona quieta
const SLOW_FRAME_MS = 24;
const SLOW_FOR_MS = 1500;

interface Leaf {
	x: number;
	y: number;
	vx: number;
	vy: number;
	size: number; // medio largo en px
	depth: number; // 0 lejos .. 1 cerca
	angle: number;
	spin: number;
	flip: number;
	flipSpeed: number;
	flutterFreq: number;
	flutterAmp: number;
	phase: number;
	color: number;
	alpha: number;
	quiet: number; // 1 normal .. QUIET_ALPHA sobre texto (se suaviza para que no "parpadee")
}

interface Obstacle {
	cx: number;
	cy: number;
	rx: number;
	ry: number;
}

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));

// Hoja unitaria (largo -1..1) y su nervadura.
const LEAF = new Path2D();
LEAF.moveTo(0, -1);
LEAF.bezierCurveTo(0.85, -0.55, 0.85, 0.45, 0, 1);
LEAF.bezierCurveTo(-0.85, 0.45, -0.85, -0.55, 0, -1);
LEAF.closePath();
const VEIN = new Path2D();
VEIN.moveTo(0, -0.9);
VEIN.lineTo(0, 1.1);

/** Viento compartido por las hojas y el personaje: marea lenta + ráfagas que suben y bajan. */
function windAt(t: number): { wind: number; gust: number } {
	const swell = Math.sin(t * 0.55) * 0.5 + Math.sin(t * 0.23 + 1.7) * 0.5; // -1..1
	const gust = Math.pow(Math.max(0, Math.sin(t * 0.37 + 0.6)), 4); // 0..1, picos cortos
	return { wind: clamp(0.62 + 0.22 * swell + 0.38 * gust, 0.2, 1.2), gust };
}

export function initWind(): void {
	const canvas = document.querySelector<HTMLCanvasElement>('[data-wind-canvas]');
	const zone = document.querySelector<HTMLElement>('[data-wind-zone]');
	const targets = Array.from(document.querySelectorAll<HTMLElement>('[data-wind-target]'));
	const quietEls = Array.from(document.querySelectorAll<HTMLElement>('[data-wind-quiet]'));
	const ctx = canvas?.getContext('2d');
	if (!canvas || !zone || !ctx) return;

	const root = document.documentElement;
	const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
	const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');

	let reduced = reducedQuery.matches;
	let inView = false;
	let width = 0;
	let height = 0;
	let dpr = 1;

	let leaves: Leaf[] = [];
	let palette: string[] = ['#8cc7a1', '#5aab79', '#277349'];
	let obstacle: Obstacle | null = null;
	let quietRects: DOMRect[] = [];

	let raf = 0;
	let last = 0;
	let t = 0;
	let presence = 0; // 0 apagado .. 1 pleno: suaviza la entrada y la salida
	let lean = 0;
	let avgMs = 0;
	let slowSince = 0;
	let frames = 0;

	// ---------- utilidades de estado ----------

	function shouldRun(): boolean {
		return inView && !reduced && !document.hidden;
	}

	function setState(state: string): void {
		canvas!.dataset.windState = state;
		canvas!.dataset.windLeaves = String(leaves.length);
	}

	// ---------- geometría ----------

	function visibleTarget(): HTMLElement | undefined {
		return targets.find((el) => el.offsetParent !== null);
	}

	function updateObstacle(): void {
		quietRects = quietEls.map((el) => el.getBoundingClientRect());
		const el = visibleTarget();
		if (!el) {
			obstacle = null;
			return;
		}
		const r = el.getBoundingClientRect();
		// Elipse un poco más chica que la caja: la silueta real es más angosta en las esquinas.
		obstacle = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, rx: r.width * 0.42, ry: r.height * 0.5 };
	}

	function targetCount(): number {
		let n = clamp(Math.round((width * height) / 28000), 16, 36);
		const nav = navigator as Navigator & { connection?: { saveData?: boolean } };
		if (nav.connection?.saveData || (navigator.hardwareConcurrency || 4) <= 2) n = Math.round(n / 2);
		return Math.max(MIN_LEAVES, n);
	}

	function resize(): void {
		const w = canvas!.clientWidth;
		const h = canvas!.clientHeight;
		if (!w || !h) return;
		const sx = width ? w / width : 1;
		const sy = height ? h / height : 1;
		width = w;
		height = h;
		dpr = Math.min(2, window.devicePixelRatio || 1);
		canvas!.width = Math.round(w * dpr);
		canvas!.height = Math.round(h * dpr);
		// Conserva la distribución al redimensionar.
		for (const leaf of leaves) {
			leaf.x *= sx;
			leaf.y *= sy;
		}
		if (!leaves.length) populate();
		updateObstacle();
	}

	// ---------- hojas ----------

	function makeLeaf(scatter: boolean): Leaf {
		const depth = Math.pow(Math.random(), 1.2);
		const size = 6 + depth * 9; // medio largo: hojas de 12 a 30 px
		const margin = size * 2 + 10;
		return {
			x: scatter ? rand(0, width) : -rand(margin, margin + width * 0.35),
			y: rand(-0.05 * height, 1.05 * height),
			vx: BASE_SPEED * (0.55 + depth) * 0.6,
			vy: 0,
			size,
			depth,
			angle: rand(0, Math.PI * 2),
			spin: rand(1, 3) * (Math.random() < 0.5 ? -1 : 1),
			flip: rand(0, Math.PI * 2),
			flipSpeed: rand(2, 5),
			flutterFreq: rand(1.2, 2.6),
			flutterAmp: rand(20, 60),
			phase: rand(0, Math.PI * 2),
			color: Math.floor(rand(0, 3)),
			alpha: 0.38 + 0.37 * depth, // tope 0.75: se notan sin tapar la lectura
			quiet: 1,
		};
	}

	function populate(): void {
		const n = targetCount();
		leaves = Array.from({ length: n }, () => makeLeaf(true));
		setState(canvas!.dataset.windState ?? 'idle');
	}

	function stepLeaf(leaf: Leaf, dt: number, wind: number): void {
		const targetVx = BASE_SPEED * (0.55 + leaf.depth) * wind * (1 + 0.12 * Math.sin(t * 1.7 + leaf.phase));
		leaf.vx += (targetVx - leaf.vx) * Math.min(1, dt * 2.2);
		const flutter = Math.sin(t * leaf.flutterFreq + leaf.phase) * leaf.flutterAmp * (0.35 + 0.65 * wind);
		leaf.vy += (FALL * (0.4 + leaf.depth) + flutter - leaf.vy) * Math.min(1, dt * 3);

		// El personaje es un obstáculo: frena a la hoja y la desvía por arriba o por abajo.
		if (obstacle) {
			const dx = (leaf.x - obstacle.cx) / obstacle.rx;
			const dy = (leaf.y - obstacle.cy) / obstacle.ry;
			const d2 = dx * dx + dy * dy;
			if (d2 < 1.6) {
				const k = (1.6 - d2) / 1.6;
				leaf.vx -= leaf.vx * Math.min(1, k * 6 * dt);
				const side = dy === 0 ? (leaf.phase > Math.PI ? 1 : -1) : Math.sign(dy);
				leaf.vy += side * k * 520 * dt;
				if (d2 < 0.9) {
					const s = Math.sqrt(0.9 / Math.max(d2, 1e-4));
					leaf.x = obstacle.cx + dx * s * obstacle.rx;
					leaf.y = obstacle.cy + dy * s * obstacle.ry;
				}
			}
		}

		leaf.x += leaf.vx * dt;
		leaf.y += leaf.vy * dt;

		const pad = 10;
		const overText = quietRects.some(
			(r) => leaf.x > r.left - pad && leaf.x < r.right + pad && leaf.y > r.top - pad && leaf.y < r.bottom + pad,
		);
		leaf.quiet += ((overText ? QUIET_ALPHA : 1) - leaf.quiet) * Math.min(1, dt * 8);

		leaf.angle += leaf.spin * dt * (0.3 + 0.7 * wind);
		leaf.flip += leaf.flipSpeed * dt * (0.5 + 0.8 * wind);

		const margin = leaf.size * 2 + 10;
		if (leaf.x > width + margin || leaf.y > height + margin || leaf.y < -margin * 4) {
			Object.assign(leaf, makeLeaf(false));
		}
	}

	function drawLeaf(leaf: Leaf): void {
		const flipScale = Math.max(0.14, Math.abs(Math.cos(leaf.flip))); // la hoja "se voltea" al girar
		ctx!.save();
		ctx!.translate(leaf.x, leaf.y);
		ctx!.rotate(leaf.angle);
		ctx!.scale(leaf.size * 0.78 * flipScale, leaf.size);
		const a = leaf.alpha * presence * leaf.quiet;
		ctx!.globalAlpha = a;
		ctx!.fillStyle = palette[leaf.color];
		ctx!.fill(LEAF);
		ctx!.globalAlpha = a * 0.45;
		ctx!.strokeStyle = 'rgba(0,0,0,0.5)';
		ctx!.lineWidth = 0.08;
		ctx!.stroke(VEIN);
		ctx!.restore();
	}

	// ---------- personaje ----------

	function applyLean(wind: number, gust: number, dt: number): void {
		const tremor = Math.sin(t * 23) * 0.18 * gust;
		const goal = LEAN_DIRECTION * (LEAN_BASE_DEG + LEAN_GAIN_DEG * wind + tremor) * presence;
		lean += (goal - lean) * Math.min(1, dt * 4);
		const push = -LEAN_DIRECTION * PUSH_PX * wind * presence;
		const css = `translate3d(${push.toFixed(2)}px,0,0) rotate(${lean.toFixed(3)}deg)`;
		for (const el of targets) el.style.transform = css;
	}

	function resetLean(): void {
		lean = 0;
		for (const el of targets) el.style.transform = '';
	}

	// ---------- bucle ----------

	function frame(now: number): void {
		raf = 0;
		const rawMs = last ? Math.min(100, now - last) : 16.7;
		last = now;
		const dt = rawMs / 1000;
		t += dt;

		const goal = shouldRun() ? 1 : 0;
		presence += (goal - presence) * (1 - Math.exp(-dt * 5));
		if (goal === 0 && presence < 0.01) {
			stop();
			return;
		}

		const { wind, gust } = windAt(t);
		ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
		ctx!.clearRect(0, 0, width, height);
		for (const leaf of leaves) {
			stepLeaf(leaf, dt, wind);
			drawLeaf(leaf);
		}
		applyLean(wind, gust, dt);
		adapt(now, rawMs);

		raf = requestAnimationFrame(frame);
	}

	/** Si los fotogramas tardan demasiado de forma sostenida, baja un 30 % las hojas. */
	function adapt(now: number, rawMs: number): void {
		frames++;
		if (frames < 30) return; // calentamiento
		avgMs = avgMs ? avgMs * 0.92 + rawMs * 0.08 : rawMs;
		if (avgMs <= SLOW_FRAME_MS) {
			slowSince = 0;
			return;
		}
		if (!slowSince) {
			slowSince = now;
		} else if (now - slowSince > SLOW_FOR_MS && leaves.length > MIN_LEAVES) {
			leaves.length = Math.max(MIN_LEAVES, Math.floor(leaves.length * 0.7));
			slowSince = 0;
			avgMs = 0;
			setState('running');
		}
	}

	function start(): void {
		if (raf) return;
		last = 0;
		frames = 0;
		avgMs = 0;
		slowSince = 0;
		updateObstacle();
		setState('running');
		raf = requestAnimationFrame(frame);
	}

	function stop(): void {
		if (raf) cancelAnimationFrame(raf);
		raf = 0;
		presence = 0;
		ctx!.setTransform(1, 0, 0, 1, 0, 0);
		ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
		resetLean();
		setState(reduced ? 'reduced' : 'idle');
	}

	/** Reevalúa si el efecto debe correr. Con movimiento reducido se apaga al instante, sin fundido. */
	function evaluate(): void {
		if (reduced) {
			stop();
		} else if (shouldRun()) {
			start();
		}
		// Si no debe correr, el bucle en marcha lo apaga solo tras el fundido de salida.
	}

	// ---------- tema ----------

	function readPalette(): void {
		const style = getComputedStyle(root);
		const read = (name: string, fallback: string) => style.getPropertyValue(name).trim() || fallback;
		palette = [read('--leaf-1', palette[0]), read('--leaf-2', palette[1]), read('--leaf-3', palette[2])];
	}

	function onTheme(): void {
		readPalette();
		updateObstacle(); // la pose visible cambia con el tema
	}

	// ---------- arranque ----------

	function setup(): void {
		readPalette();
		resize();

		new ResizeObserver(() => resize()).observe(canvas!);
		new ResizeObserver(() => updateObstacle()).observe(zone!);
		window.addEventListener('scroll', () => updateObstacle(), { passive: true });
		window.addEventListener('load', () => updateObstacle());

		new MutationObserver(onTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
		darkQuery.addEventListener?.('change', onTheme);

		reducedQuery.addEventListener?.('change', () => {
			reduced = reducedQuery.matches;
			evaluate();
		});

		document.addEventListener('visibilitychange', evaluate);

		new IntersectionObserver(
			([entry]) => {
				inView = entry.isIntersecting;
				evaluate();
			},
			{ threshold: 0.05 },
		).observe(zone!);

		setState(reduced ? 'reduced' : 'idle');
	}

	// Tras la carga y cuando el navegador esté ocioso: no compite con LCP ni INP.
	const win = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
	if (win.requestIdleCallback) win.requestIdleCallback(setup, { timeout: 1500 });
	else setTimeout(setup, 200);
}
