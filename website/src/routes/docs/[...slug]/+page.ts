import { error, redirect } from "@sveltejs/kit";
import type { Component } from "svelte";
import {
  docSlugFromPath,
  entries,
  findDocEntry,
  findDocRedirect,
  getDocAncestors,
  getDocNavigation,
  findDocProject,
} from "$lib/docsCatalog";
import type { DocMetadata } from "$lib/markdown/docMetadata";

type DocsPageModule = {
  default: Component;
  metadata?: DocMetadata;
};

export const csr = true;

export { entries };

function mobileDocsNavigationForSlug(slug: string) {
  const projectSlug = slug.split("/")[0] ?? "";
  return getDocNavigation(projectSlug);
}

export async function load({ params, url }) {
  const modules = import.meta.glob<DocsPageModule>("@docs/**/*.{md,mdx}");

  const slug = params.slug || "";
  // `/docs` renders the hub page (docs/index.mdx) that explains the
  // SnapEngine-vs-asset split; `/docs/index` is folded into it.
  if (slug === "index") {
    throw redirect(308, "/docs");
  }

  const project = findDocProject(slug);
  if (project) throw redirect(308, project.href);

  const redirectSlug = findDocRedirect(slug);
  if (redirectSlug) {
    throw redirect(308, `/docs/${redirectSlug}${url.search}`);
  }

  for (const [path, resolver] of Object.entries(modules)) {
    // Parse based on docs root
    const pathSlug = docSlugFromPath(path);
    if (pathSlug) {
      if (pathSlug === "index") {
        if (slug === "") {
          const mdx = await resolver();
          return {
            component: mdx.default,
            metadata: mdx.metadata,
            docEntry: findDocEntry("index"),
            docAncestors: [],
            mobileDocsNavigation: null,
          };
        }
      } else {
        if (pathSlug === slug && slug !== "") {
          const mdx = await resolver();
          return {
            component: mdx.default,
            metadata: mdx.metadata,
            docEntry: findDocEntry(slug),
            docAncestors: getDocAncestors(slug),
            mobileDocsNavigation: mobileDocsNavigationForSlug(slug),
          };
        }
      }
    }
  }

  throw error(404, `Docs page not found: ${slug}`);
}
