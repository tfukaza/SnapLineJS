<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type {
    ContainerCallbacks,
    DragEndEvent,
    DragItemHoverEvent,
    DropPriorityEvent,
    DropTargetChangeEvent,
    GhostLifecycleEvent,
    ItemHitboxEvent,
    ItemMoveEvent,
    RenderEntry,
    RenderTree,
  } from "@snap-engine/snapsort";
  import {
    createRenderEntry,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
  } from "@snap-engine/snapsort";
  import {
    prioritizeTreeDepth,
    rejectDrop,
  } from "@snap-engine/snapsort/callbacks";
  import { Container, Ghost } from "@snap-engine/snapsort/svelte";
  import InsertionTreeMarker from "./InsertionTreeMarker.svelte";
  import InsertionPlacementTreeNode, {
    insertionTreeRowHeight,
    type InsertionTreeItem,
  } from "./InsertionPlacementTreeNode.svelte";
  import PlacementDemoShell from "./PlacementDemoShell.svelte";

  type TreeInput = InsertionTreeItem & { children?: TreeInput[] };

  const initialItems: TreeInput[] = [
    { id: "one", label: "Item 1", kind: "item" },
    { id: "two", label: "Item 2", kind: "item" },
    {
      id: "three",
      label: "Item 3",
      kind: "group",
      children: [
        { id: "four", label: "Item 4", kind: "item" },
        { id: "five", label: "Item 5", kind: "item" },
        {
          id: "six",
          label: "Item 6",
          kind: "group",
          children: [{ id: "seven", label: "Item 7", kind: "item" }],
        },
      ],
    },
    { id: "eight", label: "Item 8", kind: "item" },
  ];

  function createTree(nodes: readonly TreeInput[]): RenderTree<InsertionTreeItem> {
    return createRenderTree(
      nodes.map(({ children, ...item }) =>
        createRenderEntry(
          item,
          item.id,
          item.kind === "group" ? createTree(children ?? []) : null,
        ),
      ),
    );
  }

  function findEntry(
    tree: RenderTree<InsertionTreeItem>,
    itemId: string,
  ): Extract<RenderEntry<InsertionTreeItem>, { isGhost: false }> | null {
    for (const entry of tree.entries) {
      if (entry.isGhost) continue;
      if (entry.itemId === itemId) return entry;
      const nested = entry.childTree
        ? findEntry(entry.childTree, itemId)
        : null;
      if (nested) return nested;
    }
    return null;
  }

  let tree = $state.raw(createTree(initialItems));
  let hoveredGroupId = $state<string | null>(null);
  let targetContainerId = $state<string | null>(null);
  const highlightedGroupId = $derived(
    hoveredGroupId === targetContainerId ? hoveredGroupId : null,
  );

  function reduce(event: ItemMoveEvent | GhostLifecycleEvent) {
    tree = reduceRenderTree(tree, event);
  }

  function wouldCreateTreeCycle(event: DropPriorityEvent): boolean {
    const containerId = event.containerMetadata.containerId;
    if (typeof containerId !== "string") return false;

    return event.itemIds.some((itemId) => {
      const entry = findEntry(tree, String(itemId));
      if (!entry) return false;
      return (
        entry.itemId === containerId ||
        (entry.childTree && findEntry(entry.childTree, containerId) !== null)
      );
    });
  }

  function prioritizeFileTreeDepth(event: DropPriorityEvent): number {
    if (wouldCreateTreeCycle(event)) return rejectDrop(event);
    const { pointer, containerRect, depth } = event;
    const pointerHitsGroupHeader =
      event.containerMetadata.kind === "group" &&
      pointer.x >= containerRect.x &&
      pointer.x <= containerRect.x + containerRect.width &&
      pointer.y >= containerRect.y &&
      pointer.y <= containerRect.y + insertionTreeRowHeight;
    return pointerHitsGroupHeader ? depth + 1 : prioritizeTreeDepth(event);
  }

  function treeItemHitbox(event: ItemHitboxEvent) {
    if (event.overItemMetadata.kind !== "group") {
      return { shape: "rect" as const, rect: event.defaultRect };
    }
    return {
      shape: "rect" as const,
      rect: {
        ...event.defaultRect,
        height: insertionTreeRowHeight,
      },
    };
  }

  function trackHoveredItem(event: DragItemHoverEvent) {
    hoveredGroupId =
      event.overItemMetadata.kind === "group"
        ? String(event.overItemId)
        : null;
  }

  function clearHoveredItem(event: DragItemHoverEvent) {
    if (hoveredGroupId === String(event.overItemId)) hoveredGroupId = null;
  }

  function trackDropTarget(event: DropTargetChangeEvent) {
    const containerId = event.current?.containerMetadata.containerId;
    targetContainerId =
      typeof containerId === "string" ? containerId : null;
    if (hoveredGroupId !== targetContainerId) hoveredGroupId = null;
  }

  function clearInteractionState(_event: DragEndEvent) {
    hoveredGroupId = null;
    targetContainerId = null;
  }

  const nestedCallbacks = {
    getDropPriority: prioritizeFileTreeDepth,
    getItemHitbox: treeItemHitbox,
    onDragItemEnter: trackHoveredItem,
    onDragItemMove: trackHoveredItem,
    onDragItemLeave: clearHoveredItem,
  } satisfies ContainerCallbacks;

  const rootCallbacks = {
    onItemMove: reduce,
    onGhostInsert: reduce,
    onGhostMove: reduce,
    onGhostRemove: reduce,
    onDropTargetChange: trackDropTarget,
    onDragEnd: clearInteractionState,
    ...nestedCallbacks,
  } satisfies ContainerCallbacks;
</script>

<PlacementDemoShell>
  <Engine id="placement-mode-insertion-default">
    <Container
      itemId="placement-insertion-default-root"
      className="insertion-demo-tree card"
      style={`--tree-row-height: ${insertionTreeRowHeight}px`}
      metadata={{ containerId: "root", kind: "root" }}
      config={{
        animation: defaultAnimations,
        mode: "insertion",
        direction: "column",
        callbacks: rootCallbacks,
      }}
    >
      {#each tree.entries as entry (entry.itemId)}
        {#if entry.isGhost}
          {#if entry.ghost.type === "insertion-marker"}
            <InsertionTreeMarker
              ghost={entry.ghost}
              hidden={highlightedGroupId !== null}
            />
          {:else}
            <Ghost ghost={entry.ghost} />
          {/if}
        {:else}
          <InsertionPlacementTreeNode
            {entry}
            callbacks={nestedCallbacks}
            {highlightedGroupId}
          />
        {/if}
      {/each}
    </Container>
  </Engine>
</PlacementDemoShell>

<style>
  :global(.insertion-demo-tree) {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    width: min(100%, 24rem);
    margin: 0 auto;
    padding: var(--size-8) 0;
    gap: 0 !important;
    overflow: hidden;
    border-color: color-mix(
      in srgb,
      var(--color-background-dark) 22%,
      transparent
    );
    border-radius: var(--ui-radius);
    background: var(--color-background);
    box-shadow: 0 10px 30px
      color-mix(in srgb, var(--color-background-dark) 8%, transparent);
    box-sizing: border-box;
  }
</style>
