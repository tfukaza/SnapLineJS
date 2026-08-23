import {
  getDocNavigation,
  projectDescriptions,
  type DocEntry,
  type DocNavigationNode,
} from "$lib/docsCatalog";
import { frameworkLabel, frameworksForDoc } from "$lib/server/docsMarkdown";
import { frameworkLabels, isFramework, type Framework } from "$lib/frameworks";
import { absoluteUrl } from "$lib/seo";
import { error } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

function linkTitle(title: string, framework: Framework): string {
  const label = frameworkLabels[framework];
  return title.toLowerCase().includes(label.toLowerCase())
    ? title
    : `${title} (${label})`;
}

function markdownLink(
  slug: string,
  title: string,
  framework: Framework | null,
  depth: number,
): string {
  const path = `/docs/${slug}.md${framework ? `?framework=${framework}` : ""}`;
  return `${"  ".repeat(depth)}- [${title}](${absoluteUrl(path)})`;
}

function appendEntryLinks(
  lines: string[],
  entry: DocEntry,
  depth: number,
): void {
  const entryFramework = isFramework(entry.framework) ? entry.framework : null;
  if (entryFramework) {
    lines.push(
      markdownLink(
        entry.slug,
        linkTitle(entry.title, entryFramework),
        entryFramework,
        depth,
      ),
    );
    return;
  }

  const codeFrameworks = frameworksForDoc(entry.slug);
  if (codeFrameworks.length === 0) {
    lines.push(markdownLink(entry.slug, entry.title, null, depth));
    return;
  }

  for (const framework of codeFrameworks) {
    lines.push(
      markdownLink(
        entry.slug,
        `${entry.title} (${frameworkLabel(framework)})`,
        framework,
        depth,
      ),
    );
  }
}

function appendNavigationNode(
  lines: string[],
  node: DocNavigationNode,
  depth: number,
): void {
  if (node.entry.kind === "group") {
    lines.push(`${"  ".repeat(depth)}- ${node.entry.title}`);
  } else {
    appendEntryLinks(lines, node.entry, depth);
  }
  for (const child of node.children) {
    appendNavigationNode(lines, child, depth + 1);
  }
}

export const GET: RequestHandler = ({ params }) => {
  const project = params.project;
  const navigation = getDocNavigation(project);
  if (!navigation) {
    throw error(404, `Documentation project not found: ${project}`);
  }

  const lines = [
    `# ${navigation.projectTitle} Documentation`,
    "",
    `> ${projectDescriptions[project]}`,
    "",
    "Framework-specific pages and code examples are listed separately. Each link returns clean Markdown suitable for coding-agent context.",
  ];

  for (const section of navigation.sections) {
    lines.push("", `## ${section.title}`, "");

    for (const node of section.nodes) {
      appendNavigationNode(lines, node, 0);
    }
  }

  return new Response(`${lines.join("\n")}\n`, {
    headers: {
      "content-disposition": "inline",
      "content-type": "text/plain; charset=utf-8",
      ...(project === "snapline"
        ? { "x-robots-tag": "noindex, nofollow" }
        : {}),
    },
  });
};
