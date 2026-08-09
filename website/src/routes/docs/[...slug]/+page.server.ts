import type { PageServerLoad } from "./$types";
import {
  containerIntroExampleKinds,
  containerIntroExampleSources,
  type ContainerIntroExampleKind,
} from "$lib/components/docs/containerIntroExampleSources";
import {
  containerPropertyExampleKinds,
  containerPropertyExampleSources,
  type ContainerPropertyExampleKind,
} from "$lib/components/docs/containerPropertyExampleSources";
import { highlightDocsCode } from "$lib/server/highlight";

const containerReferenceSlug = "snapsort/reference/svelte/container";

export const load: PageServerLoad = async ({ params }) => {
  if (params.slug !== containerReferenceSlug) {
    return {
      containerIntroExampleHtml: null,
      containerPropertyExampleHtml: null,
    };
  }

  const [highlightedIntroEntries, highlightedPropertyEntries] =
    await Promise.all([
      Promise.all(
        containerIntroExampleKinds.map(
          async (kind) =>
            [
              kind,
              await highlightDocsCode(
                containerIntroExampleSources[kind],
                "svelte",
              ),
            ] as const,
        ),
      ),
      Promise.all(
        containerPropertyExampleKinds.map(
          async (kind) =>
            [
              kind,
              await highlightDocsCode(
                containerPropertyExampleSources[kind],
                "svelte",
              ),
            ] as const,
        ),
      ),
    ]);

  return {
    containerIntroExampleHtml: Object.fromEntries(
      highlightedIntroEntries,
    ) as Record<ContainerIntroExampleKind, string>,
    containerPropertyExampleHtml: Object.fromEntries(
      highlightedPropertyEntries,
    ) as Record<ContainerPropertyExampleKind, string>,
  };
};
