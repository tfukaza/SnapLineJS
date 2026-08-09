import adoptedItemRow from "./AdoptedItemRow.svelte?raw";
import basic from "./ItemBasicDemo.svelte?raw";
import handle from "./ItemHandleDemo.svelte?raw";
import metadata from "./ItemMetadataDemo.svelte?raw";
import itemObject from "./ItemObjectDemo.svelte?raw";
import selection from "./ItemSelectionDemo.svelte?raw";

export const itemExampleKinds = [
  "basic",
  "metadata",
  "selection",
  "item-object",
  "handle",
] as const;

export type ItemExampleKind = (typeof itemExampleKinds)[number];

const itemObjectWithHelper = [
  "<!-- ItemObjectDemo.svelte -->",
  itemObject.trimEnd(),
  "",
  "<!-- AdoptedItemRow.svelte -->",
  adoptedItemRow.trimEnd(),
].join("\n");

export const itemExampleSources: Record<ItemExampleKind, string> = {
  basic,
  metadata,
  selection,
  "item-object": itemObjectWithHelper,
  handle,
};
