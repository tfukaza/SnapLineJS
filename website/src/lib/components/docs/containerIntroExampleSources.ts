import basic from "./ContainerIntroBasicDemo.svelte?raw";
import mixed from "./ContainerIntroMixedDemo.svelte?raw";
import sortable from "./ContainerIntroSortableDemo.svelte?raw";

export const containerIntroExampleKinds = [
  "basic",
  "sortable",
  "mixed",
] as const;

export type ContainerIntroExampleKind =
  (typeof containerIntroExampleKinds)[number];

export const containerIntroExampleSources: Record<
  ContainerIntroExampleKind,
  string
> = {
  basic,
  sortable,
  mixed,
};
