import { error, redirect } from "@sveltejs/kit";
import {
  docSlugFromPath,
  entries,
  getGroupedEntries,
  legacyDocRedirects,
} from "$lib/docsCatalog";

export const csr = true;

export { entries };
export const _getGroupedEntries = getGroupedEntries;

export async function load({ params }) {
  const modules = import.meta.glob("@docs/**/*.{md,mdx}");

  const slug = params.slug || "";
  // `/docs` renders the hub page (docs/index.mdx) that explains the
  // SnapEngine-vs-asset split; `/docs/index` is folded into it.
  if (slug === "index") {
    throw redirect(308, "/docs");
  }

  if (slug === "snapengine") {
    throw redirect(308, "/docs/snapengine/introduction");
  }

  if (slug === "snapsort") {
    throw redirect(308, "/docs/snapsort/introduction");
  }

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
            component: mdx.default,
            metadata: mdx.metadata,
          };
        }
      } else {
        if (pathSlug === slug && slug !== "") {
          const mdx: any = await resolver();
          return {
            component: mdx.default,
            metadata: mdx.metadata,
          };
        }
      }
    }
  }

  throw error(404, `Docs page not found: ${slug}`);
}
