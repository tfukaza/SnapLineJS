import { entries, projectDescriptions } from "$lib/docsCatalog";
import { absoluteUrl } from "$lib/seo";
import type { RequestHandler } from "./$types";

const projects = ["snapengine", "snapsort"];

/**
 * Root llms.txt — the conventional entry point for coding agents. Points at the
 * per-project indexes, which carry the full page-by-page link list.
 */
export const GET: RequestHandler = () => {
  const lines = [
    "# SnapEngine",
    "",
    "> SnapEngine is a growing family of focused interaction tools for the web. The tools share SnapEngine Core, a DOM-first foundation for input, layout, collision, batched updates, and animation.",
    "",
    "Append `.md` to any documentation URL for clean, framework-aware Markdown, or add `?framework=svelte|react|vanilla` to pick a framework.",
    "",
    "## Documentation indexes",
    "",
  ];

  for (const project of projects) {
    const projectEntries = entries().filter(
      (entry) => entry.project === project,
    );
    const title = projectEntries[0]?.projectTitle ?? project;
    lines.push(
      `- [${title}](${absoluteUrl(`/docs/${project}/llms.txt`)}): ${projectDescriptions[project]}`,
    );
  }

  lines.push(
    "",
    "## Site",
    "",
    `- [Home](${absoluteUrl("/")}): product family overview and shared-engine explanation.`,
    `- [About](${absoluteUrl("/about")}): why SnapEngine exists.`,
    `- [SnapSort](${absoluteUrl("/snapsort")}): drag-and-drop primitives powered by SnapEngine Core.`,
    `- [SnapSort examples](${absoluteUrl("/docs/snapsort/examples")}): focused recipes and complete interactive interfaces.`,
  );

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "content-disposition": "inline",
      "content-type": "text/plain; charset=utf-8",
    },
  });
};
