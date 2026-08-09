import beforeAfter from "./ContainerPropertyBeforeAfterDemo.svelte?raw";
import collection from "./ContainerPropertyCollectionDemo.svelte?raw";
import config from "./ContainerPropertyConfigDemo.svelte?raw";
import ghost from "./ContainerPropertyGhostDemo.svelte?raw";
import metadata from "./ContainerPropertyMetadataDemo.svelte?raw";
import nested from "./ContainerPropertyNestedDemo.svelte?raw";
import presentation from "./ContainerPropertyPresentationDemo.svelte?raw";

export const containerPropertyExampleKinds = [
  "collection",
  "config",
  "before-after",
  "metadata",
  "nested",
  "ghost",
  "presentation",
] as const;

export type ContainerPropertyExampleKind =
  (typeof containerPropertyExampleKinds)[number];

export const containerPropertyExampleSources: Record<
  ContainerPropertyExampleKind,
  string
> = {
  collection,
  config,
  "before-after": beforeAfter,
  metadata,
  nested,
  ghost,
  presentation,
};
