import type { Framework } from "$lib/frameworks";
import type { DocMetadata } from "$lib/markdown/docMetadata";

export type DocEntry = {
  slug: string;
  title: string;
  order: number;
  project: string;
  projectTitle: string;
  section: string;
  sectionTitle: string;
  sectionOrder: number;
  framework: string | null;
  frameworkKey: string | null;
  parent: string | null;
  hidden: boolean;
};

export type DocNavigationNode = {
  entry: DocEntry;
  children: DocNavigationNode[];
};

export type DocNavigationSection = {
  name: string;
  title: string;
  order: number;
  project: string;
  projectTitle: string;
  nodes: DocNavigationNode[];
};

export type DocNavigation = {
  project: string;
  projectTitle: string;
  frameworks: Framework[];
  sections: DocNavigationSection[];
};

export type DocProject = {
  slug: string;
  title: string;
  description: string;
  href: string;
  frameworks: readonly Framework[];
};

export const docProjects: readonly DocProject[] = [
  {
    slug: "snapengine",
    title: "SnapEngine Core",
    description:
      "Documentation for building draggable, animated, collision-aware web experiences with SnapEngine.",
    href: "/docs/snapengine/introduction",
    frameworks: [],
  },
  {
    slug: "snapsort",
    title: "SnapSort",
    description:
      "Documentation for installing, configuring, and building drag-and-drop interfaces with SnapSort.",
    href: "/docs/snapsort/introduction",
    frameworks: ["svelte", "react", "vanilla"],
  },
  {
    slug: "snapline",
    title: "SnapLine",
    description:
      "Documentation for building node graphs, connections, selection, groups, and placement workflows with SnapLine.",
    href: "/docs/snapline/introduction",
    frameworks: ["svelte", "react", "vanilla"],
  },
];

export const findDocProject = (slug: string): DocProject | undefined =>
  docProjects.find((project) => project.slug === slug);

const metadataModules = import.meta.glob<DocMetadata>("@docs/**/*.{md,mdx}", {
  eager: true,
  import: "default",
  query: "?doc-catalog-metadata",
});

const formatTitle = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");

const projectTitles = Object.fromEntries(
  docProjects.map((project) => [project.slug, project.title]),
);

export const projectDescriptions = Object.fromEntries(
  docProjects.map((project) => [project.slug, project.description]),
);

export const legacyDocRedirects: Record<string, string> = {
  "snapsort/reference/svelte": "snapsort/reference/svelte/container",
  "snapsort/reference/svelte-api": "snapsort/reference/svelte/container",
  "snapsort/reference/react-api": "snapsort/reference/react",
};

function docPathParts(path: string): string[] | null {
  const match = path.match(/docs\/(.*)\.(md|mdx)$/);
  if (!match) return null;

  const parts = match[1].split("/");
  return parts[0] === "snapsort"
    ? parts.map((part) => part.replace(/^\d+_/, ""))
    : parts;
}

export function docSlugFromPath(path: string): string | null {
  const parts = docPathParts(path);
  if (!parts) return null;

  if (parts.length > 1 && parts.at(-1) === "index") {
    parts.pop();
  }

  return parts.join("/");
}

