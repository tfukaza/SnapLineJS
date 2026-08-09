<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type {
    CanDropEvent,
    Container as SnapSortContainer,
    ItemMoveEvent,
  } from "@snap-engine/snapsort";
  import { Container, Item } from "@snap-engine/snapsort/svelte";

  type Task = { kind: "task"; id: string; label: string };
  type TaskGroup = {
    kind: "group";
    id: string;
    label: string;
    items: Task[];
    container?: SnapSortContainer;
  };
  type BoardEntry = Task | TaskGroup;

  let entries = $state<BoardEntry[]>([
    { kind: "task", id: "inbox", label: "Inbox zero" },
    {
      kind: "group",
      id: "today",
      label: "Today",
      items: [
        { kind: "task", id: "draft", label: "Draft update" },
        { kind: "task", id: "review", label: "Review changes" },
      ],
    },
    { kind: "task", id: "notes", label: "Archive notes" },
    {
      kind: "group",
      id: "later",
      label: "Later",
      items: [{ kind: "task", id: "publish", label: "Publish update" }],
    },
  ]);

  function onBoardMove(event: ItemMoveEvent) {
    const entry = entries.find((candidate) => candidate.id === event.itemId);
    if (!entry) return;

    const next = entries.filter((candidate) => candidate.id !== event.itemId);
    next.splice(Math.min(event.to.index, next.length), 0, entry);
    entries = next;
  }

  function onTaskMove(event: ItemMoveEvent) {
    const groups = entries.filter(
      (entry): entry is TaskGroup => entry.kind === "group",
    );
    const task = groups
      .flatMap((group) => group.items)
      .find((candidate) => candidate.id === event.itemId);
    const destination = groups.find(
      (group) => group.container === event.to.container,
    );
    if (!task || !destination) return;

    for (const group of groups) {
      group.items = group.items.filter((candidate) => candidate.id !== task.id);
    }
    destination.items.splice(
      Math.min(event.to.index, destination.items.length),
      0,
      task,
    );
  }

  function canDropWithinGroup(event: CanDropEvent) {
    return (
      event.source?.containerMetadata.dropGroup ===
      event.containerMetadata.dropGroup
    );
  }
</script>

<Engine id="container-intro-mixed">
  <Container
    items={entries}
    metadata={{ dropGroup: "board-entries" }}
    config={{ callbacks: { onItemMove: onBoardMove, canDrop: canDropWithinGroup } }}
  >
    {#snippet entry(boardEntry)}
      {#if boardEntry.kind === "task"}
        <Item itemId={boardEntry.id}>{boardEntry.label}</Item>
      {:else}
        <Container
          bind:container={boardEntry.container}
          itemId={boardEntry.id}
          locked={false}
          items={boardEntry.items}
          metadata={{ dropGroup: "group-tasks" }}
          config={{ callbacks: { onItemMove: onTaskMove, canDrop: canDropWithinGroup } }}
        >
          {#snippet before()}
            <strong>{boardEntry.label}</strong>
          {/snippet}
          {#snippet entry(task)}
            <Item itemId={task.id}>{task.label}</Item>
          {/snippet}
        </Container>
      {/if}
    {/snippet}
  </Container>
</Engine>
