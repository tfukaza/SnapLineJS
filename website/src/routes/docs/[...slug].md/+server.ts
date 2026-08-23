import { isFramework, type Framework } from "$lib/frameworks";
import { findDocRedirect } from "$lib/docsCatalog";
import { renderMarkdownDoc } from "$lib/server/docsMarkdown";
import { error, redirect } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

const projectHome: Record<string, string> = {
  snapengine: "snapengine/introduction",
  snapsort: "snapsort/introduction",
  snapline: "snapline/introduction",
};

export const GET: RequestHandler = ({ params, url }) => {
  const slug = params.slug || "";
  const requestedFrameworkValue = url.searchParams.get("framework");
  if (requestedFrameworkValue && !isFramework(requestedFrameworkValue)) {
    throw error(400, "Unsupported framework. Use svelte, react, or vanilla.");
  }

  const requestedFramework = requestedFrameworkValue
    ? (requestedFrameworkValue.toLowerCase() as Framework)
    : null;
  const redirectSlug = projectHome[slug] ?? findDocRedirect(slug);
  if (redirectSlug) {
    const destination = new URL(`/docs/${redirectSlug}.md`, url);
    if (requestedFramework) {
      destination.searchParams.set("framework", requestedFramework);
    }
    throw redirect(308, `${destination.pathname}${destination.search}`);
  }

  const rendered = renderMarkdownDoc(slug, requestedFramework);
  if (!rendered) {
    throw error(404, `Docs page not found: ${slug}`);
  }

  return new Response(rendered.markdown, {
    headers: {
      "content-disposition": "inline",
      "content-type": "text/markdown; charset=utf-8",
      ...(slug.startsWith("snapline/")
        ? { "x-robots-tag": "noindex, nofollow" }
        : {}),
    },
  });
};
