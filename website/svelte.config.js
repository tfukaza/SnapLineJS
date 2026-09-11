import adapter from "@sveltejs/adapter-auto";
import { vitePreprocess } from "@sveltejs/vite-plugin-svelte";
import { mdsvex, escapeSvelte } from "mdsvex";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { createHighlighter } from "shiki";
import { remarkAlerts } from "./src/lib/markdown/remarkAlerts.js";
import { shikiLangs } from "./src/lib/markdown/shikiTheme.js";
import { remarkCodeTabs } from "./src/lib/markdown/remarkCodeTabs.js";
import { remarkFrameworkCodeBlocks } from "./src/lib/markdown/remarkFrameworkCodeBlocks.js";
import { remarkArticleHeadings } from "./src/lib/markdown/remarkArticleHeadings.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mdsvexLayout = join(__dirname, "src/lib/markdown/MdsvexLayout.svelte");
const docsCodeTheme = "github-light-default";
const lineNumberTransformer = {
  name: "docs-line-numbers",
  line(node, line) {
    node.properties["data-line"] = line;
  },
};

// Create the docs highlighter once so Shiki stays out of the client bundle.
const highlighter = await createHighlighter({
  themes: [docsCodeTheme],
  langs: shikiLangs,
});

/** @type {import('@sveltejs/kit').Config} */
const config = {
  // Consult https://svelte.dev/docs/kit/integrations
  // for more information about preprocessors
  preprocess: [
    vitePreprocess(),
    mdsvex({
      extensions: [".md", ".mdx"],
      layout: mdsvexLayout,
      remarkPlugins: [
        remarkAlerts,
        remarkCodeTabs,
        remarkFrameworkCodeBlocks,
        remarkArticleHeadings,
      ],
      highlight: {
        highlighter: (code, lang = "plaintext") => {
          // Unknown fence languages (mermaid diagrams in the design docs,
          // etc.) must not break the whole docs build — fall back to plain
          // text instead of letting shiki throw.
          const resolvedLang = highlighter.getLoadedLanguages().includes(lang)
            ? lang
            : "plaintext";
          const highlighted = highlighter.codeToHtml(code, {
            lang: resolvedLang,
            theme: docsCodeTheme,
            transformers: [lineNumberTransformer],
          });
          const html = escapeSvelte(
            highlighted.replace('<pre class="', '<pre class="display '),
          );
          return `{@html \`${html}\`}`;
        },
      },
    }),
  ],

  extensions: [".svelte", ".md", ".mdx"],

  kit: {
    // adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
    // If your environment is not supported, or you settled on a specific environment, switch out the adapter.
    // See https://svelte.dev/docs/kit/adapters for more information about adapters.
    adapter: adapter(),
    alias: {
      "@snap-engine/snapline/svelte": "../assets/snapline/src/svelte",
      "@snap-engine/snapline": "../assets/snapline/src",
      "@snapline": "../src",
      "@svelte-demo": "../demo/svelte/src",
      "@docs": "../docs",
      "@components": "./src/lib/components",
      "@snap-engine/asset-base/svelte": "../assets/asset-base/src/svelte",
      "@snap-engine/asset-base": "../assets/asset-base/src",
      "@snap-engine/snapsort/svelte": "../assets/snapsort/src/svelte",
      "@snap-engine/snapsort": "../assets/snapsort/src",
      "@snap-engine/core/animation": "../src/animation.ts",
      "@snap-engine/core/debug": "../src/debug.ts",
      "@snap-engine/core/collision": "../src/collision.ts",
      "@snap-engine/core/geometry": "../src/geometry.ts",
      "@snap-engine/core/layout": "../src/layout.ts",
      "@snap-engine/core": "../src/index.ts",
    },
  },
};

export default config;
