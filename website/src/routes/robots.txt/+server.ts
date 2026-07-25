import { siteUrl } from "$lib/seo";

export function GET() {
  return new Response(
    [
      "User-agent: *",
      "Allow: /",
      "",
      `Sitemap: ${siteUrl}/sitemap.xml`,
      "",
      `# Documentation for coding agents: ${siteUrl}/llms.txt`,
      "",
    ].join("\n"),
    {
      headers: {
        "content-type": "text/plain; charset=utf-8",
      },
    },
  );
}
