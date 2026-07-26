// Shared shiki theme. Imported by svelte.config.js (for mdsvex docs code
// blocks) and by $lib/server/highlight.ts (for code samples rendered outside
// the markdown pipeline) so both produce identical output.
export const customTheme = {
  name: "custom-theme",
  type: "dark",
  colors: {
    // "editor.background": "#1f1f2200",
    "editor.foreground": "#e1e4e8",
  },
  tokenColors: [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: "#6e7681", fontStyle: "italic" },
    },
    {
      scope: ["string", "string.quoted"],
      settings: { foreground: "#7af16aff" },
    },
    {
      scope: ["constant.numeric", "constant.language"],
      settings: { foreground: "#79c0ff" },
    },
    {
      scope: ["keyword", "storage.type", "storage.modifier"],
      settings: { foreground: "#ff7b72" },
    },
    {
      scope: ["entity.name.function", "support.function"],
      settings: { foreground: "#f4a85cff" },
    },
    {
      scope: ["variable", "variable.other"],
      settings: { foreground: "#e1e4e8" },
    },
    {
      scope: ["entity.name.type", "entity.name.class", "support.type"],
      settings: { foreground: "#ffa657" },
    },
    {
      scope: ["punctuation", "meta.brace"],
      settings: { foreground: "#e1e4e8" },
    },
    {
      scope: ["entity.name.tag"],
      settings: { foreground: "#7ee787" },
    },
    {
      scope: ["entity.other.attribute-name"],
      settings: { foreground: "#79c0ff" },
    },
    {
      scope: ["keyword.operator"],
      settings: { foreground: "#ff7b72" },
    },
    {
      scope: ["constant.other"],
      settings: { foreground: "#79c0ff" },
    },
  ],
};

export const shikiLangs = [
  "javascript",
  "typescript",
  "svelte",
  "jsx",
  "tsx",
  "html",
  "css",
  "json",
  "bash",
  "shell",
  "markdown",
  "plaintext",
];
