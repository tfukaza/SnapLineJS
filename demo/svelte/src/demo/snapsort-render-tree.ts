import type {
  ContainerCallbacks,
  RenderTreeEvent,
} from "@snap-engine/snapsort";

type ReducerCallbacks = Pick<
  ContainerCallbacks,
  | "onItemMove"
  | "onItemRemove"
  | "onItemSwap"
  | "onGhostInsert"
  | "onGhostMove"
  | "onGhostRemove"
>;

export function renderTreeCallbacks(
  apply: (event: RenderTreeEvent) => void,
): ReducerCallbacks {
  return {
    onItemMove: apply,
    onItemRemove: apply,
    onItemSwap: apply,
    onGhostInsert: apply,
    onGhostMove: apply,
    onGhostRemove: apply,
  };
}
