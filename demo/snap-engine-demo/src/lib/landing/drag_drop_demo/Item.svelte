<script lang="ts">
  import { onMount, getContext, onDestroy } from "svelte";
  import { ItemContainer } from "../../../../../../src/asset/drag_and_drop/container";
  import { ItemObject } from "../../../../../../src/asset/drag_and_drop/item";
  import type { SnapLine } from "../../../../../../src/index";
  import "../../../app.scss";

  let { children }: { children: any } = $props();
  const engine: SnapLine = getContext("engine");
  const itemContainer: ItemContainer = getContext("itemContainer");

  let itemObject: ItemObject = new ItemObject(engine.global, null);

  onMount(() => {
    itemContainer.addItem(itemObject);
  });

  onDestroy(() => {
    itemObject.destroy();
  });
</script>

<div class="item-wrapper" bind:this={itemObject.element}>
  <div class="card item">
    {@render children()}
  </div>
</div>

<style>
  .item-wrapper {
    padding: var(--size-4);
  }

  .item {
    height: var(--size-16);
  }

  .card {
    padding: var(--size-12);
  }
</style>
