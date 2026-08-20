<script lang="ts">
  import { getContext, onDestroy } from "svelte";
  import type { Engine } from "@snap-engine/core";
  import {
    Container as SnapSortContainer,
    Item as SnapSortItem,
    type RenderEntry,
  } from "@snap-engine/snapsort";
  import {
    Container as ContainerView,
    Ghost,
    Item,
  } from "@snap-engine/snapsort/svelte";

  let {
    entries,
    onUnmount,
  }: {
    entries: readonly RenderEntry<"generated" | "adopted">[];
    onUnmount: () => void;
  } = $props();

  const engine = getContext<Engine>("engine");
  const container = getContext<SnapSortContainer>("container");
  const adoptedItem = new SnapSortItem(engine, container, {
    itemId: "item-api-adopted",
  });
  adoptedItem.metadata = { origin: "application" };
  adoptedItem.selected = true;

  let generatedItem = $state<SnapSortItem | null>(null);
  let adoptedBinding = $state<SnapSortItem | null>(adoptedItem);
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

{#each entries as entry (entry.itemId)}
  {#if entry.isGhost}
    <Ghost ghost={entry.ghost} />
  {:else if entry.childTree}
    <ContainerView itemId={entry.itemId} />
  {:else if entry.value === "generated"}
    <Item
      bind:item={generatedItem}
      itemId={entry.itemId}
      metadata={generatedMetadata}
      data-testid="item-api-generated"
      aria-label="Generated Item"
      onclick={() => nativeClicks++}
    >
      Generated item
    </Item>
  {:else}
    <Item bind:item={adoptedBinding} itemId={entry.itemId}>
      Adopted item
    </Item>
  {/if}
{/each}

<button type="button" data-testid="item-api-inspect" onclick={inspect}>
  Inspect items
</button>
<button type="button" data-testid="item-api-unmount" onclick={onUnmount}>
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
