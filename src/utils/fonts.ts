export interface FontOption {
  id: string;
  name: string;
  category: "google" | "system" | "local";
  fontCss: string;
}

export const DEFAULT_FONTS: FontOption[] = [
  // Web / Google Fonts
  { id: "montserrat", name: "Montserrat (Moderna)", category: "google", fontCss: "'Montserrat', sans-serif" },
  { id: "oswald", name: "Oswald (Cine / Titulares)", category: "google", fontCss: "'Oswald', sans-serif" },
  { id: "anton", name: "Anton (Impactante Titular)", category: "google", fontCss: "'Anton', sans-serif" },
  { id: "bebasneue", name: "Bebas Neue (Cine Moderno)", category: "google", fontCss: "'Bebas Neue', sans-serif" },
  { id: "inter", name: "Inter (Limpia & Clara)", category: "google", fontCss: "'Inter', sans-serif" },
  { id: "roboto", name: "Roboto (Estándar Google)", category: "google", fontCss: "'Roboto', sans-serif" },
  { id: "opensans", name: "Open Sans (Lectura Clara)", category: "google", fontCss: "'Open Sans', sans-serif" },
  { id: "playfair", name: "Playfair Display (Elegante)", category: "google", fontCss: "'Playfair Display', serif" },
  { id: "firacode", name: "Fira Code (Monospaciada)", category: "google", fontCss: "'Fira Code', monospace" },
  { id: "quicksand", name: "Quicksand (Redondeada)", category: "google", fontCss: "'Quicksand', sans-serif" },
  { id: "caveat", name: "Caveat (Manuscrita)", category: "google", fontCss: "'Caveat', cursive" },

  // Standard Windows / OS System Fonts
  { id: "impact", name: "Impact (Sistema Windows)", category: "system", fontCss: "Impact, 'Arial Black', sans-serif" },
  { id: "arial", name: "Arial (Sistema Universal)", category: "system", fontCss: "Arial, sans-serif" },
  { id: "arialblack", name: "Arial Black (Sistema Grueso)", category: "system", fontCss: "'Arial Black', Gadget, sans-serif" },
  { id: "segoeui", name: "Segoe UI (Windows 10/11)", category: "system", fontCss: "'Segoe UI', Tahoma, Geneva, sans-serif" },
  { id: "tahoma", name: "Tahoma (Sistema Legible)", category: "system", fontCss: "Tahoma, Verdana, sans-serif" },
  { id: "trebuchet", name: "Trebuchet MS (Sistema Sans)", category: "system", fontCss: "'Trebuchet MS', sans-serif" },
  { id: "verdana", name: "Verdana (Sistema Ancho)", category: "system", fontCss: "Verdana, Geneva, sans-serif" },
  { id: "georgia", name: "Georgia (Sistema Serif)", category: "system", fontCss: "Georgia, serif" },
  { id: "times", name: "Times New Roman (Clásica)", category: "system", fontCss: "'Times New Roman', Times, serif" },
  { id: "courier", name: "Courier New (Sistema Mono)", category: "system", fontCss: "'Courier New', Courier, monospace" },
  { id: "comicsans", name: "Comic Sans MS (Casual)", category: "system", fontCss: "'Comic Sans MS', cursive, sans-serif" },
];

/**
 * Get CSS font-family string for a given font ID
 */
export function getFontCss(fontId: string): string {
  const font = DEFAULT_FONTS.find((f) => f.id === fontId || f.name.toLowerCase() === fontId.toLowerCase());
  if (font) return font.fontCss;
  // If not found in defaults, treat as a custom system font name directly
  return `'${fontId}', sans-serif`;
}

/**
 * Detect locally installed system fonts using window.queryLocalFonts() (Local Font Access API)
 */
export async function getInstalledSystemFonts(): Promise<FontOption[]> {
  const fontsMap = new Map<string, FontOption>();

  // Add default fonts first
  DEFAULT_FONTS.forEach((f) => fontsMap.set(f.name.toLowerCase(), f));

  // Query local system fonts if supported by browser (Chrome 103+, Edge)
  if (typeof window !== "undefined" && "queryLocalFonts" in window) {
    try {
      const localFonts = await (window as any).queryLocalFonts();
      const fontFamilies = new Set<string>();

      for (const fontData of localFonts) {
        if (fontData.family) {
          fontFamilies.add(fontData.family);
        }
      }

      Array.from(fontFamilies)
        .sort()
        .forEach((family) => {
          const key = family.toLowerCase();
          if (!fontsMap.has(key)) {
            fontsMap.set(key, {
              id: key.replace(/\s+/g, "_"),
              name: `💻 ${family} (Instalada)`,
              category: "local",
              fontCss: `'${family}', sans-serif`,
            });
          }
        });
    } catch (err) {
      console.warn("Local Font Access API not permitted or available:", err);
    }
  }

  return Array.from(fontsMap.values());
}