const allEntries = Object.entries(metadataModules)
  .map(([path, metadata]): DocEntry | null => {
    const sourceParts = docPathParts(path);
    const slug = docSlugFromPath(path);
    if (!sourceParts || !slug) return null;

    const derivedProject = sourceParts.length > 1 ? sourceParts[0] : "";
    const derivedSection =
      sourceParts.length > 2 ? sourceParts[1] : derivedProject;
    const project = metadata.project ?? derivedProject;
    const projectTitle =
      projectTitles[project] ??
      metadata.projectTitle ??
      (project ? formatTitle(project) : "Docs");
    const section = metadata.section ?? derivedSection;
    const frameworkFromPath =
      findDocProject(project)?.frameworks.length &&
      section === "reference" &&
      ["svelte", "react", "vanilla", "core"].includes(sourceParts[2])
        ? sourceParts[2]
        : null;
    const framework = metadata.framework ?? frameworkFromPath;
    const frameworkKey =
      metadata.frameworkKey ??
      (framework ? sourceParts[3] ?? "overview" : null);

    return {
      slug,
      title: metadata.title || slug || "Home",
      order: metadata.order ?? 999,
      project,
      projectTitle,
      section,
      sectionTitle:
        metadata.sectionTitle ??
        (section === project
          ? projectTitle
          : section
            ? formatTitle(section)
            : "Getting Started"),
      sectionOrder: metadata.sectionOrder ?? (derivedSection ? 999 : 0),
      framework,
      frameworkKey,
      parent: metadata.parent ?? null,
      hidden: metadata.hidden ?? false,
    };
  })
  .filter((entry): entry is DocEntry => entry !== null)
  .sort(
    (a, b) =>
      a.project.localeCompare(b.project) ||
      a.sectionOrder - b.sectionOrder ||
      a.section.localeCompare(b.section) ||
      a.order - b.order ||
      a.title.localeCompare(b.title),
  );

const allEntriesBySlug = new Map<string, DocEntry>(
  allEntries.map((entry): [string, DocEntry] => [entry.slug, entry]),
);

function validateParentRelationships(docEntries: readonly DocEntry[]): void {
  for (const entry of docEntries) {
    if (!entry.parent) continue;

    const parent = allEntriesBySlug.get(entry.parent);
    if (!parent) {
      throw new Error(
        `Documentation entry "${entry.slug}" references missing parent "${entry.parent}".`,
      );
    }
    if (parent.project !== entry.project) {
      throw new Error(
        `Documentation entry "${entry.slug}" and parent "${parent.slug}" must belong to the same project.`,
      );
    }
    if (parent.section !== entry.section) {
      throw new Error(
        `Documentation entry "${entry.slug}" and parent "${parent.slug}" must belong to the same section.`,
      );
    }
  }

  const visited = new Set<string>();
  const visiting = new Set<string>();

  const visit = (entry: DocEntry, ancestry: string[]): void => {
    if (visited.has(entry.slug)) return;
    if (visiting.has(entry.slug)) {
      const cycleStart = ancestry.indexOf(entry.slug);
      const cycle = [...ancestry.slice(cycleStart), entry.slug].join(" -> ");
      throw new Error(`Documentation parent cycle detected: ${cycle}.`);
    }

    visiting.add(entry.slug);
    if (entry.parent) {
      const parent = allEntriesBySlug.get(entry.parent);
      if (!parent) {
        throw new Error(
          `Documentation entry "${entry.slug}" references missing parent "${entry.parent}".`,
        );
      }
      visit(parent, [...ancestry, entry.slug]);
    }
    visiting.delete(entry.slug);
    visited.add(entry.slug);
  };

  for (const entry of docEntries) visit(entry, []);
}

validateParentRelationships(allEntries);

const compareEntries = (a: DocEntry, b: DocEntry): number =>
  a.order - b.order ||
  a.title.localeCompare(b.title) ||
  a.slug.localeCompare(b.slug);

function sortNavigationNodes(nodes: DocNavigationNode[]): void {
  nodes.sort((a, b) => compareEntries(a.entry, b.entry));
  for (const node of nodes) sortNavigationNodes(node.children);
}

