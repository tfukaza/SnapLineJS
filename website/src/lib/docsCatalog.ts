export type DocEntry = {
  slug: string;
  title: string;
  description: string | null;
  order: number;
  project: string;
  projectTitle: string;
  section: string;
  sectionTitle: string;
  sectionOrder: number;
  framework: string | null;
  frameworkKey: string | null;
  hidden: boolean;
};

export type DocSection = {
  name: string;
  title: string;
  order: number;
  project: string;
  projectTitle: string;
  entries: DocEntry[];
};

type DocMetadata = {
  title?: string;
  description?: string;
  order?: number;
  project?: string;
  projectTitle?: string;
  section?: string;
  sectionTitle?: string;
  sectionOrder?: number;
  hidden?: boolean;
  framework?: string;
  frameworkKey?: string;
};

export type DocProject = {
  slug: string;
  title: string;
  description: string;
  href: string;
  frameworks: readonly string[];
};

export const docProjects: readonly DocProject[] = [
  {
    slug: "snapengine",
    title: "SnapEngine",
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

const modules = import.meta.glob("@docs/**/*.{md,mdx}", {
  eager: true,
}) as Record<string, { metadata?: DocMetadata }>;

const formatTitle = (value: string) =>
  value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");

const projectTitles = Object.fromEntries(
  docProjects.map((project) => [project.slug, project.title]),
);

export const projectDescriptions = Object.fromEntries(
  docProjects.map((project) => [project.slug, project.description]),
);

export const legacyDocRedirects: Record<string, string> = {
  "snapsort/introduction/01_core_concepts":
    "snapsort/guides/01_core_concepts",
  "snapsort/reference/svelte-api": "snapsort/reference/svelte",
  "snapsort/reference/react-api": "snapsort/reference/react",
};

export function docSlugFromPath(path: string): string | null {
  const match = path.match(/docs\/(.*)\.(md|mdx)$/);
  if (!match) return null;

  const sourceSlug = match[1];
  if (sourceSlug.endsWith("/index")) {
    return sourceSlug.slice(0, -6);
  }

  return sourceSlug;
}

const allEntries = Object.entries(modules)
  .map(([path, module]): DocEntry | null => {
    const sourceMatch = path.match(/docs\/(.*)\.(md|mdx)$/);
    const slug = docSlugFromPath(path);
    if (!sourceMatch || !slug) return null;

    const sourceParts = sourceMatch[1].split("/");
    const derivedProject = sourceParts.length > 1 ? sourceParts[0] : "";
    const derivedSection =
      sourceParts.length > 2 ? sourceParts[1] : derivedProject;
    const metadata = module.metadata ?? {};
    const project = metadata.project ?? derivedProject;
    const projectTitle =
      metadata.projectTitle ??
      projectTitles[project] ??
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
      description: metadata.description ?? null,
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

export const entries = (): DocEntry[] =>
  allEntries.filter((entry) => !entry.hidden && entry.slug !== "index");

export const findDocEntry = (slug: string): DocEntry | undefined =>
  allEntries.find((entry) => entry.slug === slug);

export const getGroupedEntries = (): DocSection[] => {
  const sections = new Map<string, DocSection>();

  for (const entry of entries()) {
    const sectionKey = `${entry.project}:${entry.section}`;
    if (!sections.has(sectionKey)) {
      sections.set(sectionKey, {
        name: entry.section,
        title: entry.sectionTitle,
        order: entry.sectionOrder,
        project: entry.project,
        projectTitle: entry.projectTitle,
        entries: [],
      });
    }
    sections.get(sectionKey)!.entries.push(entry);
  }

  return Array.from(sections.values()).sort(
    (a, b) =>
      a.project.localeCompare(b.project) ||
      a.order - b.order ||
      a.name.localeCompare(b.name),
  );
};
