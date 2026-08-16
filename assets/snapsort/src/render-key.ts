import type { ItemId } from "./snapshot";

export type RenderKey = `item:${string}` | `ghost:${string}`;

export function renderKey(kind: "item" | "ghost", id: ItemId): RenderKey {
  return kind === "item" ? `item:${id}` : `ghost:${id}`;
}
