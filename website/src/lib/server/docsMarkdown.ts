import { entries, findDocEntry, type DocEntry } from "$lib/docsCatalog";
import {
  frameworkLabels,
  frameworks,
  isFramework,
  type Framework,
} from "$lib/frameworks";
import { absoluteUrl } from "$lib/seo";
import { containerIntroExampleSources } from "$lib/components/docs/containerIntroExampleSources";
import { containerPropertyExampleSources } from "$lib/components/docs/containerPropertyExampleSources";
import { itemExampleSources } from "$lib/components/docs/itemExampleSources";

type MarkdownSegment = {
  kind: "text" | "code";
  value: string;
  framework: Framework | null;
};

type RawDocSource = {
  slug: string;
  source: string;
};

export type RenderedMarkdownDoc = {
  entry: DocEntry;
  framework: Framework;
  markdown: string;
};

const rawModules = import.meta.glob("@docs/**/*.{md,mdx}", {
  eager: true,
  import: "default",
  query: "?raw",
}) as Record<string, string>;

const rawDocs = Object.entries(rawModules)
  .map(([path, source]): RawDocSource | null => {
    const match = path.match(/docs\/(.*)\.(md|mdx)$/);
    if (!match) return null;

    const sourceSlug = match[1];
    return {
      slug: sourceSlug.endsWith("/index")
        ? sourceSlug.slice(0, -6)
        : sourceSlug,
      source,
    };
  })
  .filter((doc): doc is RawDocSource => doc !== null);

const frameworkPattern = /(?:^|\s)framework=(?:"([^"]+)"|'([^']+)'|([^\s]+))/i;

function stripFrontmatter(source: string): string {
  const normalized = source.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  if (lines[0]?.trim() !== "---") return normalized;

  const end = lines.findIndex(
    (line, index) => index > 0 && line.trim() === "---",
  );
  return end === -1 ? normalized : lines.slice(end + 1).join("\n");
}

function frameworkFromInfo(info: string): Framework | null {
  const match = info.match(frameworkPattern);
  const value = match?.[1] ?? match?.[2] ?? match?.[3] ?? null;
  return isFramework(value) ? (value.toLowerCase() as Framework) : null;
}

function cleanFenceInfo(info: string): string {
  return info.replace(frameworkPattern, " ").trim().replace(/\s+/g, " ");
}

function parseMarkdownSegments(source: string): MarkdownSegment[] {
  const lines = stripFrontmatter(source).split("\n");
  const segments: MarkdownSegment[] = [];
  let textLines: string[] = [];

  const flushText = () => {
    if (textLines.length === 0) return;
    segments.push({
      kind: "text",
      value: textLines.join("\n"),
      framework: null,
    });
    textLines = [];
  };

  for (let index = 0; index < lines.length; index += 1) {
    const opening = lines[index].match(/^(\s*)(`{3,}|~{3,})(.*)$/);
    if (!opening) {
      textLines.push(lines[index]);
      continue;
    }

    flushText();
    const [, indent, marker, rawInfo] = opening;
    const info = rawInfo.trim();
    const framework = frameworkFromInfo(info);
    const cleanInfo = cleanFenceInfo(info);
    const codeLines = [`${indent}${marker}${cleanInfo}`];
    const markerCharacter = marker.charAt(0);
    const closingPattern = new RegExp(
      `^\\s*${markerCharacter}{${marker.length},}\\s*$`,
    );

    for (index += 1; index < lines.length; index += 1) {
      codeLines.push(lines[index]);
      if (closingPattern.test(lines[index])) break;
    }

    segments.push({
      kind: "code",
      value: codeLines.join("\n"),
      framework,
    });
  }

  flushText();
  return segments;
}

function rewriteDocTarget(
  target: string,
  selectedFramework: Framework,
): string {
  if (!target.startsWith("/docs/")) return target;

  const hashIndex = target.indexOf("#");
  const hash = hashIndex === -1 ? "" : target.slice(hashIndex);
  const withoutHash = hashIndex === -1 ? target : target.slice(0, hashIndex);
  const queryIndex = withoutHash.indexOf("?");
  const path =
    queryIndex === -1 ? withoutHash : withoutHash.slice(0, queryIndex);
  const query = queryIndex === -1 ? "" : withoutHash.slice(queryIndex + 1);

  if (path.endsWith("/llms.txt")) return target;

  const markdownPath = path.endsWith(".md") ? path : `${path}.md`;
  const search = new URLSearchParams(query);
  const explicitFrameworkPath =
    /^\/docs\/(?:snapsort|snapline)\/reference\/(svelte|react|vanilla|core)(?:\/|$)/.test(
      path,
    );

  if (
    /^\/docs\/(?:snapsort|snapline)\//.test(path) &&
    !explicitFrameworkPath &&
    !search.has("framework")
  ) {
    search.set("framework", selectedFramework);
  }

  const searchString = search.toString();
  return `${markdownPath}${searchString ? `?${searchString}` : ""}${hash}`;
}

function cleanTextSegment(
  value: string,
  selectedFramework: Framework,
): { value: string; removedInteractiveContent: boolean } {
  let removedInteractiveContent = false;
  const inlineCode: string[] = [];
  const interactiveExamples: string[] = [];
  let cleaned = value.replace(/(`+)[\s\S]*?\1/g, (code) => {
    const token = `\u0000INLINE_CODE_${inlineCode.length}\u0000`;
    inlineCode.push(code);
    return token;
  });
  cleaned = cleaned.replace(/^\s*<script\b[^>]*>[\s\S]*?<\/script>\s*$/gim, "");

  cleaned = cleaned.replace(
    /^\s*<(ContainerIntroExample|ContainerPropertyExample|ItemExample)\s+kind=(?:"([^"]+)"|'([^']+)')\s*\/>\s*$/gm,
    (
      match,
      componentName:
        | "ContainerIntroExample"
        | "ContainerPropertyExample"
        | "ItemExample",
      doubleQuotedKind: string,
      singleQuotedKind: string,
    ) => {
      const kind = doubleQuotedKind ?? singleQuotedKind;
      const sources: Record<string, string> =
        componentName === "ContainerIntroExample"
          ? containerIntroExampleSources
          : componentName === "ContainerPropertyExample"
            ? containerPropertyExampleSources
            : itemExampleSources;
      const source = sources[kind];
      if (!source) return match;
      removedInteractiveContent = true;
      const token = `\u0000INTERACTIVE_EXAMPLE_${interactiveExamples.length}\u0000`;
      interactiveExamples.push(`\`\`\`svelte\n${source.trimEnd()}\n\`\`\``);
      return token;
    },
  );

  cleaned = cleaned.replace(
    /^\s*<[A-Z][A-Za-z0-9.]*\b[\s\S]*?\/>\s*$/gm,
    () => {
      removedInteractiveContent = true;
      return "";
    },
  );
  cleaned = cleaned
    .replace(/<hr\s*\/?>/gi, "\n---\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/?(?:div|span|p)\b[^>]*>/gi, "");
  cleaned = cleaned.replace(
    /(\!?\[[^\]]*\]\()([^\s)]+)(\))/g,
    (match, opening: string, target: string, closing: string) => {
      if (!target.startsWith("/docs/")) return match;
      return `${opening}${rewriteDocTarget(target, selectedFramework)}${closing}`;
    },
  );
  cleaned = cleaned.replace(
    /\u0000INLINE_CODE_(\d+)\u0000/g,
    (_, index: string) => inlineCode[Number(index)] ?? "",
  );

  const normalized = cleaned.replace(/\n{3,}/g, "\n\n").trim();

  return {
    value: normalized.replace(
      /\u0000INTERACTIVE_EXAMPLE_(\d+)\u0000/g,
      (_, index: string) => interactiveExamples[Number(index)] ?? "",
    ),
    removedInteractiveContent,
  };
}

