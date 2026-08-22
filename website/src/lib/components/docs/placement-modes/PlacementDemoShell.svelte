<script lang="ts">
  import ClientDemoFrame from "$lib/components/ClientDemoFrame.svelte";
  import type { Snippet } from "svelte";

  let {
    children,
    compact = false,
  }: {
    children: Snippet;
    compact?: boolean;
  } = $props();
</script>

<div class="placement-demo" class:compact>
  <ClientDemoFrame className="placement-demo-skeleton">
    {@render children()}
  </ClientDemoFrame>
</div>

<style>
  .placement-demo {
    width: min(100%, var(--doc-reading-width, 700px));
    margin: var(--size-24) auto var(--size-32);
    padding: var(--size-24);
    border-radius: var(--ui-radius);
    background: var(--color-background-tint);
    box-sizing: border-box;
    user-select: none;
  }

  .placement-demo.compact {
    width: 100%;
    margin: var(--size-12) 0 0;
    padding: var(--size-16);
  }

  :global(.placement-demo .snap-engine-canvas) {
    overflow: visible !important;
  }

  @media (max-width: 720px) {
    .placement-demo {
      padding: var(--size-16);
    }
  }
</style>
