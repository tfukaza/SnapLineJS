<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { defaultAnimations, type ItemMoveEvent } from "@snap-engine/snapsort";
  import { Container, Item } from "@snap-engine/snapsort/svelte";

  type Task = { id: string; label: string };

  let tasks = $state<Task[]>([
    { id: "outline", label: "Outline the article" },
    { id: "draft", label: "Write the first draft" },
    { id: "review", label: "Review the copy" },
  ]);

  function onItemMove(event: ItemMoveEvent) {
    const itemId = String(event.itemId);
    const task = tasks.find((entry) => entry.id === itemId);
    if (!task) return;

    const next = tasks.filter((entry) => entry.id !== itemId);
    next.splice(Math.min(event.to.index, next.length), 0, task);
    tasks = next;
  }
</script>

<div class="item-basic-demo">
  <p>Drag an item to reorder the list.</p>

  <Engine id="item-example-basic">
    <Container
      className="item-demo-list"
      items={tasks}
      config={{ animation: defaultAnimations, callbacks: { onItemMove } }}
    >
      {#snippet entry(task)}
        <Item itemId={task.id} className="item-demo-card">
          {task.label}
        </Item>
      {/snippet}
    </Container>
  </Engine>
</div>

<style>
  .item-basic-demo {
    display: grid;
    gap: 0.75rem;
  }

  p {
    margin: 0;
    color: color-mix(in srgb, var(--color-text) 72%, transparent);
    font-size: 0.82rem;
    text-align: center;
  }

  :global(.item-basic-demo .item-demo-list) {
    gap: 0.5rem;
    width: min(100%, 24rem);
    margin: 0 auto;
  }

  :global(.item-basic-demo .item-demo-card) {
    align-items: flex-start !important;
    width: 100%;
    padding: 0.75rem 0.9rem !important;
    border: 1px solid rgb(58 42 34 / 18%);
    border-radius: 9px;
    background: white;
    box-shadow: 0 1px 3px rgb(31 30 41 / 7%);
    cursor: grab;
  }
</style>
