<script lang="ts">
  import { getContext, onDestroy, untrack } from "svelte";
  import type { Engine } from "@snap-engine/core";
  import {
    Container as SnapSortContainer,
    Item as SnapSortItem,
  } from "@snap-engine/snapsort";
  import { Item } from "@snap-engine/snapsort/svelte";

  let {
    id,
    label,
    onInspect,
  }: {
    id: string;
    label: string;
    onInspect: (item: SnapSortItem) => void;
  } = $props();

  const engine = getContext<Engine>("engine");
  const container = getContext<SnapSortContainer>("container");
  const initialId = untrack(() => id);
  const itemObject = new SnapSortItem(engine, container);
  itemObject.itemId = initialId;
  itemObject.metadata = { origin: "application" };

  onDestroy(() => {
    itemObject.destroy(false);
  });
</script>

<Item {itemObject} className="adopted-card">
  <span>{label}</span>
  <button type="button" onclick={() => onInspect(itemObject)}>
    Inspect core object
  </button>
</Item>
