<script lang="ts">
  import type { Component } from "svelte";
  import ClientDemoFrame from "$lib/components/ClientDemoFrame.svelte";
  import ClonePaletteExample from "./examples/ClonePaletteExample.svelte";
  import FileExplorerExample from "./examples/FileExplorerExample.svelte";
  import FormEditorExample from "./examples/FormEditorExample.svelte";
  import KanbanBoardExample from "./examples/KanbanBoardExample.svelte";
  import SentenceBuilderExample from "./examples/SentenceBuilderExample.svelte";
  import SwapGridExample from "./examples/SwapGridExample.svelte";
  import TodoListExample from "./examples/TodoListExample.svelte";
  import TrashItExample from "./examples/TrashItExample.svelte";
  import {
    snapSortExampleMetadata,
    type CompleteExampleKind,
  } from "./snapsortExampleCatalog";
  import DemoCodeTabs from "./DemoCodeTabs.svelte";

  const components = {
    "todo-list": TodoListExample,
    "kanban-board": KanbanBoardExample,
    "sentence-builder": SentenceBuilderExample,
    "file-explorer": FileExplorerExample,
    "clone-palette": ClonePaletteExample,
    "trash-it": TrashItExample,
    "swap-grid": SwapGridExample,
    "form-editor": FormEditorExample,
  } satisfies Record<CompleteExampleKind, Component>;

  let { kind }: { kind: CompleteExampleKind } = $props();
  const ExampleComponent = $derived(components[kind]);
  const label = $derived(snapSortExampleMetadata[kind].label);
</script>

<DemoCodeTabs id={kind} {label} wide>
  {#snippet demo()}
    <ClientDemoFrame className="complete-example-skeleton">
      <div class="complete-example-surface">
        <ExampleComponent />
      </div>
    </ClientDemoFrame>
  {/snippet}
</DemoCodeTabs>

<style>
  .complete-example-surface {
    width: 100%;
    min-width: 0;
  }

  :global(.complete-example-skeleton) {
    min-height: 24rem;
  }
</style>
