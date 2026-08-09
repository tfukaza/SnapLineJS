<script lang="ts">
  import type { Snippet } from "svelte";

  type View = "demo" | "code";

  let {
    id,
    label,
    codeHtml,
    demo,
  }: {
    id: string;
    label: string;
    codeHtml: string;
    demo: Snippet;
  } = $props();

  let activeView: View = $state("demo");
  let demoTab: HTMLButtonElement;
  let codeTab: HTMLButtonElement;

  const tabId = (view: View) => `${id}-${view}-tab`;
  const panelId = (view: View) => `${id}-${view}-panel`;

  function select(view: View, focus = false) {
    activeView = view;
    if (focus) {
      (view === "demo" ? demoTab : codeTab)?.focus();
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
</script>

<div class="demo-code-tabs" data-demo-code-tabs={id}>
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
        Code
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
      data-example-view="code"
    >
      {#if codeHtml}
        {@html codeHtml}
      {:else}
        <p class="code-unavailable">Code is unavailable for this example.</p>
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

  .code-unavailable {
    margin: 0;
    padding: var(--size-24);
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
