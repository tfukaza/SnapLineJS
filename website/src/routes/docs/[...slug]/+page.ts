import { error, redirect } from "@sveltejs/kit";
import {
  docSlugFromPath,
  entries,
  getGroupedEntries,
  legacyDocRedirects,
  findDocProject,
} from "$lib/docsCatalog";

export const csr = true;

export { entries };
export const _getGroupedEntries = getGroupedEntries;

function mobileDocsNavigationForSlug(slug: string) {
  const projectSlug = slug.split("/")[0] ?? "";
  const project = findDocProject(projectSlug);
  if (!project) return null;

  return {
    project: project.slug,
    projectTitle: project.title,
    frameworks: [...project.frameworks],
    sections: getGroupedEntries().filter(
      (section) => section.project === project.slug,
    ),
  };
}

export async function load({ params, data }) {
  const modules = import.meta.glob("@docs/**/*.{md,mdx}");

  const slug = params.slug || "";
  // `/docs` renders the hub page (docs/index.mdx) that explains the
  // SnapEngine-vs-asset split; `/docs/index` is folded into it.
  if (slug === "index") {
    throw redirect(308, "/docs");
  }

  const project = findDocProject(slug);
  if (project) throw redirect(308, project.href);

  if (legacyDocRedirects[slug]) {
    throw redirect(308, `/docs/${legacyDocRedirects[slug]}`);
  }

  for (const [path, resolver] of Object.entries(modules)) {
    // Parse based on docs root
    const pathSlug = docSlugFromPath(path);
    if (pathSlug) {
      if (pathSlug === "index") {
        if (slug === "") {
          const mdx: any = await resolver();
          return {
            ...data,
            component: mdx.default,
            metadata: mdx.metadata,
            mobileDocsNavigation: null,
          };
        }
      } else {
        if (pathSlug === slug && slug !== "") {
          const mdx: any = await resolver();
          return {
            ...data,
            component: mdx.default,
            metadata: mdx.metadata,
            mobileDocsNavigation: mobileDocsNavigationForSlug(slug),
          };
        }
      }
    }
  }

  throw error(404, `Docs page not found: ${slug}`);
}