function buildNavigationSections(
  docEntries: readonly DocEntry[],
): DocNavigationSection[] {
  const visibleEntries = docEntries.filter(
    (entry) => !entry.hidden && entry.slug !== "index",
  );
  const nodesBySlug = new Map<string, DocNavigationNode>(
    visibleEntries.map((entry): [string, DocNavigationNode] => [
      entry.slug,
      { entry, children: [] },
    ]),
  );
  const sections = new Map<string, DocNavigationSection>();

  for (const entry of visibleEntries) {
    const sectionKey = `${entry.project}:${entry.section}`;
    if (!sections.has(sectionKey)) {
      sections.set(sectionKey, {
        name: entry.section,
        title: entry.sectionTitle,
        order: entry.sectionOrder,
        project: entry.project,
        projectTitle: entry.projectTitle,
        nodes: [],
      });
    }

    const node = nodesBySlug.get(entry.slug);
    const section = sections.get(sectionKey);
    if (!node || !section) {
      throw new Error(
        `Documentation navigation could not index entry "${entry.slug}".`,
      );
    }
    const parentNode = entry.parent ? nodesBySlug.get(entry.parent) : undefined;
    if (parentNode) {
      parentNode.children.push(node);
    } else {
      section.nodes.push(node);
    }
  }

  const orderedSections = Array.from(sections.values()).sort(
    (a, b) =>
      a.project.localeCompare(b.project) ||
      a.order - b.order ||
      a.name.localeCompare(b.name),
  );
  for (const section of orderedSections) sortNavigationNodes(section.nodes);
  return orderedSections;
}

const navigationSections = buildNavigationSections(allEntries);

function filterNavigationNodes(
  nodes: readonly DocNavigationNode[],
  framework: Framework,
): DocNavigationNode[] {
  return nodes.flatMap((node) => {
    const children = filterNavigationNodes(node.children, framework);
    if (!node.entry.framework || node.entry.framework === framework) {
      return [{ entry: node.entry, children }];
    }

    // Preserve matching descendants if a framework-specific parent is hidden.
    return children;
  });
}

export function filterDocNavigation(
  navigation: DocNavigation,
  framework: Framework,
): DocNavigation {
  return {
    ...navigation,
    sections: navigation.sections
      .map((section) => ({
        ...section,
        nodes: filterNavigationNodes(section.nodes, framework),
      }))
      .filter((section) => section.nodes.length > 0),
  };
}

export function getDocNavigation(
  project: string,
  framework?: Framework,
): DocNavigation | null {
  const projectConfig = findDocProject(project);
  const sections = navigationSections.filter(
    (section) => section.project === project,
  );
  if (!projectConfig || sections.length === 0) return null;

  const navigation: DocNavigation = {
    project: projectConfig.slug,
    projectTitle: projectConfig.title,
    frameworks: [...projectConfig.frameworks],
    sections,
  };
  return framework ? filterDocNavigation(navigation, framework) : navigation;
}

export function flattenDocNavigation(navigation: DocNavigation): DocEntry[] {
  return flattenNavigationSections(navigation.sections);
}

export function docNavigationNodeContains(
  node: DocNavigationNode,
  slug: string,
): boolean {
  return (
    node.entry.slug === slug ||
    node.children.some((child) => docNavigationNodeContains(child, slug))
  );
}

function flattenNavigationSections(
  sections: readonly DocNavigationSection[],
): DocEntry[] {
  const flattened: DocEntry[] = [];

  const visit = (nodes: readonly DocNavigationNode[]): void => {
    for (const node of nodes) {
      flattened.push(node.entry);
      visit(node.children);
    }
  };

  for (const section of sections) visit(section.nodes);
  return flattened;
}

export function getProjectEntries(
  project: string,
  framework?: Framework,
): DocEntry[] {
  const navigation = getDocNavigation(project, framework);
  return navigation ? flattenDocNavigation(navigation) : [];
}

export const entries = (): DocEntry[] =>
  flattenNavigationSections(navigationSections);

export const findDocEntry = (slug: string): DocEntry | undefined =>
  allEntriesBySlug.get(slug);

export function getDocAncestors(slug: string): DocEntry[] {
  const ancestors: DocEntry[] = [];
  let current = allEntriesBySlug.get(slug);

  while (current?.parent) {
    current = allEntriesBySlug.get(current.parent);
    if (current) ancestors.unshift(current);
  }

  return ancestors;
}
