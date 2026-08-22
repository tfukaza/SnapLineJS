export const exploreStatuses = [
  "available",
  "in-development",
  "coming-soon",
] as const;

export type ExploreStatus = (typeof exploreStatuses)[number];

export const exploreMaturities = ["early-beta"] as const;

export type ExploreMaturity = (typeof exploreMaturities)[number];

export type ExploreMotif = "sort" | "nodes" | "viewport";

export type ExploreCatalogEntry = {
  slug: string;
  name: string;
  tagline?: string;
  summary: string;
  status: ExploreStatus;
  maturity?: ExploreMaturity;
  href?: string;
  docsHref?: string;
  examplesHref?: string;
  motif: ExploreMotif;
  accent: string;
};

export type BrowsableExploreCatalogEntry = ExploreCatalogEntry & {
  href: string;
  status: Exclude<ExploreStatus, "coming-soon">;
};

export const exploreStatusLabels: Record<ExploreStatus, string> = {
  available: "Available",
  "in-development": "In development",
  "coming-soon": "Coming soon",
};

export const exploreMaturityLabels: Record<ExploreMaturity, string> = {
  "early-beta": "Early beta",
};

export const exploreActionLabels: Record<ExploreStatus, string> = {
  available: "Explore",
  "in-development": "In development",
  "coming-soon": "Coming soon",
};

export const exploreSecondaryLinkLabels = {
  docs: "Docs",
  examples: "Live examples",
} as const;

export function getExploreStatusLabel(entry: ExploreCatalogEntry): string {
  const statusLabel = exploreStatusLabels[entry.status];

  return entry.maturity
    ? `${statusLabel} · ${exploreMaturityLabels[entry.maturity]}`
    : statusLabel;
}

export function getExploreActionLabel(entry: ExploreCatalogEntry): string {
  return `${exploreActionLabels[entry.status]} ${entry.name}`;
}

export function isExploreEntryBrowsable(
  entry: ExploreCatalogEntry,
): entry is BrowsableExploreCatalogEntry {
  return entry.status !== "coming-soon" && Boolean(entry.href);
}

export const exploreEntries: readonly ExploreCatalogEntry[] = [
  {
    slug: "snapsort",
    name: "SnapSort",
    summary: "Unstyled components for sortable lists, kanban boards, and more.",
    status: "available",
    maturity: "early-beta",
    href: "/snapsort",
    docsHref: "/docs/snapsort/introduction",
    examplesHref: "/docs/snapsort/examples",
    motif: "sort",
    accent: "var(--color-primary)",
  },
  {
    slug: "snapline",
    name: "SnapLine",
    summary:
      "Planned primitives for draggable node graphs, connectors, selections, and visual workflows.",
    status: "coming-soon",
    href: "/snapline",
    motif: "nodes",
    accent: "var(--color-accent)",
  },
  {
    slug: "snapzap",
    name: "SnapZap",
    summary:
      "A focused zoom-and-pan interaction toolkit being explored on top of the shared SnapEngine foundation.",
    status: "coming-soon",
    motif: "viewport",
    accent: "var(--color-background-dark)",
  },
];

// Keep the descriptive alias for callers that treat the entries as a catalog.
export const exploreCatalog = exploreEntries;
