import { createHighlighter, type Highlighter } from "shiki";
import { customTheme, shikiLangs } from "$lib/markdown/shikiTheme.js";

let highlighterPromise: Promise<Highlighter> | null = null;

function getHighlighter(): Promise<Highlighter> {
  highlighterPromise ??= createHighlighter({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    themes: [customTheme as any],
    langs: shikiLangs,
  });
  return highlighterPromise;
}

/**
 * Highlight a snippet with the same theme the docs use, and tag the <pre> with
 * `display` so it picks up the site's terminal-bezel treatment from
 * css/snapdesign.scss. Runs server-side only — shiki never reaches the client.
 */
export async function highlightCode(code: string, lang: string): Promise<string> {
  const highlighter = await getHighlighter();
  const html = highlighter.codeToHtml(code, { lang, theme: "custom-theme" });
  return html.replace('<pre class="', '<pre class="display ');
}
