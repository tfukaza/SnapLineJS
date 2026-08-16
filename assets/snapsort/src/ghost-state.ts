import type { Container } from "./container";
import type {
  GhostInsertEvent,
  GhostMoveEvent,
  GhostState,
  GhostRemoveEvent,
} from "./events";
import { isFlowSpacerState } from "./internal/flow-slots";
import { renderKey, type RenderKey } from "./render-key";
import type { ItemId } from "./snapshot";

export type RenderEntry<T> =
  | { isGhost: false; key: RenderKey; id: ItemId; value: T }
  | { isGhost: true; key: RenderKey; id: ItemId; ghost: GhostState };

function sameLocation(
  a: GhostState["location"],
  b: GhostState["location"],
): boolean {
  return (
    a.type === b.type &&
    a.container === b.container &&
    (a.type === "overlay" || (b.type === "slot" && a.index === b.index))
  );
}

export function insertGhostState(
  current: readonly GhostState[],
  event: GhostInsertEvent,
): GhostState[] {
  if (current.some((entry) => entry.ghostItemId === event.ghost.ghostItemId)) {
    throw new Error(
      `SnapSort: ghost "${event.ghost.ghostItemId}" is already present.`,
    );
  }
  return [...current, event.ghost];
}

export function moveGhostState(
  current: readonly GhostState[],
  event: GhostMoveEvent,
): GhostState[] {
  const index = current.findIndex(
    (entry) => entry.ghostItemId === event.ghost.ghostItemId,
  );
  if (index === -1) {
    throw new Error(
      `SnapSort: cannot move absent ghost "${event.ghost.ghostItemId}".`,
    );
  }
  if (!sameLocation(current[index].location, event.from)) {
    throw new Error(
      `SnapSort: ghost "${event.ghost.ghostItemId}" moved from a stale location.`,
    );
  }
  const next = current.slice();
  next[index] = event.ghost;
  return next;
}

export function removeGhostState(
  current: readonly GhostState[],
  event: GhostRemoveEvent,
): GhostState[] {
  return current.filter(
    (entry) => entry.ghostItemId !== event.ghost.ghostItemId,
  );
}

export function composeRenderEntries<T>({
  container,
  values,
  getId,
  ghosts,
}: {
  container: Container;
  values: readonly T[];
  getId: (value: T) => ItemId;
  ghosts: readonly GhostState[];
}): RenderEntry<T>[] {
  const keys = new Set<RenderKey>();
  const itemEntries: Extract<RenderEntry<T>, { isGhost: false }>[] = values.map(
    (value) => {
      const id = getId(value);
      const key = renderKey("item", id);
      if (keys.has(key)) {
        throw new Error(`SnapSort: duplicate Item ID "${id}".`);
      }
      keys.add(key);
      return { isGhost: false, key, id, value };
    },
  );
  const local = ghosts.filter(
    (ghost) => ghost.location.container === container,
  );
  for (const ghost of local) {
    const key = renderKey("ghost", ghost.ghostItemId);
    if (keys.has(key)) {
      throw new Error(`SnapSort: duplicate ghost ID "${ghost.ghostItemId}".`);
    }
    keys.add(key);
  }

  const slots = local.filter(isFlowSpacerState);
  const slotsByIndex = new Map<number, (typeof slots)[number]>();
  for (const ghost of slots) {
    const index = ghost.location.index;
    if (!Number.isInteger(index) || index < 0) {
      throw new Error(
        `SnapSort: ghost "${ghost.ghostItemId}" has invalid slot ${String(index)}.`,
      );
    }
    const previous = slotsByIndex.get(index);
    if (previous) {
      throw new Error(
        `SnapSort: ghosts "${previous.ghostItemId}" and "${ghost.ghostItemId}" share slot ${index}.`,
      );
    }
    slotsByIndex.set(index, ghost);
  }

  const draggedIds = new Set<ItemId>();
  const representedSessions = new Set<GhostState["session"]>();
  for (const ghost of slots) {
    if (representedSessions.has(ghost.session)) continue;
    representedSessions.add(ghost.session);
    for (const id of ghost.itemIds) draggedIds.add(id);
  }
  const result: RenderEntry<T>[] = [];
  let slotIndex = 0;
  const appendGhostsAtCurrentSlot = () => {
    let ghost = slotsByIndex.get(slotIndex);
    while (ghost) {
      slotsByIndex.delete(slotIndex);
      result.push({
        isGhost: true,
        key: renderKey("ghost", ghost.ghostItemId),
        id: ghost.ghostItemId,
        ghost,
      });
      slotIndex += 1;
      ghost = slotsByIndex.get(slotIndex);
    }
  };

  for (const entry of itemEntries) {
    if (draggedIds.has(entry.id)) {
      result.push(entry);
      continue;
    }
    appendGhostsAtCurrentSlot();
    result.push(entry);
    slotIndex += 1;
  }
  appendGhostsAtCurrentSlot();

  const unreachable = slotsByIndex.values().next().value;
  if (unreachable) {
    throw new Error(
      `SnapSort: ghost "${unreachable.ghostItemId}" has invalid slot ${String(unreachable.location.index)}.`,
    );
  }

  for (const ghost of local) {
    if (isFlowSpacerState(ghost)) continue;
    result.push({
      isGhost: true,
      key: renderKey("ghost", ghost.ghostItemId),
      id: ghost.ghostItemId,
      ghost,
    });
  }
  return result;
}
