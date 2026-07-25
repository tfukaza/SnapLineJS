<script lang="ts">
  import { onMount } from "svelte";
  import { installCommands } from "$lib/landing/quickStart";
  import {
    frameworkLabels,
    frameworks,
    initializeFrameworkPreference,
    selectedFramework,
    setSelectedFramework,
    type Framework,
  } from "$lib/stores/frameworkState.svelte";

  let {
    highlightedSamples,
  }: {
    // Pre-highlighted by the route loader so shiki stays out of the client
    // bundle.
    highlightedSamples: Record<Framework, string>;
  } = $props();

  const installCommand = $derived(installCommands[$selectedFramework]);
  const sampleHtml = $derived(highlightedSamples[$selectedFramework]);

  let copied = $state(false);
  let copyTimer: ReturnType<typeof setTimeout> | undefined;

  async function copyInstall() {
    try {
      await navigator.clipboard.writeText(installCommand);
      copied = true;
      clearTimeout(copyTimer);
      copyTimer = setTimeout(() => (copied = false), 2000);
    } catch {
      // Clipboard access can be denied; the command stays selectable either way.
    }
  }

  onMount(() => {
    initializeFrameworkPreference(window.location.search);
    return () => clearTimeout(copyTimer);
  });
</script>

<section class="get-started landing-section-gap">
  <div class="get-started-header">
    <h2 class="landing-section-heading">Get started</h2>
  </div>

  <div class="framework-tabs" role="group" aria-label="Choose a framework">
    {#each frameworks as framework}
      <button
        type="button"
        class="button small framework-tab"
        class:active={$selectedFramework === framework}
        aria-pressed={$selectedFramework === framework}
        onclick={() => setSelectedFramework(framework, false)}
      >
        {frameworkLabels[framework]}
      </button>
    {/each}
  </div>

  <div class="install-row">
    <code class="install-command">{installCommand}</code>
    <button type="button" class="button small copy-button" onclick={copyInstall}>
      {copied ? "Copied" : "Copy"}
    </button>
  </div>

  <div class="sample">
    {@html sampleHtml}
  </div>

  <div class="get-started-actions">
    <a
      class="button primary get-started-action"
      href="/docs/snapsort/introduction"
    >
      Read SnapSort docs
    </a>
    <a class="button get-started-action" href="/snapsort/gallery">
      View Gallery
    </a>
  </div>
</section>

<style lang="scss">
  @use "../landing.scss";

  .get-started {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--size-24);
    width: min(100%, 1200px);
    padding-inline: clamp(var(--size-16), 5vw, var(--size-64));
    box-sizing: border-box;
    margin-inline: auto;
    margin-bottom: clamp(3rem, 6vw, 6rem);
  }

  .get-started-header {
    width: min(100%, 760px);
    text-align: center;
  }

  .landing-section-heading {
    margin: 0;
  }

  .framework-tabs {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--size-8);
  }

  .install-row {
    display: flex;
    align-items: center;
    gap: var(--size-12);
    width: min(100%, 860px);
    box-sizing: border-box;
    padding: var(--size-12) var(--size-16);
    border-radius: var(--ui-radius);
    background: var(--color-background-tint);
  }

  .install-command {
    flex: 1;
    min-width: 0;
    color: var(--color-text);
    font-family: var(--font-code);
    font-size: clamp(0.78rem, 1vw, 0.92rem);
    line-height: 1.5;
    // The command is long; wrapping beats a horizontal scrollbar here.
    overflow-wrap: anywhere;
  }

  .copy-button {
    flex-shrink: 0;
    min-width: 4.5rem;
  }

  .sample {
    width: min(100%, 860px);
    max-width: 100%;

    // The markup comes from shiki, so these have to reach past Svelte scoping.
    :global(pre.display) {
      margin: 0;
      max-width: 100%;
      padding: var(--size-16);
      overflow-x: auto;
      border-radius: var(--ui-radius);
      background: var(--color-background-tint);
      color: var(--color-text);
      font-family: var(--font-code);
      font-size: clamp(0.72rem, 0.95vw, 0.85rem);
      line-height: 1.55;
      scrollbar-width: thin;
      text-align: left;
    }

    :global(pre.display code) {
      display: block;
      white-space: pre;
    }
  }

  .get-started-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: var(--size-12);
    margin-top: var(--size-8);
  }

  .get-started-action {
    gap: var(--size-4);
    text-decoration: none;
  }
</style>
