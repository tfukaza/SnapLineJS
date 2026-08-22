<script module lang="ts">
  const sourceCache = new Map<string, string>();
</script>

<script lang="ts">
  import { onDestroy, type Snippet } from "svelte";
  import type { SnapSortExampleId } from "./snapsortExampleCatalog";

  type View = "demo" | "code";
  type SourceStatus = "idle" | "loading" | "ready" | "error";

  let {
    id,
    label,
    wide = false,
    demo,
  }: {
    id: SnapSortExampleId;
    label: string;
    wide?: boolean;
    demo: Snippet;
  } = $props();

  let activeView: View = $state("demo");
  let sourceStatus: SourceStatus = $state("idle");
  let codeHtml = $state("");
  let activeRequest: AbortController | null = null;
  let demoTab: HTMLButtonElement | null = $state(null);
  let codeTab: HTMLButtonElement | null = $state(null);

  const tabId = (view: View) => `${id}-${view}-tab`;
  const panelId = (view: View) => `${id}-${view}-panel`;

  async function loadSource() {
    if (sourceStatus === "loading" || sourceStatus === "ready") return;

    const cached = sourceCache.get(id);
    if (cached !== undefined) {
      codeHtml = cached;
      sourceStatus = "ready";
      return;
    }

    const request = new AbortController();
    activeRequest = request;
    sourceStatus = "loading";

    try {
      const response = await fetch(
        `/docs/snapsort/examples/source/${encodeURIComponent(id)}`,
        { signal: request.signal },
      );
      if (!response.ok) {
        throw new Error(`Example source request failed with ${response.status}.`);
      }

      const html = await response.text();
      if (request.signal.aborted) return;

      sourceCache.set(id, html);
      codeHtml = html;
      sourceStatus = "ready";
    } catch {
      if (!request.signal.aborted) sourceStatus = "error";
    } finally {
      if (activeRequest === request) activeRequest = null;
    }
  }

  function select(view: View, focus = false) {
    activeView = view;
    if (view === "code") void loadSource();
    if (focus) {
      const selectedTab = view === "demo" ? demoTab : codeTab;
      selectedTab?.focus();
    }
  }

  function handleKeydown(event: KeyboardEvent) {
    let next: View | null = null;
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      next = activeView === "demo" ? "code" : "demo";
    } else if (event.key === "Home") {
      next = "demo";
    } else if (event.key === "End") {
      next = "code";
    }

    if (!next) return;
    event.preventDefault();
    select(next, true);
  }

  onDestroy(() => activeRequest?.abort());
</script>

