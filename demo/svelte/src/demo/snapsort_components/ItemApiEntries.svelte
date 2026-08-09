<script lang="ts">
  import { getContext, onDestroy } from "svelte";
  import type { Engine } from "@snap-engine/core";
  import {
    Container as SnapSortContainer,
    Item as SnapSortItem,
  } from "@snap-engine/snapsort";
  import { Item } from "@snap-engine/snapsort/svelte";

  const engine = getContext<Engine>("engine");
  const container = getContext<SnapSortContainer>("container");
  const adoptedItem = new SnapSortItem(engine, container);
  adoptedItem.itemId = "item-api-adopted";
  adoptedItem.metadata = { origin: "application" };
  adoptedItem.selected = true;

  let generatedItem = $state<SnapSortItem | null>(null);
  let adoptedBinding = $state<SnapSortItem | null>(adoptedItem);
  let showItems = $state(true);
  let report = $state("ready");
  let generatedMetadata = $state({ version: 1 });
  let nativeClicks = $state(0);

  function inspect() {
    report = JSON.stringify({
      adoptedBound: adoptedBinding === adoptedItem && adoptedItem.element !== null,
      adoptedDestroyed: adoptedItem.isDeleteRequested,
      adoptedDetached: adoptedItem.element === null,
      adoptedMetadata: adoptedItem.metadata.origin,
      adoptedParent: adoptedItem.parent === container,
      adoptedSelected: adoptedItem.selected,
      generatedBound: generatedItem !== null && generatedItem.element !== null,
      generatedDestroyed: generatedItem?.isDeleteRequested ?? false,
      generatedMetadata: generatedItem?.metadata.version ?? null,
      generatedParent: generatedItem?.parent === container,
      nativeClicks,
    });
  }

  onDestroy(() => {
    adoptedItem.destroy(false);
  });
</script>

{#if showItems}
  <Item
    bind:item={generatedItem}
    itemId="item-api-generated"
    metadata={generatedMetadata}
    data-testid="item-api-generated"
    aria-label="Generated Item"
    onclick={() => nativeClicks++}
  >
    Generated item
  </Item>
  <Item bind:item={adoptedBinding}>
    Adopted item
  </Item>
{/if}

<button type="button" data-testid="item-api-inspect" onclick={inspect}>
  Inspect items
</button>
<button type="button" data-testid="item-api-unmount" onclick={() => (showItems = false)}>
  Unmount items
</button>
<button
  type="button"
  data-testid="item-api-replace-metadata"
  onclick={() => (generatedMetadata = { version: 2 })}
>
  Replace metadata
</button>
<output data-testid="item-api-report">{report}</output>
