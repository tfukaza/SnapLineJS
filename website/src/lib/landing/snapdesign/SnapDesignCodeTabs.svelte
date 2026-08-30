<script module lang="ts">
  export type SnapDesignCodeTab = {
    id: string;
    label: string;
    html: string;
  };
</script>

<script lang="ts">
  let {
    tabs,
    label = "Framework examples",
  }: {
    tabs: SnapDesignCodeTab[];
    label?: string;
  } = $props();

  let activeTabId = $state<string>();
  const selectedTabId = $derived(activeTabId ?? tabs[0]?.id ?? "");

  function selectTab(tabId: string, focusTarget?: HTMLButtonElement) {
    activeTabId = tabId;
    focusTarget?.focus();
  }

  function handleKeydown(event: KeyboardEvent) {
    if (!(event.currentTarget instanceof HTMLElement)) return;

    const buttons = Array.from(
      event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]'),
    );
    const currentIndex = buttons.indexOf(event.target as HTMLButtonElement);
    if (currentIndex < 0) return;

    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % buttons.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + buttons.length) % buttons.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = buttons.length - 1;
    if (nextIndex === null) return;

    event.preventDefault();
    const nextButton = buttons[nextIndex];
    selectTab(nextButton.dataset.tabId ?? "", nextButton);
  }
</script>

<div class="code-tabs">
  <div class="code-tabs-header" role="tablist" aria-label={label} tabindex="-1" onkeydown={handleKeydown}>
    {#each tabs as tab}
      <button
        type="button"
        role="tab"
        id={`snapdesign-${tab.id}-tab`}
        aria-selected={selectedTabId === tab.id}
        aria-controls={`snapdesign-${tab.id}-panel`}
        tabindex={selectedTabId === tab.id ? 0 : -1}
        data-tab-id={tab.id}
        onclick={() => selectTab(tab.id)}
      >
        {tab.label}
      </button>
    {/each}
  </div>

  {#each tabs as tab}
    <div
      class="code-tab-panel"
      id={`snapdesign-${tab.id}-panel`}
      role="tabpanel"
      aria-labelledby={`snapdesign-${tab.id}-tab`}
      hidden={selectedTabId !== tab.id}
    >
      {@html tab.html}
    </div>
  {/each}
</div>

<style lang="scss">
  .code-tabs {
    min-width: 0;
    overflow: hidden;
    border: 1px solid
      color-mix(in srgb, var(--color-background-dark) 22%, transparent);
    border-radius: var(--ui-radius);
    background: var(--color-background);
  }

  .code-tabs-header {
    display: flex;
    gap: var(--size-2);
    padding: var(--size-8);
    overflow-x: auto;
    border-bottom: 1px solid
      color-mix(in srgb, var(--color-background-dark) 18%, transparent);
    background: var(--color-background-tint);
  }

  .code-tabs-header button {
    flex: 0 0 auto;
    min-height: 34px;
    padding: var(--size-8) var(--size-12);
    border: 0;
    border-radius: calc(var(--ui-radius) - var(--size-4));
    background: transparent;
    color: var(--color-text-subtle);
    font-family: var(--font-label);
    font-size: 0.82rem;
    font-weight: 350;
    line-height: 1;
    cursor: pointer;
  }

  .code-tabs-header button:hover,
  .code-tabs-header button:focus-visible {
    color: var(--color-action);
  }

  .code-tabs-header button:focus-visible {
    outline: 2px solid var(--color-action);
    outline-offset: 1px;
  }

  .code-tabs-header button[aria-selected="true"] {
    background: var(--color-background);
    color: var(--color-action);
    box-shadow: 0 1px 3px
      color-mix(in srgb, var(--color-background-dark) 16%, transparent);
  }

  .code-tab-panel[hidden] {
    display: none;
  }

  .code-tab-panel {
    min-width: 0;
    max-height: 30rem;
    overflow: auto;
    background: var(--color-background);
  }

  .code-tab-panel :global(pre.shiki.display) {
    margin: 0;
    padding: 0;
    overflow: hidden;
    border: 0;
    border-radius: 0;
    background: var(--color-background) !important;
    box-shadow: none;
  }

  .code-tab-panel :global(pre.shiki.display::before),
  .code-tab-panel :global(pre.shiki.display::after) {
    display: none;
  }

  .code-tab-panel :global(pre.shiki.display code) {
    display: block;
    box-sizing: border-box;
    padding: var(--size-16) 0;
    overflow-x: auto;
    background: transparent !important;
    line-height: 1.6;
  }

  .code-tab-panel :global(.line::before) {
    content: attr(data-line);
    display: inline-block;
    width: 3ch;
    margin-right: var(--size-16);
    padding: 0 var(--size-12);
    border-right: 1px solid #d7d7d7;
    color: var(--color-text-subtle);
    font-variant-numeric: tabular-nums;
    text-align: right;
    user-select: none;
  }
</style>
