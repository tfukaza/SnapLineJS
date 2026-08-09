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
  const item = new SnapSortItem(engine, container);
  item.itemId = initialId;
  item.metadata = { origin: "application" };

  onDestroy(() => {
    item.destroy(false);
  });
</script>

<Item {item} className="adopted-card">
  <span>{label}</span>
  <button type="button" onclick={() => onInspect(item)}>
    Inspect core item
  </button>
</Item>
