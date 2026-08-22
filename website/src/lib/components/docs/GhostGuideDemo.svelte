<script lang="ts">
  import ClientDemoFrame from "$lib/components/ClientDemoFrame.svelte";
  import { Engine } from "@snap-engine/asset-base/svelte";
  import {
    createRenderEntries,
    createRenderEntry,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
    type ContainerCallbacks,
    type DragStartEvent,
    type GhostLifecycleEvent,
    type GhostLocation,
    type GhostState,
    type ItemMoveEvent,
    type RenderTree,
  } from "@snap-engine/snapsort";
  import { Container, Ghost, Item } from "@snap-engine/snapsort/svelte";
  import { untrack } from "svelte";

  let { variant }: { variant: "flow" | "overlay" } = $props();

  type DemoValue = {
    id: string;
    kind: "list" | "item";
    label: string;
  };

  type LedgerEntry = {
    id: number;
    operation: GhostLifecycleEvent["operation"];
    type: GhostState["type"];
    ghostItemId: string;
    from: string;
    to: string;
  };

  const flowItem = (id: string, label: string) =>
    createRenderEntry<DemoValue>({ id, kind: "item", label }, id);

  function createFlowTree() {
    return createRenderTree<DemoValue>([
      createRenderEntry(
        { id: "ghost-flow-planned", kind: "list", label: "Planned" },
        "ghost-flow-planned",
        createRenderTree([
          flowItem("ghost-flow-outline", "Outline guide"),
          flowItem("ghost-flow-capture", "Capture examples"),
        ]),
      ),
      createRenderEntry(
        { id: "ghost-flow-published", kind: "list", label: "Published" },
        "ghost-flow-published",
        createRenderTree([
          flowItem("ghost-flow-review", "Review wording"),
          flowItem("ghost-flow-ship", "Ship docs"),
        ]),
      ),
    ]);
  }

  function createOverlayTree() {
    return createRenderTree(
      createRenderEntries<DemoValue>(
        [
          { id: "ghost-overlay-alpha", kind: "item", label: "Alpha" },
          { id: "ghost-overlay-bravo", kind: "item", label: "Bravo" },
          { id: "ghost-overlay-charlie", kind: "item", label: "Charlie" },
          { id: "ghost-overlay-delta", kind: "item", label: "Delta" },
        ],
        (item) => item.id,
      ),
    );
  }

  let tree = $state.raw(
    untrack(() => (variant === "flow" ? createFlowTree() : createOverlayTree())),
  );
  let ledger = $state.raw<readonly LedgerEntry[]>([]);
  let nextLedgerId = 0;

  function describeLocation(location: GhostLocation): string {
    const containerId = location.container.itemId;
    return location.type === "slot"
      ? `${containerId} · ${location.index}`
      : `${containerId} · overlay`;
  }

  function recordGhostEvent(event: GhostLifecycleEvent) {
    const entry: LedgerEntry = {
      id: nextLedgerId,
      operation: event.operation,
      type: event.ghost.type,
      ghostItemId: event.ghost.ghostItemId,
      from:
        event.operation === "insert" ? "—" : describeLocation(event.from),
      to: event.operation === "remove" ? "—" : describeLocation(event.to),
    };
    nextLedgerId += 1;
    ledger = [entry, ...ledger].slice(0, 20);
  }

  function collectGhosts(
    renderTree: RenderTree<DemoValue>,
    ghosts: GhostState[] = [],
  ): GhostState[] {
    for (const entry of renderTree.entries) {
      if (entry.isGhost) {
        ghosts.push(entry.ghost);
      } else if (entry.childTree) {
        collectGhosts(entry.childTree, ghosts);
      }
    }
    return ghosts;
  }

  function onItemMove(event: ItemMoveEvent) {
    tree = reduceRenderTree(tree, event);
  }

  function onGhostEvent(event: GhostLifecycleEvent) {
    tree = reduceRenderTree(tree, event);
    recordGhostEvent(event);
  }

  function onDragStart(event: DragStartEvent) {
    event.session.dragVisual = variant === "flow" ? "preview" : "item";
  }

  const callbacks = {
    onItemMove,
    onGhostInsert: onGhostEvent,
    onGhostMove: onGhostEvent,
    onGhostRemove: onGhostEvent,
    onDragStart,
  } satisfies ContainerCallbacks;

  const insertionMarker = {
    thickness: 4,
    startInset: 8,
    endInset: 8,
  };

  const activeGhosts = $derived(collectGhosts(tree));
  const testHook = $derived(
    variant === "flow" ? "flow-lifecycle" : "overlay-channels",
  );
