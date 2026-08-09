<script lang="ts">
  import type { Component } from "svelte";
  import { page } from "$app/stores";
  import ClientDemoFrame from "$lib/components/ClientDemoFrame.svelte";
  import ContainerIntroBasicDemo from "./ContainerIntroBasicDemo.svelte";
  import ContainerIntroMixedDemo from "./ContainerIntroMixedDemo.svelte";
  import ContainerIntroSortableDemo from "./ContainerIntroSortableDemo.svelte";
  import type { ContainerIntroExampleKind } from "./containerIntroExampleSources";
  import DemoCodeTabs from "./DemoCodeTabs.svelte";

  type Example = {
    label: string;
    component: Component;
  };

  type PageDataWithExamples = {
    containerIntroExampleHtml?: Partial<
      Record<ContainerIntroExampleKind, string>
    > | null;
  };

  const examples: Record<ContainerIntroExampleKind, Example> = {
    basic: {
      label: "A basic container",
      component: ContainerIntroBasicDemo,
    },
    sortable: {
      label: "A sortable container",
      component: ContainerIntroSortableDemo,
    },
    mixed: {
      label: "Items and nested containers",
      component: ContainerIntroMixedDemo,
    },
  };

  let { kind }: { kind: ContainerIntroExampleKind } = $props();
  const example = $derived(examples[kind]);
  const ExampleComponent = $derived(example.component);
  const codeHtml = $derived(
    ($page.data as PageDataWithExamples).containerIntroExampleHtml?.[kind] ??
      "",
  );
</script>

<DemoCodeTabs
  id={`container-intro-${kind}`}
  label={example.label}
  {codeHtml}
>
  {#snippet demo()}
    <ClientDemoFrame className="container-intro-demo-skeleton">
      <div
        class:basic-static={kind === "basic"}
        class="container-intro-demo-surface"
      >
        <ExampleComponent />
      </div>
    </ClientDemoFrame>
  {/snippet}
</DemoCodeTabs>

<style>
  .container-intro-demo-surface {
    min-height: 10rem;
    user-select: none;
  }

  :global(.container-intro-demo-surface .snap-engine-canvas) {
    overflow: visible !important;
  }

  :global(.container-intro-demo-surface .snap-engine-canvas > .snapsort-container) {
    gap: 0.55rem;
    width: min(100%, 25rem);
    margin: 0 auto;
  }

  :global(.container-intro-demo-surface .snapsort-item) {
    align-items: flex-start !important;
    width: 100%;
    padding: 0.7rem 0.85rem !important;
    border: 1px solid rgb(58 42 34 / 18%);
    border-radius: 8px;
    background: white;
    box-sizing: border-box;
    cursor: grab;
  }

  :global(.container-intro-demo-surface .snapsort-container .snapsort-container) {
    gap: 0.45rem;
    width: 100%;
    padding: 0.7rem;
    border: 1px dashed rgb(58 42 34 / 28%);
    border-radius: 9px;
    background: rgb(255 255 255 / 38%);
    box-sizing: border-box;
  }

  :global(.container-intro-demo-surface .snapsort-container .snapsort-container > strong) {
    margin-bottom: 0.15rem;
    font-size: 0.82rem;
  }

  .basic-static :global(.snapsort-item) {
    cursor: default;
    pointer-events: none;
  }
</style>
