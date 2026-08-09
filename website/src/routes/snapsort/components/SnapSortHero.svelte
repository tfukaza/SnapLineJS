<script lang="ts">
  import ClientDemoFrame from "$lib/components/ClientDemoFrame.svelte";
  import { Engine } from "@snap-engine/asset-base/svelte";
  import type { Engine as SnapEngine } from "@snap-engine/core";
  import { Container, Handle, Item } from "@snap-engine/snapsort/svelte";
  import type { ItemMoveEvent } from "@snap-engine/snapsort";
  import SnapSortContextBoundary from "../SnapSortContextBoundary.svelte";
  import { moveEntries } from "./listState";

  let {
    debugLayout,
    engine = $bindable<SnapEngine | null>(null),
  }: {
    debugLayout: boolean;
    engine?: SnapEngine | null;
  } = $props();

  const title = "SnapSort";
  const gripDots = Array.from({ length: 6 }, (_, i) => i);
  let titleChars = $state(title.split("").map((char, i) => ({
    char,
    id: `snapsort-letter-${i}`,
  })));

  type HeroStackEntry = "title" | "copy" | "cta";
  let heroStackEntries: HeroStackEntry[] = $state(["title", "copy", "cta"]);

  function handleHeroStackMove(event: ItemMoveEvent) {
    heroStackEntries = moveEntries(heroStackEntries, event, (kind) => kind);
  }

  function handleTitleMove(event: ItemMoveEvent) {
    titleChars = moveEntries(titleChars, event, (entry) => entry.id);
  }
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
                    <a class="button primary" href="/docs/snapsort/introduction/01_setup" tabindex="-1">Install SnapSort</a>
                    <a class="button" href="/snapsort/gallery" tabindex="-1">Gallery</a>
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
            className="hero-stack"
            config={{
              direction: "column",
              callbacks: { onItemMove: handleHeroStackMove },
            }}
            items={heroStackEntries}
            getItemId={(kind) => kind}
            data-snapsort-demo="hero-stack"
            data-list-id="snapsort-hero-content"
            data-order={heroStackEntries.join(",")}
          >
            {#snippet entry(kind)}
              {#if kind === "title"}
                <Item itemId={kind} className="hero-stack-item hero-title-item">
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
                          config={{
                            direction: "row",
                            callbacks: { onItemMove: handleTitleMove },
                          }}
                          items={titleChars}
                          getItemId={(t) => t.id}
                          data-snapsort-demo="hero-title"
                          data-list-id="snapsort-title"
                          data-order={titleChars.map((entry) => entry.id).join(",")}
                        >
                          {#snippet entry(t)}
                            <Item itemId={t.id} style="padding: 0; width: auto;">
                              <span id={t.id} class="letter-shell">
                                <span class="title-glyph title-text pixel-font">
                                  {t.char === " " ? "\u00A0" : t.char}
                                </span>
                                <span class="letter-grip" aria-hidden="true">
                                  {#each gripDots as dot (dot)}
                                    <i class="letter-grip-dot"></i>
                                  {/each}
                                </span>
                              </span>
                            </Item>
                          {/snippet}
                        </Container>
                      </SnapSortContextBoundary>
                    </div>
                  </div>
                </Item>
              {:else if kind === "copy"}
                <Item itemId={kind} className="hero-stack-item hero-copy-item">
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
                <Item itemId={kind} className="hero-stack-item hero-cta-item">
                  <div class="hero-row hero-row-final card">
                    <Handle className="hero-row-handle">
                      <span class="hero-row-grip" aria-hidden="true">
                        {#each gripDots as dot (dot)}
                          <i></i>
                        {/each}
                      </span>
                    </Handle>
                    <div class="hero-cta">
                      <a class="button primary" href="/docs/snapsort/introduction/01_setup">Install SnapSort</a>
                      <a class="button" href="/snapsort/gallery">Gallery</a>
                    </div>
                  </div>
                </Item>
              {/if}
            {/snippet}
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
