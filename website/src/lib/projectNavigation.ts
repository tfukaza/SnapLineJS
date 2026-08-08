import { exploreEntries } from "$lib/exploreCatalog";

export type ProjectNavigationGroup = "engine" | "asset";
export type ProjectNavigationStatus = "available" | "coming-soon";

export type ProjectNavigationEntry = {
  slug: string;
  title: string;
  group: ProjectNavigationGroup;
  status: ProjectNavigationStatus;
  marketingHref: string | null;
  docsHref: string | null;
  marketingPathPrefix: string | null;
  docsPathPrefix: string | null;
};

const docsHrefs: Readonly<Record<string, string>> = {
  snapengine: "/docs/snapengine/introduction",
  snapsort: "/docs/snapsort/introduction",
  snapline: "/docs/snapline/introduction",
};

export const projectNavigationEntries: readonly ProjectNavigationEntry[] = [
  {
    slug: "snapengine",
    title: "Core",
    group: "engine",
    status: "available",
    marketingHref: "/",
    docsHref: docsHrefs.snapengine,
    marketingPathPrefix: null,
    docsPathPrefix: "/docs/snapengine",
  },
  ...exploreEntries.map((entry): ProjectNavigationEntry => {
    const docsHref = docsHrefs[entry.slug] ?? entry.docsHref ?? null;

    return {
      slug: entry.slug,
      title: entry.name,
      group: "asset",
      status: entry.status === "coming-soon" ? "coming-soon" : "available",
      marketingHref: entry.href ?? null,
      docsHref,
      marketingPathPrefix: entry.href ?? null,
      docsPathPrefix: docsHref ? `/docs/${entry.slug}` : null,
    };
  }),
];

export function findProjectForPath(
  pathname: string,
): ProjectNavigationEntry | undefined {
  const docsProject = projectNavigationEntries.find(
    (entry) => entry.docsPathPrefix && pathname.startsWith(entry.docsPathPrefix),
  );
  if (docsProject) return docsProject;

  if (pathname === "/") {
    return projectNavigationEntries.find((entry) => entry.slug === "snapengine");
  }

  return projectNavigationEntries.find(
    (entry) =>
      entry.marketingPathPrefix &&
      entry.marketingPathPrefix !== "/" &&
      (pathname === entry.marketingPathPrefix ||
        pathname.startsWith(`${entry.marketingPathPrefix}/`)),
  );
}

export function projectDestination(
  entry: ProjectNavigationEntry,
  docsContext: boolean,
): string | null {
  return docsContext ? entry.docsHref : entry.marketingHref;
}
