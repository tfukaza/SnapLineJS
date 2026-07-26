import { entries } from "../docs/[...slug]/+page";
import { absoluteUrl, canonicalPath } from "$lib/seo";

const staticPaths = [
  "/",
  "/snapsort",
  "/snapsort/gallery",
  "/about",
  "/docs",
];

function xmlEscape(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function GET() {
  const docPaths = entries().map((entry) => `/docs/${entry.slug}`);
  const urls = Array.from(new Set([...staticPaths, ...docPaths]))
    .map(canonicalPath)
    .map(absoluteUrl);

  const body = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...urls.map((url) => `  <url><loc>${xmlEscape(url)}</loc></url>`),
    "</urlset>",
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "content-type": "application/xml; charset=utf-8",
    },
  });
}
