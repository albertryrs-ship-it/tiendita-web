# Mi Tiendita

Sitio web de **Mi Tiendita**, un punto de venta liviano para tiendas locales que ayuda a decidir qué reponer, qué se vende y cuánto se gana. Es un producto de [WUJU](https://wuju.dev) y vivirá en `mitiendita.wuju.dev`.

Astro 7 · salida estática · CSS plano con variables · voseo salvadoreño (`es-SV`).

## Comandos

| Comando             | Acción                                   |
| :------------------ | :--------------------------------------- |
| `npm install`       | Instala dependencias                     |
| `astro dev --background` | Servidor de desarrollo en `localhost:4321` |
| `npm run build`     | Genera el sitio en `./dist/`             |
| `npm run preview`   | Sirve el build localmente                |

## Dónde tocar qué

- `src/data/site.ts`: nombre, URL, menú, footer y contacto. Única fuente de verdad de la navegación.
- `src/styles/tokens.css`: paleta, tipografía, espaciado y temas claro/oscuro.
- `src/styles/global.css`: reset y las pocas piezas compartidas (`.container`, `.btn`, `.link-arrow`, `.rule`, `.eyebrow`).
- `src/layouts/Layout.astro`: `<head>` con SEO, datos estructurados, script de tema/menú, header y footer.
- `src/components/`: `SEO`, `JsonLd`, `Header`, `Footer`, `ThemeToggle`, `Breadcrumbs`.

## Reglas de diseño

Tipografía y espacio hacen el trabajo, no las cajas: secciones separadas por aire y línea punteada, listas con numeral, **un solo botón relleno por pantalla** (lo secundario es un enlace con flecha), sin cápsulas ni sombras. Las bandas (hero, CTA final, footer) usan la clase `.band`.

## Paleta

- **Claro:** blanco + grises; el verde (escala `--green-*`) es solo acento: enlaces, botón y numerales.
- **Oscuro:** negro + grises + blanco, sin verde.
- **Cambios de sección:** saltos de tono pequeños, no de color, y graduales. La banda (`.band`: hero, CTA final, footer) es un paso más gris que la base (blanco → `--gray-100` en claro, negro → `--gray-900` en oscuro) y sus bordes se funden con el fondo con un degradado suavizado, sin corte duro. Largo del fundido: `--fade-top` / `--fade-bottom` (el footer usa `--fade-bottom: 0px`).
- **Cambio de tema:** fundido de toda la página con View Transitions (0.3 s). Sin soporte o con `prefers-reduced-motion`, el cambio es instantáneo.
- Los componentes nunca usan colores de la escala directamente, solo los tokens semánticos (`--bg`, `--heading`, `--text`, `--muted`, `--accent`, `--rule`, `--btn-bg`, `--btn-ink`, y `--band-bg`/`--band-muted` para la banda). Cambiar la paleta es tocar solo `src/styles/tokens.css`.

## Mascota

Panda rojo con casco y chaleco de obra, recortado de una hoja de 8 poses (fondo quitado a mano, PNG con transparencia). **Cambia de pose con el tema:**

| Tema | Pose | Archivo |
| :--- | :--- | :--- |
| Claro | Señalando con el plano (espejada, para señalar hacia el texto) | `src/assets/mascota-senalando.png` |
| Oscuro | Saludando con guiño | `src/assets/mascota-saludando.png` |

Se alterna solo con CSS, con el mismo estado que usan los tokens (ver `src/pages/index.astro`). Las dos imágenes se cargan siempre (≈ 27 kB cada una) para que el cambio de tema no deje un hueco; se dimensionan por **alto** porque sus proporciones difieren. Son decorativas (`alt=""`). Resolución de origen ≈ 300×430: si se tiene una versión mayor, reemplazar los archivos. En oscuro la pose lleva un borde claro finísimo (`drop-shadow`) porque su contorno negro se pierde contra el fondo.

## Viento

Experimento del hero: un viento sopla **de izquierda a derecha contra la mascota** (que mira hacia la izquierda). Hojas cruzan toda la pantalla, esquivan al personaje y él se afirma contra el viento (se inclina ~3–5° apoyado en los pies, con un leve temblor en las ráfagas).

- **Motor:** `src/scripts/wind.ts` (canvas 2D, sin librerías, ~2.6 kB comprimido). `src/components/WindEffect.astro` pone el canvas y carga el script; solo la página de inicio lo usa.
- **Contrato con el HTML:** `[data-wind-zone]` (el hero: el efecto corre solo mientras se ve), `[data-wind-target]` (imágenes de la mascota), `[data-wind-quiet]` (bloques de texto: las hojas se atenúan encima para no estorbar la lectura).
- **Colores:** tokens `--leaf-1..3` en `tokens.css` (verdes en claro, grises en oscuro).
- **Accesibilidad:** con `prefers-reduced-motion: reduce` no corre nada (ni en caliente). La capa es `aria-hidden` y no intercepta clics. **No hay botón de pausa** (se quitó a pedido): el efecto es continuo mientras el hero está visible, así que la única forma de detenerlo es la preferencia de movimiento reducido del sistema o salir del hero.
- **Rendimiento:** solo corre con el hero visible y la pestaña activa (fuera: 0 fotogramas por segundo). Escala `devicePixelRatio` con tope 2. Si los fotogramas promedian > 24 ms durante 1.5 s, baja un 30 % las hojas (mínimo 8). Medido con CPU ×4 en escritorio y ×6 en móvil: 60 fps, sin tareas largas ni desplazamiento de layout.
- **Afinar:** constantes al inicio de `wind.ts` (`LEAN_*`, `BASE_SPEED`, `QUIET_ALPHA`...); cantidad y tamaño de hojas en `targetCount()` y `makeLeaf()`. Para invertir la inclinación ("empujado hacia atrás" en vez de "afirmándose"), `LEAN_DIRECTION = 1`.
- **Quitarlo:** borrar `<WindEffect />`, los `data-wind-*` y el botón de `index.astro`; el resto no depende de él.

## Contenido

No se inventan precios, funciones, cifras ni reseñas. Lo que no esté confirmado se deja fuera del menú y del sitemap. wuju.dev describe hoy a Mi Tiendita como "en definición".
