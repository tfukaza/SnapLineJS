<script lang="ts">
  import type { Component } from "svelte";
  import { page } from "$app/stores";
  import ClientDemoFrame from "$lib/components/ClientDemoFrame.svelte";
  import ContainerPropertyBeforeAfterDemo from "./ContainerPropertyBeforeAfterDemo.svelte";
  import ContainerPropertyCollectionDemo from "./ContainerPropertyCollectionDemo.svelte";
  import ContainerPropertyConfigDemo from "./ContainerPropertyConfigDemo.svelte";
  import type { ContainerPropertyExampleKind } from "./containerPropertyExampleSources";
  import DemoCodeTabs from "./DemoCodeTabs.svelte";
  import ContainerPropertyGhostDemo from "./ContainerPropertyGhostDemo.svelte";
  import ContainerPropertyMetadataDemo from "./ContainerPropertyMetadataDemo.svelte";
  import ContainerPropertyNestedDemo from "./ContainerPropertyNestedDemo.svelte";
  import ContainerPropertyPresentationDemo from "./ContainerPropertyPresentationDemo.svelte";

  type Example = {
    label: string;
    component: Component;
  };

  type PageDataWithExamples = {
    containerPropertyExampleHtml?: Partial<
      Record<ContainerPropertyExampleKind, string>
    > | null;
  };

  const examples: Record<ContainerPropertyExampleKind, Example> = {
    collection: {
      label: "Rendering a collection",
      component: ContainerPropertyCollectionDemo,
    },
    config: {
      label: "Changing container behavior",
      component: ContainerPropertyConfigDemo,
    },
    "before-after": {
      label: "Fixed content around items",
      component: ContainerPropertyBeforeAfterDemo,
    },
    metadata: {
      label: "Moving items between containers",
      component: ContainerPropertyMetadataDemo,
    },
    nested: {
      label: "Nested containers",
      component: ContainerPropertyNestedDemo,
    },
    ghost: {
      label: "Custom drag placeholder",
      component: ContainerPropertyGhostDemo,
    },
    presentation: {
      label: "Classes, styles, and HTML attributes",
      component: ContainerPropertyPresentationDemo,
    },
  };

  let { kind }: { kind: ContainerPropertyExampleKind } = $props();
  const example = $derived(examples[kind]);
  const ExampleComponent = $derived(example.component);
  const codeHtml = $derived(
    ($page.data as PageDataWithExamples).containerPropertyExampleHtml?.[kind] ??
      "",
  );
</script>

<DemoCodeTabs
  id={`container-property-${kind}`}
  label={example.label}
  {codeHtml}
>
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
