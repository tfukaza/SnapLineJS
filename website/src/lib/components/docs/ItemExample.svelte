<script lang="ts">
  import type { Component } from "svelte";
  import { page } from "$app/stores";
  import ClientDemoFrame from "$lib/components/ClientDemoFrame.svelte";
  import DemoCodeTabs from "./DemoCodeTabs.svelte";
  import ItemBasicDemo from "./ItemBasicDemo.svelte";
  import ItemHandleDemo from "./ItemHandleDemo.svelte";
  import ItemMetadataDemo from "./ItemMetadataDemo.svelte";
  import ItemInstanceDemo from "./ItemInstanceDemo.svelte";
  import ItemSelectionDemo from "./ItemSelectionDemo.svelte";
  import type { ItemExampleKind } from "./itemExampleSources";

  type Example = {
    label: string;
    component: Component;
  };

  type PageDataWithExamples = {
    itemExampleHtml?: Partial<Record<ItemExampleKind, string>> | null;
  };

  const examples: Record<ItemExampleKind, Example> = {
    basic: {
      label: "A basic item",
      component: ItemBasicDemo,
    },
    metadata: {
      label: "Metadata in callbacks",
      component: ItemMetadataDemo,
    },
    selection: {
      label: "Consumer-owned selection",
      component: ItemSelectionDemo,
    },
    "item-instance": {
      label: "Adopting a core item",
      component: ItemInstanceDemo,
    },
    handle: {
      label: "Dragging from a handle",
      component: ItemHandleDemo,
    },
  };

  let { kind }: { kind: ItemExampleKind } = $props();
  const example = $derived(examples[kind]);
  const ExampleComponent = $derived(example.component);
  const codeHtml = $derived(
    ($page.data as PageDataWithExamples).itemExampleHtml?.[kind] ?? "",
  );
</script>

<DemoCodeTabs id={`item-example-${kind}`} label={example.label} {codeHtml}>
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
