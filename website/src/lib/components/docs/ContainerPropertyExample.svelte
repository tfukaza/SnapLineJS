<script lang="ts">
  import type { Component } from "svelte";
  import ClientDemoFrame from "$lib/components/ClientDemoFrame.svelte";
  import ContainerPropertyBeforeAfterDemo from "./ContainerPropertyBeforeAfterDemo.svelte";
  import ContainerPropertyCollectionDemo from "./ContainerPropertyCollectionDemo.svelte";
  import ContainerPropertyConfigDemo from "./ContainerPropertyConfigDemo.svelte";
  import DemoCodeTabs from "./DemoCodeTabs.svelte";
  import ContainerPropertyGhostDemo from "./ContainerPropertyGhostDemo.svelte";
  import ContainerPropertyMetadataDemo from "./ContainerPropertyMetadataDemo.svelte";
  import ContainerPropertyNestedDemo from "./ContainerPropertyNestedDemo.svelte";
  import ContainerPropertyPresentationDemo from "./ContainerPropertyPresentationDemo.svelte";
  import {
    containerPropertyExampleId,
    snapSortExampleMetadata,
    type ContainerPropertyExampleKind,
  } from "./snapsortExampleCatalog";

  const exampleComponents = {
    collection: ContainerPropertyCollectionDemo,
    config: ContainerPropertyConfigDemo,
    "before-after": ContainerPropertyBeforeAfterDemo,
    metadata: ContainerPropertyMetadataDemo,
    nested: ContainerPropertyNestedDemo,
    ghost: ContainerPropertyGhostDemo,
    presentation: ContainerPropertyPresentationDemo,
  } satisfies Record<ContainerPropertyExampleKind, Component>;

  let { kind }: { kind: ContainerPropertyExampleKind } = $props();
  const id = $derived(containerPropertyExampleId(kind));
  const label = $derived(snapSortExampleMetadata[id].label);
  const ExampleComponent = $derived(exampleComponents[kind]);
</script>

<DemoCodeTabs {id} {label}>
  {#snippet demo()}
    <ClientDemoFrame className="container-property-demo-skeleton">
      <div class="container-property-demo-surface">
        <ExampleComponent />
      </div>
    </ClientDemoFrame>
  {/snippet}
</DemoCodeTabs>

<style>
  .container-property-demo-surface {
    min-height: 12rem;
    user-select: none;
  }

  :global(.container-property-demo-surface .snap-engine-canvas) {
    overflow: visible !important;
  }
</style>