<div class:wide class="demo-code-tabs" data-demo-code-tabs={id}>
  <div class="demo-code-tabs-header">
    <span class="demo-code-tabs-label">{label}</span>
    <div
      class="demo-code-tabs-list"
      role="tablist"
      aria-label={`${label} example view`}
      tabindex="-1"
      onkeydown={handleKeydown}
    >
      <button
        bind:this={demoTab}
        id={tabId("demo")}
        type="button"
        role="tab"
        aria-selected={activeView === "demo"}
        aria-controls={panelId("demo")}
        tabindex={activeView === "demo" ? 0 : -1}
        onclick={() => select("demo")}
      >
        Demo
      </button>
      <button
        bind:this={codeTab}
        id={tabId("code")}
        type="button"
        role="tab"
        aria-selected={activeView === "code"}
        aria-controls={panelId("code")}
        tabindex={activeView === "code" ? 0 : -1}
        onclick={() => select("code")}
      >
        Svelte source
      </button>
    </div>
  </div>

  {#if activeView === "demo"}
    <div
      id={panelId("demo")}
      class="demo-code-tabs-panel demo-panel"
      role="tabpanel"
      aria-labelledby={tabId("demo")}
      data-example-view="demo"
    >
      {@render demo()}
    </div>
  {:else}
    <div
      id={panelId("code")}
      class="demo-code-tabs-panel code-panel"
      role="tabpanel"
      aria-labelledby={tabId("code")}
      aria-busy={sourceStatus === "loading"}
      data-example-view="code"
    >
      {#if sourceStatus === "ready"}
        {@html codeHtml}
      {:else if sourceStatus === "error"}
        <div class="source-message" role="alert">
          <p>Could not load the Svelte source.</p>
          <button type="button" onclick={() => void loadSource()}>Retry</button>
        </div>
      {:else}
        <p class="source-message" aria-live="polite">Loading Svelte source…</p>
      {/if}
    </div>
  {/if}
</div>

<style lang="scss">
  .demo-code-tabs {
    width: min(100%, var(--doc-reading-width, 700px));
    margin: var(--size-24) 0 var(--size-40, var(--size-48));
    overflow: hidden;
    border: 1px solid color-mix(in srgb, var(--color-background-dark) 18%, transparent);
    border-radius: var(--ui-radius);
    background: var(--color-background-tint);
    box-sizing: border-box;
  }

  .demo-code-tabs.wide {
    width: 100%;
    max-width: none;
  }

  .demo-code-tabs-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: var(--size-12);
    min-height: 3rem;
    padding: var(--size-8) var(--size-12) var(--size-8) var(--size-16);
    border-bottom: 1px solid color-mix(in srgb, var(--color-background-dark) 16%, transparent);
    background: color-mix(in srgb, var(--color-background) 82%, var(--color-background-tint));
  }

  .demo-code-tabs-label {
    color: var(--color-background-dark);
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.82rem;
    font-weight: 350;
  }

  .demo-code-tabs-list {
    display: inline-flex;
    gap: var(--size-2);
    padding: var(--size-2);
    border-radius: calc(var(--ui-radius) - var(--size-4));
    background: color-mix(in srgb, var(--color-background-dark) 8%, transparent);

    button {
      min-width: 4rem;
      min-height: 2rem;
      padding: var(--size-4) var(--size-12);
      border: 0;
      border-radius: calc(var(--ui-radius) - var(--size-6, 6px));
      background: transparent;
      color: var(--color-text);
      font: inherit;
      font-size: 0.82rem;
      font-weight: 500;
      cursor: pointer;

      &[aria-selected="true"] {
        background: var(--color-background);
        color: var(--color-action);
        box-shadow: 0 1px 3px color-mix(in srgb, var(--color-background-dark) 14%, transparent);
      }

      &:focus-visible {
        outline: 2px solid var(--color-action);
        outline-offset: 2px;
      }
    }
  }

  .demo-code-tabs-panel {
    min-width: 0;
  }

  .demo-panel {
    min-height: 15rem;
    padding: var(--size-24);
    box-sizing: border-box;
  }

  .code-panel {
    max-height: 34rem;
    overflow: auto;
    background: var(--color-background);

    :global(pre.shiki.display) {
      margin: 0 !important;
      max-width: none !important;
      border-radius: 0 !important;
      border: 0 !important;
    }
  }

  .source-message {
    margin: 0;
    padding: var(--size-24);

    p {
      margin: 0 0 var(--size-12);
    }

    button {
      min-height: 2rem;
      padding: var(--size-4) var(--size-12);
      border: 1px solid var(--color-action);
      border-radius: calc(var(--ui-radius) - var(--size-6, 6px));
      background: var(--color-background);
      color: var(--color-action);
      font: inherit;
      cursor: pointer;

      &:focus-visible {
        outline: 2px solid var(--color-action);
        outline-offset: 2px;
      }
    }
  }

  @media (max-width: 520px) {
    .demo-code-tabs-header {
      align-items: flex-start;
      flex-direction: column;
    }

    .demo-code-tabs-list {
      width: 100%;

      button {
        flex: 1;
      }
    }

    .demo-panel {
      padding: var(--size-16);
    }
  }
</style>
