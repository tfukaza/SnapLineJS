<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type { ItemMoveEvent } from "@snap-engine/snapsort";
  import { Container, Item } from "@snap-engine/snapsort/svelte";

  type Task = { id: string; label: string };

  let todos: Task[] = $state([
    { id: "buy-milk", label: "Buy milk" },
    { id: "walk-dog", label: "Walk the dog" },
  ]);

  function onItemMove(event: ItemMoveEvent) {
    const todo = todos.find((entry) => entry.id === event.itemId);
    if (!todo) return;

    const next = todos.filter((entry) => entry.id !== event.itemId);
    const index = Math.max(0, Math.min(event.to.index, next.length));
    next.splice(index, 0, todo);
    todos = next;
  }
</script>

<Engine id="container-intro-sortable">
  <Container config={{ callbacks: { onItemMove } }} items={todos}>
    {#snippet entry(todo)}
      <Item itemId={todo.id}>{todo.label}</Item>
    {/snippet}
  </Container>
</Engine>
