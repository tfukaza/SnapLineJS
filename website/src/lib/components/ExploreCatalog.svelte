<script lang="ts">
  import {
    exploreEntries,
    exploreSecondaryLinkLabels,
    getExploreActionLabel,
    isExploreEntryBrowsable,
    type ExploreCatalogEntry,
  } from "$lib/exploreCatalog";

  let {
    entries = exploreEntries,
    compact = false,
    ariaLabel = "SnapEngine assets",
  }: {
    entries?: readonly ExploreCatalogEntry[];
    compact?: boolean;
    ariaLabel?: string;
  } = $props();
</script>

<ul class="catalog-grid" class:compact aria-label={ariaLabel}>
  {#each entries as entry (entry.slug)}
    <li>
      <article
        class="catalog-card"
        class:interactive={isExploreEntryBrowsable(entry)}
        class:snapsort-card={entry.motif === "sort"}
        data-status={entry.status}
        style={`--catalog-accent: ${entry.accent};`}
      >
        <div class="catalog-visual" aria-hidden="true">
          {#if entry.motif === "sort"}
            <div class="snapsort-preview-window">
              <div class="snapsort-preview-scale">
                <div class="snapsort-preview-mosaic">
                  <div class="swap-demo-preview">
                    <header>
                      <span class="placeholder-line placeholder-line-title"></span>
                      <span class="placeholder-line placeholder-line-short"></span>
                    </header>
                    <div class="swap-grid">
                      <i class="swap-tile swap-tile-primary"></i>
                      <i class="swap-tile"></i>
                      <i class="swap-tile"></i>
                      <i class="swap-tile swap-tile-accent"></i>
                    </div>
                  </div>

                  <div class="kanban-demo-preview">
                    <header>
                      <span class="placeholder-line placeholder-line-title"></span>
                      <span class="placeholder-line placeholder-line-short"></span>
                    </header>
                    <div class="kanban-columns">
                      <div>
                        <span class="placeholder-line placeholder-line-label"></span>
                        <i>
                          <span class="placeholder-line placeholder-line-card"></span>
                          <span class="placeholder-pill"></span>
                        </i>
                        <i>
                          <span class="placeholder-line placeholder-line-card-short"></span>
                          <span class="placeholder-pill"></span>
                        </i>
                      </div>
                      <div>
                        <span class="placeholder-line placeholder-line-label"></span>
                        <i>
                          <span class="placeholder-line placeholder-line-card"></span>
                          <span class="placeholder-pill"></span>
                        </i>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          {:else if entry.motif === "nodes"}
            <div class="nodes-mockup">
              <svg viewBox="0 0 320 128" preserveAspectRatio="none">
                <path d="M87 37 C132 37 129 92 177 92"></path>
                <path d="M224 92 C257 92 247 42 276 42"></path>
              </svg>
              <div class="mock-node node-input"><small>Input</small><span>Pointer</span><i></i></div>
              <div class="mock-node node-map"><small>Transform</small><span>Map value</span><i></i></div>
              <div class="mock-node node-output"><small>Output</small><span>Position</span><i></i></div>
            </div>
          {:else}
            <div class="zap-mockup">
              <div class="zap-toolbar"><i>−</i><span>100%</span><i>+</i></div>
              <div class="zap-canvas-grid"></div>
              <div class="zap-window">
                <div class="zap-window-bar"><i></i><i></i><i></i></div>
                <span>Zoomable canvas</span>
              </div>
              <div class="zap-cursor">↗</div>
            </div>
          {/if}
        </div>

        <div class="catalog-copy">
          <h3>{entry.name}</h3>
          {#if entry.tagline}
            <p class="catalog-tagline">{entry.tagline}</p>
          {/if}
          <p class="catalog-summary">{entry.summary}</p>
        </div>

        {#if isExploreEntryBrowsable(entry) || entry.status === "coming-soon" || (!compact && (entry.docsHref || entry.galleryHref))}
          <div class="catalog-actions">
            {#if isExploreEntryBrowsable(entry)}
              <a class="button primary catalog-primary-link" href={entry.href}>
                <span>{getExploreActionLabel(entry)}</span>
                <span class="link-arrow" aria-hidden="true">→</span>
              </a>
            {:else if entry.status === "coming-soon"}
              <span class="button catalog-coming-soon">Coming soon</span>
            {/if}

            {#if !compact && (entry.docsHref || entry.galleryHref)}
              <div class="catalog-secondary-links" aria-label={`${entry.name} resources`}>
                {#if entry.galleryHref}
                  <a href={entry.galleryHref}>
                    {exploreSecondaryLinkLabels.gallery}
                  </a>
                {/if}
                {#if entry.docsHref}
                  <a href={entry.docsHref}>
                    {exploreSecondaryLinkLabels.docs}
                  </a>
                {/if}
              </div>
            {/if}
          </div>
        {/if}
      </article>
    </li>
  {/each}
</ul>

<style lang="scss">
  .catalog-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 17rem), 1fr));
    grid-auto-rows: 1fr;
    gap: clamp(var(--size-16), 2.5vw, var(--size-32));
    width: 100%;
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .catalog-grid > li {
    display: flex;
    min-width: 0;
    margin: 0;
  }

  .catalog-card {
    --catalog-card-padding: clamp(var(--size-24), 3vw, var(--size-32));

    display: flex;
    flex: 1 1 auto;
    flex-direction: column;
    min-width: 0;
    min-height: 30rem;
    padding: var(--catalog-card-padding);
    overflow: hidden;
    border: 0;
    border-radius: var(--size-12);
    background: var(--color-background-tint);
    box-sizing: border-box;
    transition: transform 180ms ease;
  }

  .catalog-card > * {
    position: relative;
    z-index: 2;
  }

  .catalog-card.interactive:hover,
  .catalog-card.interactive:focus-within {
    transform: translateY(-2px);
  }

  .catalog-card[data-status="in-development"],
  .catalog-card[data-status="coming-soon"] {
    background: var(--color-background-tint);
  }

  .catalog-visual {
    position: relative;
    height: 10rem;
    margin-bottom: var(--size-32);
    border-radius: var(--size-12);
    background: color-mix(in srgb, var(--color-background) 72%, var(--catalog-accent) 4%);
    border: 1px solid color-mix(in srgb, var(--color-background-dark) 14%, transparent);
    overflow: hidden;
    box-sizing: border-box;
  }

  .snapsort-preview-window {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: var(--color-background-tint);
    pointer-events: none;
    user-select: none;
  }

  .snapsort-preview-window::before {
    position: absolute;
    top: 0;
    right: 0;
    left: 0;
    z-index: 4;
    height: 96px;
    background: linear-gradient(
      to bottom,
      var(--color-background-tint) 5%,
      color-mix(in srgb, var(--color-background-tint) 82%, transparent) 54%,
      transparent 100%
    );
    content: "";
  }

  .snapsort-preview-window::after {
    position: absolute;
    inset: 0;
    z-index: 5;
    box-shadow: inset 0 0 var(--size-24) var(--size-12) var(--color-background-tint);
    content: "";
  }

  .snapsort-preview-scale {
    position: absolute;
    top: 0;
    left: 50%;
    width: 1084px;
    filter: grayscale(1) saturate(0.15) contrast(0.94);
    transform: translateX(-50%) scale(0.5);
    transform-origin: top center;
  }

  .snapsort-preview-mosaic {
    display: grid;
    grid-template-columns: 340px 712px;
    gap: 32px;
    width: 1084px;
  }

  .swap-demo-preview,
  .kanban-demo-preview {
    min-width: 0;
    min-height: 380px;
    padding: 32px;
    border-radius: var(--ui-radius);
    background: var(--color-background);
    box-sizing: border-box;
  }

  .swap-demo-preview header,
  .kanban-demo-preview header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 20px;
  }

  .placeholder-line,
  .placeholder-pill {
    display: block;
    border-radius: 999px;
    background: #aeb4b6;
  }

  .placeholder-line-title {
    width: 96px;
    height: 10px;
    background: #747b7e;
  }

  .placeholder-line-short {
    width: 44px;
    height: 8px;
  }

  .placeholder-line-label {
    width: 58px;
    height: 7px;
    margin: 2px 0 12px;
  }

  .placeholder-line-card {
    width: 70%;
    height: 7px;
    background: #858c8f;
  }

  .placeholder-line-card-short {
    width: 52%;
    height: 7px;
    background: #858c8f;
  }

  .placeholder-pill {
    flex: 0 0 auto;
    width: 24px;
    height: 10px;
    background: color-mix(in srgb, var(--catalog-accent) 38%, #d7dadb);
  }

  .swap-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .swap-tile {
    display: grid;
    height: 128px;
    border-radius: 10px;
    background: #e5e8e9;
    color: #747a7d;
    font-size: 0.58rem;
    font-style: normal;
    font-weight: 700;
    place-items: center;
  }

  .swap-tile-primary {
    background: var(--catalog-accent);
    color: white;
    box-shadow: 0 3px 7px color-mix(in srgb, var(--catalog-accent) 28%, transparent);
    transform: translate(8px, 8px);
  }

  .swap-tile-accent {
    background: color-mix(in srgb, var(--catalog-accent) 20%, #e5e8e9);
    color: color-mix(in srgb, var(--catalog-accent) 65%, #444);
  }

  .kanban-columns {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .kanban-columns > div {
    min-width: 0;
    min-height: 286px;
    padding: 18px;
    border-radius: 12px;
    background: rgb(31 30 41 / 4%);
  }

  .kanban-columns i {
    display: flex;
    min-width: 0;
    margin-top: 14px;
    padding: 18px;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    border-radius: 8px;
    background: white;
    box-shadow: 0 1px 3px rgb(31 30 41 / 7%);
    font-style: normal;
  }

  .snapsort-card .catalog-visual {
    order: 3;
    width: calc(100% + var(--catalog-card-padding) * 2);
    height: 20rem;
    margin:
      var(--size-16)
      calc(var(--catalog-card-padding) * -1)
      calc(var(--catalog-card-padding) * -1);
    border: 0;
    border-radius: 0 0 var(--size-12) var(--size-12);
  }

  .snapsort-card .catalog-copy {
    order: 1;
  }

  .snapsort-card .catalog-actions {
    order: 2;
  }

  .nodes-mockup {
    position: absolute;
    inset: 0;
    background-image:
      linear-gradient(rgb(31 30 41 / 5%) 1px, transparent 1px),
      linear-gradient(90deg, rgb(31 30 41 / 5%) 1px, transparent 1px);
    background-size: var(--size-16) var(--size-16);
  }

  .nodes-mockup svg {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    fill: none;
    stroke: color-mix(in srgb, var(--catalog-accent) 68%, #798084);
    stroke-width: 2;
  }

  .mock-node {
    position: absolute;
    z-index: 2;
    display: flex;
    width: 4.6rem;
    padding: var(--size-8);
    flex-direction: column;
    gap: 2px;
    border: 1px solid color-mix(in srgb, var(--catalog-accent) 28%, #d5d9da);
    border-radius: var(--size-4);
    background: #fff;
    box-shadow: 0 2px 6px rgb(31 30 41 / 9%);
    color: #414648;
    box-sizing: border-box;
  }

  .mock-node small {
    color: #8a9093;
    font-size: 0.45rem;
    text-transform: uppercase;
  }

  .mock-node span {
    font-size: 0.58rem;
    font-weight: 650;
  }

  .mock-node i {
    position: absolute;
    top: 50%;
    right: -4px;
    width: 6px;
    height: 6px;
    border: 1px solid white;
    border-radius: 50%;
    background: var(--catalog-accent);
    transform: translateY(-50%);
  }

  .node-input {
    top: var(--size-16);
    left: var(--size-12);
  }

  .node-map {
    bottom: var(--size-12);
    left: 43%;
  }

  .node-output {
    top: var(--size-20);
    right: var(--size-12);
  }

  .zap-mockup {
    position: absolute;
    inset: 0;
    overflow: hidden;
    background: #f8f9f9;
  }

  .zap-canvas-grid {
    position: absolute;
    inset: 0;
    background-image: radial-gradient(#c8cdcf 0.75px, transparent 0.75px);
    background-size: var(--size-12) var(--size-12);
  }

  .zap-toolbar {
    position: absolute;
    top: var(--size-8);
    left: var(--size-8);
    z-index: 3;
    display: flex;
    align-items: center;
    border: 1px solid #d9ddde;
    border-radius: var(--size-4);
    background: white;
    box-shadow: 0 2px 5px rgb(31 30 41 / 8%);
    overflow: hidden;
  }

  .zap-toolbar > * {
    display: grid;
    height: var(--size-24);
    margin: 0;
    padding: 0 var(--size-8);
    border: 0;
    border-right: 1px solid #e1e4e5;
    background: white;
    color: #5d6265;
    font: inherit;
    font-size: 0.55rem;
    font-style: normal;
    place-items: center;
  }

  .zap-toolbar > *:last-child {
    border-right: 0;
  }

  .zap-window {
    position: absolute;
    top: 38%;
    left: 45%;
    z-index: 2;
    width: 7rem;
    height: 3.8rem;
    border: 1px solid #d6dadb;
    border-radius: var(--size-4);
    background: white;
    box-shadow: 0 4px 10px rgb(31 30 41 / 10%);
    transform: translate(-50%, -50%) rotate(-3deg);
  }

  .zap-window-bar {
    display: flex;
    gap: 3px;
    padding: 5px;
    border-bottom: 1px solid #e7e9ea;
  }

  .zap-window-bar i {
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: #c8cdcf;
  }

  .zap-window > span {
    display: block;
    padding: var(--size-8);
    color: #666c6f;
    font-size: 0.58rem;
  }

  .zap-cursor {
    position: absolute;
    right: 20%;
    bottom: 16%;
    z-index: 3;
    color: color-mix(in srgb, var(--catalog-accent) 72%, #343839);
    font-size: 1.2rem;
    font-weight: 700;
  }

  .catalog-copy {
    display: flex;
    flex-direction: column;
    gap: var(--size-12);
  }

  .catalog-copy h3 {
    margin: 0;
    font-family: var(--font-display);
    font-size: clamp(1.75rem, 2.7vw, 2.4rem);
    font-weight: 500;
    line-height: 1.05;
  }

  .catalog-tagline,
  .catalog-summary {
    margin: 0;
  }

  .catalog-tagline {
    color: #333637;
    font-size: 1.05rem;
    font-weight: 600;
    line-height: 1.35;
  }

  .catalog-summary {
    color: #5d6266;
    font-size: 1rem;
    font-weight: 400;
    line-height: 1.62;
  }

  .catalog-actions {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: var(--size-16);
    margin-top: auto;
    padding-top: var(--size-24);
  }

  .catalog-primary-link {
    justify-content: space-between;
    gap: var(--size-12);
    margin: 0;
    text-decoration: none;
  }

  .catalog-primary-link:hover {
    color: white;
  }

  .catalog-coming-soon {
    margin: 0;
    color: var(--color-text-muted);
    cursor: default;
  }

  .link-arrow {
    color: inherit;
    font-size: 1.1em;
    font-weight: 500;
    transition: transform 160ms ease;
  }

  .catalog-primary-link:hover .link-arrow {
    transform: translateX(var(--size-2));
  }

  .catalog-secondary-links {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-12);
  }

  .catalog-secondary-links a {
    margin: 0;
    color: #545a5d;
    font-size: 0.9rem;
    font-weight: 550;
    line-height: 1.4;
    text-decoration: underline;
    text-decoration-color: #a6acae;
    text-decoration-thickness: 1px;
    text-underline-offset: 0.22em;
  }

  .catalog-secondary-links a:hover {
    color: var(--color-action, #a93600);
    text-decoration-color: currentColor;
  }

  .catalog-primary-link:focus-visible,
  .catalog-secondary-links a:focus-visible {
    outline: 3px solid var(--color-action, #c94000);
    outline-offset: 3px;
  }

  .catalog-grid.compact {
    gap: var(--size-16);
  }

  .compact .catalog-card {
    --catalog-card-padding: var(--size-24);

    min-height: 24rem;
    padding: var(--size-24);
  }

  .compact .catalog-visual {
    height: 10rem;
    margin-bottom: var(--size-24);
  }

  .compact .snapsort-card .catalog-visual {
    height: 20rem;
  }

  .compact .catalog-copy h3 {
    font-size: clamp(1.55rem, 2.4vw, 2rem);
  }

  .compact .catalog-summary {
    font-size: 0.94rem;
  }

  @media (max-width: 640px) {
    .catalog-card,
    .compact .catalog-card {
      min-height: 0;
    }

    .catalog-visual,
    .compact .catalog-visual {
      height: 9rem;
    }

    .compact .snapsort-card .catalog-visual {
      height: 18rem;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .catalog-card,
    .link-arrow {
      transition: none;
    }
  }
</style>
