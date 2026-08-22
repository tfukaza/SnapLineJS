<script lang="ts">
  import type { Component } from "svelte";
  import ClientDemoFrame from "$lib/components/ClientDemoFrame.svelte";
  import DemoCodeTabs from "./DemoCodeTabs.svelte";
  import ItemBasicDemo from "./ItemBasicDemo.svelte";
  import ItemHandleDemo from "./ItemHandleDemo.svelte";
  import ItemMetadataDemo from "./ItemMetadataDemo.svelte";
  import ItemInstanceDemo from "./ItemInstanceDemo.svelte";
  import ItemSelectionDemo from "./ItemSelectionDemo.svelte";
  import {
    itemExampleId,
    snapSortExampleMetadata,
    type ItemExampleKind,
  } from "./snapsortExampleCatalog";

  const exampleComponents = {
    basic: ItemBasicDemo,
    metadata: ItemMetadataDemo,
    selection: ItemSelectionDemo,
    "item-instance": ItemInstanceDemo,
    handle: ItemHandleDemo,
  } satisfies Record<ItemExampleKind, Component>;

  let { kind }: { kind: ItemExampleKind } = $props();
  const id = $derived(itemExampleId(kind));
  const label = $derived(snapSortExampleMetadata[id].label);
  const ExampleComponent = $derived(exampleComponents[kind]);
</script>

<DemoCodeTabs {id} {label}>
  {#snippet demo()}
    <ClientDemoFrame className="item-example-demo-skeleton">
      <div class="item-example-demo-surface">
        <ExampleComponent />
      </div>
    </ClientDemoFrame>
  {/snippet}
</DemoCodeTabs>

<style>
  .item-example-demo-surface {
    min-height: 13rem;
    user-select: none;
  }

  :global(.item-example-demo-surface .snap-engine-canvas) {
    overflow: visible !important;
  }
</style>
