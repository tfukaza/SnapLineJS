import {
  entries,
  getGroupedEntries,
  projectDescriptions,
  findDocProject,
} from "$lib/docsCatalog";
import {
  frameworkLabel,
  frameworksForDoc,
} from "$lib/server/docsMarkdown";
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
): string {
  const path = `/docs/${slug}.md${framework ? `?framework=${framework}` : ""}`;
  return `- [${title}](${absoluteUrl(path)})`;
}

export const GET: RequestHandler = ({ params }) => {
  const project = params.project;
  if (!findDocProject(project)) {
    throw error(404, `Documentation project not found: ${project}`);
  }

  const projectEntries = entries().filter((entry) => entry.project === project);
  const projectTitle = projectEntries[0]?.projectTitle;
  if (!projectTitle) {
    throw error(404, `Documentation project not found: ${project}`);
  }

  const lines = [
    `# ${projectTitle} Documentation`,
    "",
    `> ${projectDescriptions[project]}`,
    "",
    "Framework-specific pages and code examples are listed separately. Each link returns clean Markdown suitable for coding-agent context.",
  ];

  for (const section of getGroupedEntries().filter(
    (candidate) => candidate.project === project,
  )) {
    lines.push("", `## ${section.title}`, "");

    for (const entry of section.entries) {
      const entryFramework = isFramework(entry.framework)
        ? (entry.framework.toLowerCase() as Framework)
        : null;
      if (entryFramework) {
        lines.push(
          markdownLink(
            entry.slug,
            linkTitle(entry.title, entryFramework),
            entryFramework,
          ),
        );
        continue;
      }

      const codeFrameworks = frameworksForDoc(entry.slug);
      if (codeFrameworks.length === 0) {
        lines.push(markdownLink(entry.slug, entry.title, null));
        continue;
      }

      for (const framework of codeFrameworks) {
        lines.push(
          markdownLink(
            entry.slug,
            `${entry.title} (${frameworkLabel(framework)})`,
            framework,
          ),
        );
      }
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