function sourceForSlug(slug: string): RawDocSource | undefined {
  return rawDocs.find((doc) => doc.slug === slug);
}

function pairedFrameworkEntry(
  entry: DocEntry,
  framework: Framework,
): DocEntry | undefined {
  if (!entry.frameworkKey) return undefined;

  return entries().find(
    (candidate) =>
      candidate.project === entry.project &&
      candidate.section === entry.section &&
      candidate.frameworkKey === entry.frameworkKey &&
      candidate.framework === framework,
  );
}

export function frameworksForDoc(slug: string): Framework[] {
  const source = sourceForSlug(slug);
  if (!source) return [];

  const found = new Set(
    parseMarkdownSegments(source.source)
      .map((segment) => segment.framework)
      .filter((framework): framework is Framework => framework !== null),
  );
  return frameworks.filter((framework) => found.has(framework));
}

export function renderMarkdownDoc(
  slug: string,
  requestedFramework: Framework | null,
): RenderedMarkdownDoc | null {
  let entry = findDocEntry(slug);
  if (!entry) return null;

  const pathFramework = isFramework(entry.framework)
    ? (entry.framework.toLowerCase() as Framework)
    : null;
  const selectedFramework = requestedFramework ?? pathFramework ?? "svelte";
  const pairedEntry = requestedFramework
    ? pairedFrameworkEntry(entry, requestedFramework)
    : undefined;
  if (pairedEntry) entry = pairedEntry;

  const source = sourceForSlug(entry.slug);
  if (!source) return null;

  let removedInteractiveContent = false;
  const body = parseMarkdownSegments(source.source)
    .filter(
      (segment) =>
        segment.kind === "text" ||
        segment.framework === null ||
        segment.framework === selectedFramework,
    )
    .map((segment) => {
      if (segment.kind === "code") return segment.value;

      const cleaned = cleanTextSegment(segment.value, selectedFramework);
      removedInteractiveContent ||= cleaned.removedInteractiveContent;
      return cleaned.value;
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();

  const header = [`# ${entry.title}`];
  if (removedInteractiveContent) {
    header.push(
      `> This page includes interactive diagrams or demos. [Open the rendered documentation page](${absoluteUrl(`/docs/${entry.slug}`)}).`,
    );
  }

  return {
    entry,
    framework: selectedFramework,
    markdown: `${header.join("\n\n")}\n\n${body}\n`,
  };
}

export function frameworkLabel(framework: Framework): string {
  return frameworkLabels[framework];
}
