import type { PageServerLoad } from "./$types";

const REPO_FILE_URL =
  "https://github.com/tfukaza/SnapEngineJS/blob/main/website/src/routes/snapsort/gallery/%2Bpage.svelte";

// Read our own source so the per-exhibit line anchors are computed from the
// file as it actually is at build time, instead of being hand-maintained.
const sources = import.meta.glob("./+page.svelte", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

const exhibitIds = [
  "todo-list",
  "kanban-board",
  "sentence-builder",
  "file-explorer",
  "clone-palette",
  "trash-it",
  "swap-grid",
  "editor",
];

function sourceLinks(): Record<string, string> {
  const source = Object.values(sources)[0] ?? "";
  const lines = source.split("\n");
  const links: Record<string, string> = {};

  for (const id of exhibitIds) {
    const needle = `id="${id}"`;
    // Each exhibit appears twice — once in the SSR fallback, once in the live
    // branch. The live one is what a reader actually wants, so take the last.
    let found = -1;
    for (let index = 0; index < lines.length; index += 1) {
      if (lines[index].includes(needle)) found = index;
    }
    links[id] =
      found === -1 ? REPO_FILE_URL : `${REPO_FILE_URL}?plain=1#L${found + 1}`;
  }

  return links;
}

export const load: PageServerLoad = () => ({ sourceLinks: sourceLinks() });
