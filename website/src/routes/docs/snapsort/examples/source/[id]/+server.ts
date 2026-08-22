import { error } from "@sveltejs/kit";
import { highlightDocsCode } from "$lib/server/highlight";
import { findSnapSortExampleSource } from "$lib/server/snapsortExampleSources";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ params }) => {
  const example = findSnapSortExampleSource(params.id);
  if (!example) {
    throw error(404, `SnapSort example source not found: ${params.id}`);
  }

  const html = await highlightDocsCode(example.code, example.language);
  return new Response(html, {
    headers: {
      "content-type": "text/html; charset=utf-8",
    },
  });
};
