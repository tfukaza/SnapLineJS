<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { Container, Item } from "@snap-engine/snapsort/svelte";

  type Task = { id: string; label: string };

  const todos: Task[] = [
    { id: "buy-milk", label: "Buy milk" },
    { id: "walk-dog", label: "Walk the dog" },
  ];
</script>

<Engine id="container-intro-basic">
  <Container items={todos}>
    {#snippet entry(todo)}
      <Item itemId={todo.id}>{todo.label}</Item>
    {/snippet}
  </Container>
</Engine>
