/* ================================================================
 * CHAT FONTS
 *
 * 200 real Google Font families, grouped by category. Fonts are
 * loaded on demand (only when previewed/selected) via a <link>
 * injected into <head>, so we never pay for 200 stylesheets up
 * front — keeps this safe on mobile.
 * ================================================================ */

export type FontCategory = "sans-serif" | "serif" | "display" | "handwriting" | "monospace";

export type ChatFont = {
  id: string;
  family: string;
  category: FontCategory;
};

const SANS_SERIF = [
  "Roboto", "Open Sans", "Lato", "Montserrat", "Poppins", "Inter", "Nunito",
  "Raleway", "Work Sans", "Rubik", "Karla", "Mulish", "Manrope", "DM Sans",
  "Sora", "Outfit", "Plus Jakarta Sans", "Space Grotesk", "Urbanist",
  "Lexend", "Josefin Sans", "Quicksand", "Comfortaa", "Kanit", "Barlow",
  "Heebo", "Hind", "Titillium Web", "PT Sans", "Noto Sans", "Source Sans 3",
  "Fira Sans", "Cabin", "Oxygen", "Assistant", "Varela Round", "Overpass",
  "Exo 2", "Saira", "Jost", "Red Hat Text", "Figtree", "Public Sans",
  "Be Vietnam Pro", "Archivo", "Epilogue", "Libre Franklin", "Prompt",
  "Chakra Petch", "IBM Plex Sans", "Signika", "Catamaran", "Asap",
  "Baloo 2", "Nunito Sans", "Questrial", "Days One", "Sarabun", "Tajawal",
  "Vazirmatn", "Encode Sans",
];

const SERIF = [
  "Playfair Display", "Merriweather", "Lora", "PT Serif", "Noto Serif",
  "Crimson Text", "Cormorant Garamond", "EB Garamond", "Libre Baskerville",
  "Bitter", "Source Serif 4", "Domine", "Vollkorn", "Spectral",
  "Frank Ruhl Libre", "Zilla Slab", "Cardo", "Alegreya", "Rokkitt", "Arvo",
  "Old Standard TT", "Cormorant", "Gelasio", "Newsreader", "Petrona",
  "Piazzolla", "Literata", "DM Serif Display", "DM Serif Text", "Faustina",
  "Bree Serif", "Fraunces", "IBM Plex Serif", "Noticia Text", "Neuton",
];

const DISPLAY = [
  "Bebas Neue", "Anton", "Alfa Slab One", "Righteous", "Fredoka",
  "Baloo Bhaijaan 2", "Passion One", "Lobster", "Pacifico", "Permanent Marker",
  "Bangers", "Abril Fatface", "Staatliches", "Archivo Black", "Luckiest Guy",
  "Titan One", "Rammetto One", "Fjalla One", "Oswald", "Teko", "Bungee",
  "Bungee Shade", "Monoton", "Orbitron", "Audiowide", "Press Start 2P",
  "Black Ops One", "Chewy", "Creepster", "Special Elite", "Shrikhand",
  "Sigmar One", "Concert One", "Ultra", "Squada One", "Racing Sans One",
  "Russo One", "Bowlby One", "Wallpoet", "Voltaire", "Alfa Slab One",
  "Rye", "Trade Winds", "Bevan", "Graduate",
];

const HANDWRITING = [
  "Dancing Script", "Great Vibes", "Sacramento", "Satisfy", "Caveat",
  "Kalam", "Indie Flower", "Shadows Into Light", "Amatic SC", "Courgette",
  "Cookie", "Parisienne", "Yellowtail", "Allura", "Tangerine",
  "Marck Script", "Kaushan Script", "Homemade Apple", "Reenie Beanie",
  "Rock Salt", "Gochi Hand", "Architects Daughter", "Patrick Hand",
  "Handlee", "Neucha", "Nanum Pen Script", "Comforter", "Playball",
  "Merienda", "Delius", "Lobster Two", "Sriracha", "Just Another Hand",
  "Meddon", "Norican", "Mea Culpa", "Caveat Brush",
];

const MONOSPACE = [
  "Roboto Mono", "Space Mono", "JetBrains Mono", "Fira Code",
  "Source Code Pro", "IBM Plex Mono", "Inconsolata", "Courier Prime",
  "Ubuntu Mono", "PT Mono", "Cousine", "Overpass Mono", "Anonymous Pro",
  "DM Mono", "Red Hat Mono", "Martian Mono", "Azeret Mono",
  "Spline Sans Mono", "Major Mono Display", "Nova Mono", "VT323",
  "Share Tech Mono", "B612 Mono", "Chivo Mono", "Fragment Mono",
];

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function build(names: string[], category: FontCategory): ChatFont[] {
  return names.map((family) => ({ id: slug(family), family, category }));
}

export const FONTS: ChatFont[] = [
  ...build(SANS_SERIF, "sans-serif"),
  ...build(SERIF, "serif"),
  ...build(DISPLAY, "display"),
  ...build(HANDWRITING, "handwriting"),
  ...build(MONOSPACE, "monospace"),
];

const FALLBACK_STACK: Record<FontCategory, string> = {
  "sans-serif": "sans-serif",
  serif: "serif",
  display: "sans-serif",
  handwriting: "cursive",
  monospace: "monospace",
};

export const DEFAULT_FONT_FAMILY_CSS =
  '"Inter", "Space Grotesk", ui-sans-serif, sans-serif';

export function getFontById(fontId: string | null | undefined): ChatFont | null {
  if (!fontId) return null;
  return FONTS.find((font) => font.id === fontId) ?? null;
}

export function getFontFamilyCss(fontId: string | null | undefined): string {
  const font = getFontById(fontId);
  if (!font) return DEFAULT_FONT_FAMILY_CSS;
  return `"${font.family}", ${FALLBACK_STACK[font.category]}`;
}

const loadedFontIds = new Set<string>();

/**
 * Injects a Google Fonts stylesheet link for a single font family,
 * on demand. Safe to call repeatedly — dedupes by font id.
 */
export function loadGoogleFont(fontId: string | null | undefined): void {
  if (typeof document === "undefined") return;

  const font = getFontById(fontId);
  if (!font) return;
  if (loadedFontIds.has(font.id)) return;

  try {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.id = `gf-${font.id}`;
    const encoded = font.family.replace(/ /g, "+");
    link.href = `https://fonts.googleapis.com/css2?family=${encoded}:wght@400;600;700&display=swap`;
    document.head.appendChild(link);
    loadedFontIds.add(font.id);
  } catch {
    // Non-critical — chat still works with the fallback font.
  }
}