</script>

<div class="ghost-guide-demo" data-ghost-demo={testHook}>
  <ClientDemoFrame className="ghost-guide-skeleton">
    <Engine id={`ghost-guide-${variant}`}>
      <div class="demo-layout">
        <section class="stage" aria-label={`${variant} ghost demonstration`}>
          {#if variant === "flow"}
            <Container
              itemId="ghost-flow-root"
              className="flow-board"
              config={{
                animation: defaultAnimations,
                callbacks,
                direction: "row",
                mode: "progressive",
              }}
            >
              {#each tree.entries as entry (entry.itemId)}
                {#if entry.isGhost}
                  <Ghost
                    ghost={entry.ghost}
                    className={`guide-ghost is-${entry.ghost.type}`}
                  >
                    <span>{entry.ghost.type}</span>
                  </Ghost>
                {:else if entry.childTree}
                  <Container
                    itemId={entry.itemId}
                    data-demo-list={entry.itemId}
                    className="flow-list"
                    metadata={{ label: entry.value.label }}
                    config={{
                      animation: defaultAnimations,
                      direction: "column",
                      mode: "progressive",
                      stretchItems: true,
                      wrap: "nowrap",
                    }}
                  >
                    <header>{entry.value.label}</header>
                    {#each entry.childTree.entries as child (child.itemId)}
                      {#if child.isGhost}
                        <Ghost
                          ghost={child.ghost}
                          className={`guide-ghost is-${child.ghost.type}`}
                        >
                          <span>{child.ghost.type}</span>
                        </Ghost>
                      {:else if child.childTree}
                        <Container itemId={child.itemId} />
                      {:else}
                        <Item
                          itemId={child.itemId}
                          data-demo-item={child.itemId}
                          metadata={{ label: child.value.label }}
                          className="guide-item"
                        >
                          <span>{child.value.label}</span>
                        </Item>
                      {/if}
                    {/each}
                  </Container>
                {:else}
                  <Item
                    itemId={entry.itemId}
                    data-demo-item={entry.itemId}
                    className="guide-item"
                  >
                    <span>{entry.value.label}</span>
                  </Item>
                {/if}
              {/each}
            </Container>
          {:else}
            <Container
              itemId="ghost-overlay-root"
              className="overlay-list"
              config={{
                animation: defaultAnimations,
                callbacks,
                direction: "column",
                mode: "insertion",
                stretchItems: true,
                wrap: "nowrap",
              }}
            >
              {#each tree.entries as entry (entry.itemId)}
                {#if entry.isGhost}
                  <Ghost
                    ghost={entry.ghost}
                    {insertionMarker}
                    className={`guide-ghost is-${entry.ghost.type}`}
                  >
                    <span>{entry.ghost.type}</span>
                  </Ghost>
                {:else if entry.childTree}
                  <Container itemId={entry.itemId} />
                {:else}
                  <Item
                    itemId={entry.itemId}
                    data-demo-item={entry.itemId}
                    metadata={{ label: entry.value.label }}
                    className="guide-item"
                  >
                    <span>{entry.value.label}</span>
                  </Item>
                {/if}
              {/each}
            </Container>
          {/if}
          <p class="hint">
            {variant === "flow"
              ? "Drag a task between lists to see target placement and the pointer preview."
              : "Drag a row to see its source spacer and insertion marker together."}
          </p>
        </section>

        <aside class="instrument-panel" aria-label="Ghost lifecycle state">
          <section class="active-panel">
            <h3>Active ghosts</h3>
            {#if activeGhosts.length === 0}
              <p class="empty">None — cleanup complete</p>
            {:else}
              <ul>
                {#each activeGhosts as ghost (ghost.ghostItemId)}
                  <li>
                    <strong>{ghost.type}</strong>
                    <code>{ghost.ghostItemId}</code>
                  </li>
                {/each}
              </ul>
            {/if}
          </section>

          <section class="ledger-panel">
            <h3>Lifecycle ledger</h3>
            {#if ledger.length === 0}
              <p class="empty-ledger">Start a drag to record events.</p>
            {:else}
              <ol class="ledger-list">
                {#each ledger as event (event.id)}
                  <li
                    class="ledger-event"
                    data-ghost-event={event.operation}
                    data-ghost-type={event.type}
                  >
                    <div class="event-summary">
                      <span class={`operation is-${event.operation}`}>
                        {event.operation}
                      </span>
                      <strong>{event.type}</strong>
                      <code>{event.ghostItemId}</code>
                    </div>
                    <dl class="event-locations">
                      <div>
                        <dt>from</dt>
                        <dd>{event.from}</dd>
                      </div>
                      <div>
                        <dt>to</dt>
                        <dd>{event.to}</dd>
                      </div>
                    </dl>
                  </li>
                {/each}
              </ol>
            {/if}
          </section>
        </aside>
      </div>
    </Engine>
  </ClientDemoFrame>
</div>

<style>
  .ghost-guide-demo {
    width: min(100%, 64rem);
    margin: var(--size-24) auto var(--size-32);
    padding: var(--size-16);
    border: 1px solid color-mix(in srgb, var(--color-foreground) 10%, transparent);
    border-radius: var(--ui-radius);
    background: var(--color-background-tint);
    box-sizing: border-box;
    user-select: none;
  }

  .demo-layout {
    display: grid;
    grid-template-columns: minmax(17rem, 0.9fr) minmax(22rem, 1.1fr);
    gap: var(--size-16);
  }

  .stage,
  .instrument-panel section {
    min-width: 0;
    border: 1px solid color-mix(in srgb, var(--color-foreground) 10%, transparent);
    border-radius: var(--size-8);
    background: var(--color-background);
    box-sizing: border-box;
  }

  .stage {
    min-height: 18rem;
    padding: var(--size-16);
  }

  :global(.ghost-guide-demo .snap-engine-canvas) {
    overflow: visible !important;
  }

  :global(.flow-board) {
    display: grid !important;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--size-12);
  }

  :global(.flow-list),
  :global(.overlay-list) {
    gap: var(--size-8);
    padding: var(--size-12);
    border: 1px solid color-mix(in srgb, var(--color-foreground) 12%, transparent);
    border-radius: var(--size-8);
    background: color-mix(in srgb, var(--color-background-tint) 72%, var(--color-background));
    box-sizing: border-box;
  }

  :global(.flow-list) {
    min-width: 0;
    min-height: 13rem;
  }

  :global(.flow-list header) {
    padding: 0 var(--size-4) var(--size-4);
    color: var(--color-foreground-muted);
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.75rem;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  :global(.overlay-list) {
    width: min(100%, 21rem);
    min-height: 16rem;
    margin: 0 auto;
  }

  :global(.guide-item) {
    width: 100% !important;
    min-height: 2.75rem;
    padding: var(--size-8) var(--size-12);
    border: 1px solid color-mix(in srgb, var(--color-foreground) 13%, transparent);
    border-radius: var(--size-4);
    background: var(--color-background);
    box-shadow: 0 2px 7px color-mix(in srgb, var(--color-foreground) 8%, transparent);
    color: var(--color-foreground);
    cursor: grab;
  }

  :global(.guide-item[data-snapsort-dragging="true"]) {
    opacity: 0.88 !important;
  }

  :global(.guide-ghost.is-source-spacer),
  :global(.guide-ghost.is-target-spacer) {
    display: grid;
    place-items: center;
    border: 2px dashed currentColor;
    border-radius: var(--size-4);
    box-sizing: border-box;
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.65rem;
    letter-spacing: 0.025em;
    opacity: 1;
  }

  :global(.guide-ghost.is-source-spacer) {
    background: color-mix(in srgb, var(--color-foreground) 5%, transparent);
    color: var(--color-foreground-muted);
  }

  :global(.guide-ghost.is-target-spacer) {
    background: color-mix(in srgb, var(--color-primary) 12%, var(--color-background));
    color: var(--color-primary);
  }

  :global(.guide-ghost.is-pointer-preview) {
    display: grid;
    place-items: center;
    border: 1px solid color-mix(in srgb, var(--color-primary) 64%, transparent);
    border-radius: var(--size-8);
    background: color-mix(in srgb, var(--color-primary) 14%, var(--color-background));
    box-shadow: 0 10px 24px color-mix(in srgb, var(--color-foreground) 18%, transparent);
    color: var(--color-primary);
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.7rem;
  }

  :global(.guide-ghost.is-insertion-marker) {
    overflow: visible;
    color: var(--color-primary) !important;
  }

  :global(.guide-ghost.is-insertion-marker span) {
    position: absolute;
    right: 0;
    bottom: calc(100% + var(--size-4));
    padding: 0.1rem 0.35rem;
    border-radius: 999px;
    background: var(--color-primary);
    color: var(--color-background);
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.6rem;
    white-space: nowrap;
  }

  .hint {
    margin: var(--size-12) 0 0;
    color: var(--color-foreground-muted);
    font-size: 0.78rem;
    line-height: 1.45;
    text-align: center;
  }

  .instrument-panel {
    display: grid;
    align-content: start;
    gap: var(--size-12);
    min-width: 0;
  }

  .instrument-panel section {
    padding: var(--size-12);
  }

  .instrument-panel h3 {
    margin: 0 0 var(--size-8);
    color: var(--color-foreground);
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.76rem;
    font-weight: 500;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .active-panel ul {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-8);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .active-panel li {
    display: grid;
    gap: 0.15rem;
    min-width: 8rem;
    padding: var(--size-8);
    border-radius: var(--size-4);
    background: color-mix(in srgb, var(--color-primary) 8%, var(--color-background-tint));
    font-size: 0.72rem;
  }

  .active-panel strong {
    color: var(--color-primary);
  }

  .active-panel code,
  .ledger-panel code {
    font-size: 0.68rem;
  }

  .empty {
    margin: 0;
    color: var(--color-foreground-muted);
    font-size: 0.78rem;
  }

  .ledger-list {
    display: grid;
    gap: var(--size-8);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .ledger-event {
    display: grid;
    gap: var(--size-8);
    padding: var(--size-8);
    border-radius: var(--size-4);
    background: var(--color-background-tint);
    font-size: 0.68rem;
  }

  .event-summary {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: var(--size-8);
  }

  .event-summary strong {
    overflow-wrap: anywhere;
    color: var(--color-foreground);
  }

  .event-summary code {
    color: var(--color-foreground-muted);
  }

  .event-locations {
    display: grid;
    gap: var(--size-4);
    margin: 0;
  }

  .event-locations div {
    display: grid;
    grid-template-columns: 2.25rem minmax(0, 1fr);
    gap: var(--size-4);
  }

  .event-locations dt,
  .event-locations dd {
    margin: 0;
  }

  .event-locations dt {
    color: var(--color-foreground-muted);
    font-family: "Bitcount Grid Single", monospace;
  }

  .event-locations dd {
    overflow-wrap: anywhere;
  }

  .operation {
    display: inline-block;
    padding: 0.1rem 0.3rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--color-primary) 10%, transparent);
    color: var(--color-primary);
    font-weight: 650;
  }

  .operation.is-remove {
    background: color-mix(in srgb, var(--color-foreground) 8%, transparent);
    color: var(--color-foreground-muted);
  }

  .empty-ledger {
    display: grid;
    min-height: 4rem;
    margin: 0;
    place-items: center;
    color: var(--color-foreground-muted);
    font-size: 0.72rem;
    text-align: center;
  }

  @media (max-width: 800px) {
    .demo-layout {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 520px) {
    .ghost-guide-demo,
    .stage {
      padding: var(--size-12);
    }

    :global(.flow-board) {
      grid-template-columns: 1fr;
    }

    :global(.flow-list) {
      min-height: 9rem;
    }
  }
</style>
