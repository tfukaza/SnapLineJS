<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type {
    ContainerCallbacks,
    DropPriorityEvent,
    GhostLifecycleEvent,
    ItemMoveEvent,
  } from "@snap-engine/snapsort";
  import { rejectDrop } from "@snap-engine/snapsort/callbacks";
  import {
    createRenderEntry,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
  } from "@snap-engine/snapsort";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";

  type Task = { kind: "task"; id: string; label: string };
  type TaskGroup = {
    kind: "group";
    id: string;
    label: string;
  };
  type BoardEntry = Task | TaskGroup;

  const taskEntry = (id: string, label: string) =>
    createRenderEntry<BoardEntry>({ kind: "task", id, label }, id);

  let board = $state.raw(
    createRenderTree<BoardEntry>([
      taskEntry("inbox", "Inbox zero"),
      createRenderEntry(
        { kind: "group", id: "today", label: "Today" },
        "today",
        createRenderTree([
          taskEntry("draft", "Draft update"),
          taskEntry("review", "Review changes"),
        ]),
      ),
      taskEntry("notes", "Archive notes"),
      createRenderEntry(
        { kind: "group", id: "later", label: "Later" },
        "later",
        createRenderTree([taskEntry("publish", "Publish update")]),
      ),
    ]),
  );

  function onItemMove(event: ItemMoveEvent) {
    board = reduceRenderTree(board, event);
  }

  function onGhostMove(event: GhostLifecycleEvent) {
    board = reduceRenderTree(board, event);
  }

  function prioritizeWithinGroup(event: DropPriorityEvent) {
    const matches =
      event.source?.containerMetadata.dropGroup ===
      event.containerMetadata.dropGroup;
    return matches ? undefined : rejectDrop(event);
  }

  const callbacks = {
    onItemMove,
    onGhostInsert: onGhostMove,
    onGhostMove,
    onGhostRemove: onGhostMove,
    getDropPriority: prioritizeWithinGroup,
  } satisfies ContainerCallbacks;
</script>

<Engine id="container-intro-mixed">
  <Container
    itemId="container-intro-mixed-root"
    metadata={{ dropGroup: "board-entries" }}
    config={{ animation: defaultAnimations, callbacks }}
  >
    {#each board.entries as entry (entry.itemId)}
      {#if entry.isGhost}
        <Ghost ghost={entry.ghost} />
      {:else if entry.childTree}
        <Container
          itemId={entry.itemId}
          locked={false}
          metadata={{ dropGroup: "group-tasks" }}
          config={{ animation: defaultAnimations, callbacks: { getDropPriority: prioritizeWithinGroup } }}
        >
          <strong>{entry.value.label}</strong>
          {#each entry.childTree.entries as child (child.itemId)}
            {#if child.isGhost}
              <Ghost ghost={child.ghost} />
            {:else if child.childTree}
              <Container itemId={child.itemId} />
            {:else}
              <Item itemId={child.itemId}>{child.value.label}</Item>
            {/if}
          {/each}
        </Container>
      {:else}
        <Item itemId={entry.itemId}>{entry.value.label}</Item>
      {/if}
    {/each}
  </Container>
</Engine>
