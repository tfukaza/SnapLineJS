import { frameworks, type Framework } from "$lib/frameworks";
import { sampleLanguages, samples } from "$lib/landing/quickStart";
import { highlightCode } from "$lib/server/highlight";
import type { PageServerLoad } from "./$types";

export const ssr = true;
export const csr = true;

export const load: PageServerLoad = async () => {
  // Highlight server-side so shiki never ships to the browser.
  const entries = await Promise.all(
    frameworks.map(
      async (framework: Framework) =>
        [
          framework,
          await highlightCode(samples[framework], sampleLanguages[framework]),
        ] as const,
    ),
  );

  return {
    highlightedSamples: Object.fromEntries(entries) as Record<Framework, string>,
  };
};
