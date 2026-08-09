import adoptedItemRow from "./AdoptedItemRow.svelte?raw";
import basic from "./ItemBasicDemo.svelte?raw";
import handle from "./ItemHandleDemo.svelte?raw";
import metadata from "./ItemMetadataDemo.svelte?raw";
import itemInstance from "./ItemInstanceDemo.svelte?raw";
import selection from "./ItemSelectionDemo.svelte?raw";

export const itemExampleKinds = [
  "basic",
  "metadata",
  "selection",
  "item-instance",
  "handle",
] as const;

export type ItemExampleKind = (typeof itemExampleKinds)[number];

const itemInstanceWithHelper = [
  "<!-- ItemInstanceDemo.svelte -->",
  itemInstance.trimEnd(),
  "",
  "<!-- AdoptedItemRow.svelte -->",
  adoptedItemRow.trimEnd(),
].join("\n");

export const itemExampleSources: Record<ItemExampleKind, string> = {
  basic,
  metadata,
  selection,
  "item-instance": itemInstanceWithHelper,
  handle,
};
