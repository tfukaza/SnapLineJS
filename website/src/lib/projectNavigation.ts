import { exploreEntries } from "$lib/exploreCatalog";

export type ProjectNavigationGroup = "engine" | "asset" | "design";
export type ProjectNavigationStatus = "available" | "coming-soon";

export type ProjectTopNavigationItem = {
  label: string;
  href: string;
  activePathPrefixes?: readonly string[];
  activeExactPaths?: readonly string[];
  excludedPathPrefixes?: readonly string[];
};

export type ProjectNavigationEntry = {
  slug: string;
  title: string;
  group: ProjectNavigationGroup;
  status: ProjectNavigationStatus;
  marketingHref: string | null;
  marketingPathPrefix: string | null;
  docsPathPrefix: string | null;
  topNavigation: readonly ProjectTopNavigationItem[];
};

export type ProjectSwitcherEntry = ProjectNavigationEntry & {
  marketingHref: string;
};

const docsHrefs: Readonly<Record<string, string>> = {
  snapengine: "/docs/snapengine/introduction",
  snapsort: "/docs/snapsort/introduction",
  snapline: "/docs/snapline/introduction",
};

const topNavigationByProject: Readonly<
  Record<string, readonly ProjectTopNavigationItem[]>
> = {
  snapengine: [
    {
      label: "Docs",
      href: docsHrefs.snapengine,
      activePathPrefixes: ["/docs/snapengine"],
      activeExactPaths: ["/docs"],
    },
    {
      label: "About",
      href: "/about",
      activeExactPaths: ["/about"],
    },
  ],
  snapsort: [
    {
      label: "Docs",
      href: docsHrefs.snapsort,
      activePathPrefixes: ["/docs/snapsort"],
      excludedPathPrefixes: ["/docs/snapsort/examples"],
    },
    {
      label: "Examples",
      href: "/docs/snapsort/examples",
      activePathPrefixes: ["/docs/snapsort/examples"],
    },
  ],
  snapline: [
    {
      label: "Docs",
      href: docsHrefs.snapline,
      activePathPrefixes: ["/docs/snapline"],
    },
  ],
  snapdesign: [
    {
      label: "Guideline",
      href: "/snapdesign",
      activeExactPaths: ["/snapdesign"],
    },
    {
      label: "Gallery",
      href: "/snapdesign/gallery",
      activePathPrefixes: ["/snapdesign/gallery"],
    },
  ],
};

const snapEngineNavigationEntry: ProjectNavigationEntry = {
  slug: "snapengine",
  title: "SnapEngine",
  group: "engine",
  status: "available",
  marketingHref: "/",
  marketingPathPrefix: null,
  docsPathPrefix: "/docs/snapengine",
  topNavigation: topNavigationByProject.snapengine,
};

export const projectNavigationEntries: readonly ProjectNavigationEntry[] = [
  snapEngineNavigationEntry,
  ...exploreEntries.map((entry): ProjectNavigationEntry => {
    const docsHref = docsHrefs[entry.slug] ?? entry.docsHref ?? null;

    return {
      slug: entry.slug,
      title: entry.name,
      group: "asset",
      status: entry.status === "coming-soon" ? "coming-soon" : "available",
      marketingHref: entry.href ?? null,
      marketingPathPrefix: entry.href ?? null,
      docsPathPrefix: docsHref ? `/docs/${entry.slug}` : null,
      topNavigation: topNavigationByProject[entry.slug] ?? [],
    };
  }),
  {
    slug: "snapdesign",
    title: "SnapDesign",
    group: "design",
    status: "available",
    marketingHref: "/snapdesign",
    marketingPathPrefix: "/snapdesign",
    docsPathPrefix: null,
    topNavigation: topNavigationByProject.snapdesign,
  },
];

export const projectSwitcherEntries: readonly ProjectSwitcherEntry[] =
  projectNavigationEntries.filter(
    (entry): entry is ProjectSwitcherEntry => entry.marketingHref !== null,
  );

function pathMatchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

export function findProjectForPath(
  pathname: string,
): ProjectNavigationEntry {
  const docsProject = projectNavigationEntries.find(
    (entry) =>
      entry.docsPathPrefix && pathMatchesPrefix(pathname, entry.docsPathPrefix),
  );
  if (docsProject) return docsProject;

  const marketingProject = projectNavigationEntries.find(
    (entry) =>
      entry.marketingPathPrefix &&
      entry.marketingPathPrefix !== "/" &&
      pathMatchesPrefix(pathname, entry.marketingPathPrefix),
  );
  return marketingProject ?? snapEngineNavigationEntry;
}

export function topNavigationItemIsCurrent(
  item: ProjectTopNavigationItem,
  pathname: string,
): boolean {
  if (
    item.excludedPathPrefixes?.some((prefix) =>
      pathMatchesPrefix(pathname, prefix),
    )
  ) {
    return false;
  }

  return (
    item.activeExactPaths?.includes(pathname) === true ||
    item.activePathPrefixes?.some((prefix) =>
      pathMatchesPrefix(pathname, prefix),
    ) === true
  );
}
