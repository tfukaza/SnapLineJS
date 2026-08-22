<script lang="ts">
  import ClientDemoFrame from "$lib/components/ClientDemoFrame.svelte";
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type { Engine as SnapEngine } from "@snap-engine/core";
  import { Container, Ghost, Handle, Item } from "@snap-engine/snapsort/svelte";
  import {
    createRenderEntries,
    createRenderTree,
    defaultAnimations,
    reduceRenderTree,
    type ContainerCallbacks,
    type GhostLifecycleEvent,
    type ItemMoveEvent,
  } from "@snap-engine/snapsort";
  import SnapSortContextBoundary from "$lib/components/SnapSortContextBoundary.svelte";

  let {
    debugLayout,
    engine = $bindable<SnapEngine | null>(null),
  }: {
    debugLayout: boolean;
    engine?: SnapEngine | null;
  } = $props();

  const title = "SnapSort";
  const gripDots = Array.from({ length: 6 }, (_, i) => i);
  let titleChars = $state.raw(
    createRenderTree(
      createRenderEntries(
        title.split("").map((char, i) => ({
          char,
          id: `snapsort-letter-${i}`,
        })),
        (entry) => entry.id,
      ),
    ),
  );

  type HeroStackEntry = "title" | "copy" | "cta";
  let heroStackEntries = $state.raw(
    createRenderTree(
      createRenderEntries<HeroStackEntry>(
        ["title", "copy", "cta"],
        (kind) => kind,
      ),
    ),
  );
  const heroStackOrder = $derived(
    heroStackEntries.entries
      .filter((entry) => !entry.isGhost)
      .map((entry) => entry.itemId)
      .join(","),
  );
  const titleOrder = $derived(
    titleChars.entries
      .filter((entry) => !entry.isGhost)
      .map((entry) => entry.itemId)
      .join(","),
  );

  function handleHeroStackMove(event: ItemMoveEvent) {
    heroStackEntries = reduceRenderTree(heroStackEntries, event);
  }

  function handleTitleMove(event: ItemMoveEvent) {
    titleChars = reduceRenderTree(titleChars, event);
  }

  function handleHeroStackGhost(event: GhostLifecycleEvent) {
    heroStackEntries = reduceRenderTree(heroStackEntries, event);
  }

  function handleTitleGhost(event: GhostLifecycleEvent) {
    titleChars = reduceRenderTree(titleChars, event);
  }

  const heroStackCallbacks = {
    onItemMove: handleHeroStackMove,
    onGhostInsert: handleHeroStackGhost,
    onGhostMove: handleHeroStackGhost,
    onGhostRemove: handleHeroStackGhost,
  } satisfies ContainerCallbacks;

  const titleCallbacks = {
    onItemMove: handleTitleMove,
    onGhostInsert: handleTitleGhost,
    onGhostMove: handleTitleGhost,
    onGhostRemove: handleTitleGhost,
  } satisfies ContainerCallbacks;
</script>

<section id="landing">
  <h1 class="visually-hidden">SnapSort</h1>
  <ClientDemoFrame>
    {#snippet fallback()}
      <div class="hero-section" aria-hidden="true">
        <div class="hero-frame">
          <div class="hero-slot">
            <div class="hero-stack snapsort-hero-skeleton">
              <div class="hero-stack-item hero-title-item">
                <div class="hero-row card">
                  <div class="title-section">
                    <span class="title-glyph title-text pixel-font">SnapSort</span>
                  </div>
                </div>
              </div>
              <div class="hero-stack-item hero-copy-item">
                <div class="hero-row card">
                  <p class="hero-statement large">
                    Unstyled drag-and-drop primitives for lists, boards, trees,
                    and custom interfaces.
                  </p>
                </div>
              </div>
              <div class="hero-stack-item hero-cta-item">
                <div class="hero-row hero-row-final card">
                  <div class="hero-cta">
                    <a class="button primary" href="/docs/snapsort/introduction/setup" tabindex="-1">Install SnapSort</a>
                    <a class="button" href="/docs/snapsort/examples" tabindex="-1">Examples</a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    {/snippet}
    <Engine id="snapsort-canvas" bind:engine debug={debugLayout}>
    <div class="hero-section">
      <div class="hero-frame">
        <div class="hero-slot slot">
          <Container
            itemId="snapsort-hero-stack-root"
            className="hero-stack"
            config={{
              animation: defaultAnimations,
              direction: "column",
              callbacks: heroStackCallbacks,
            }}
            data-snapsort-demo="hero-stack"
            data-list-id="snapsort-hero-content"
            data-order={heroStackOrder}
          >
            {#each heroStackEntries.entries as entry (entry.itemId)}
              {#if entry.isGhost}
                <Ghost ghost={entry.ghost} />
              {:else if entry.value === "title"}
                <Item itemId={entry.itemId} className="hero-stack-item hero-title-item">
                  <div class="hero-row card">
                    <Handle className="hero-row-handle">
                      <span class="hero-row-grip" aria-hidden="true">
                        {#each gripDots as dot (dot)}
                          <i></i>
                        {/each}
                      </span>
                    </Handle>
                    <div class="title-section" aria-hidden="true">
                      <SnapSortContextBoundary>
                        <Container
                          itemId="snapsort-title-root"
                          config={{
                            animation: defaultAnimations,
                            direction: "row",
                            callbacks: titleCallbacks,
                          }}
                          data-snapsort-demo="hero-title"
                          data-list-id="snapsort-title"
                          data-order={titleOrder}
                        >
                          {#each titleChars.entries as titleEntry (titleEntry.itemId)}
                            {#if titleEntry.isGhost}
                              <Ghost ghost={titleEntry.ghost} />
                            {:else}
                            <Item itemId={titleEntry.itemId} style="padding: 0; width: auto;">
                              <span id={titleEntry.itemId} class="letter-shell">
                                <span class="title-glyph title-text pixel-font">
                                  {titleEntry.value.char === " " ? "\u00A0" : titleEntry.value.char}
                                </span>
                                <span class="letter-grip" aria-hidden="true">
                                  {#each gripDots as dot (dot)}
                                    <i class="letter-grip-dot"></i>
                                  {/each}
                                </span>
                              </span>
                            </Item>
                            {/if}
                          {/each}
                        </Container>
                      </SnapSortContextBoundary>
                    </div>
                  </div>
                </Item>
              {:else if entry.value === "copy"}
                <Item itemId={entry.itemId} className="hero-stack-item hero-copy-item">
                  <div class="hero-row card">
                    <Handle className="hero-row-handle">
                      <span class="hero-row-grip" aria-hidden="true">
                        {#each gripDots as dot (dot)}
                          <i></i>
                        {/each}
                      </span>
                    </Handle>
                    <p class="hero-statement large">
                      Unstyled drag-and-drop primitives for lists, boards, trees,
                      and custom interfaces.
                    </p>
                  </div>
                </Item>
              {:else}
                <Item itemId={entry.itemId} className="hero-stack-item hero-cta-item">
                  <div class="hero-row hero-row-final card">
                    <Handle className="hero-row-handle">
                      <span class="hero-row-grip" aria-hidden="true">
                        {#each gripDots as dot (dot)}
                          <i></i>
                        {/each}
                      </span>
                    </Handle>
                    <div class="hero-cta">
                      <a class="button primary" href="/docs/snapsort/introduction/setup">Install SnapSort</a>
                      <a class="button" href="/docs/snapsort/examples">Examples</a>
                    </div>
                  </div>
                </Item>
              {/if}
            {/each}
          </Container>
        </div>
      </div>
    </div>
    </Engine>
  </ClientDemoFrame>

</section>

<style>
  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
