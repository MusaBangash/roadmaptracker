// Light, dark, or the same as this computer (same as NoorAI Lab Studio, src/theme/config.ts).
// Remembered in a cookie. The theme is set on <html data-theme="...">; tokens.css does the rest.
export const themes = ["light", "dark", "system"] as const;
export type Theme = (typeof themes)[number];
export const THEME_COOKIE = "noorai-theme";

export function isTheme(value: unknown): value is Theme {
  return typeof value === "string" && (themes as readonly string[]).includes(value);
}

// Runs before the page paints, so "system" never flashes the wrong theme. Kept tiny and
// self-contained: it is inlined into <head>.
export const themeScript = `(function(){try{
var m=document.cookie.match(/(?:^|; )${THEME_COOKIE}=(light|dark|system)/);
var t=m?m[1]:"system";
if(t==="system"){t=window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light";}
document.documentElement.setAttribute("data-theme",t);
}catch(e){}})();`;
