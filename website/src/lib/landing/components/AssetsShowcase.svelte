<script lang="ts">
  import SnapLinePreviewConnector from "./SnapLinePreviewConnector.svelte";

  const pendingPlusCells = Array.from({ length: 96 }, (_, index) => index);
  const kanbanGroups = [
    {
      id: "preview-kanban-queue",
      items: [
        "preview-kanban-plan",
        "preview-kanban-motion",
        "preview-kanban-copy",
      ],
    },
    {
      id: "preview-kanban-done",
      items: [
        "preview-kanban-test",
        "preview-kanban-review",
        "preview-kanban-layout",
        "preview-kanban-ghost",
      ],
    },
  ];
</script>

<section
  id="assets"
  class="assets-showcase landing-section-gap landing-section-gap-wide"
>
  <div class="assets-header">
    <h2 class="eyebrow landing-section-heading">Choose an asset to get started</h2>
    <p class="subhead">
      Assets built on top of SnapEngine provide a wide variety of interactive UI
      components for popular front-end frameworks, from node UI to drag-and-drop
      lists.
    </p>
  </div>

  <div class="assets-grid">
    <article class="asset-card drop-snap-card">
      <div class="asset-preview snapsort-asset-preview" aria-hidden="true">
        <div class="pending-plus-grid">
          {#each pendingPlusCells as cell (cell)}
            <span>+</span>
          {/each}
        </div>
        <div class="preview-kanban-panel">
          <div class="preview-kanban-board">
            {#each kanbanGroups as group (group.id)}
              <div class="preview-kanban-column card">
                {#each group.items as item (item)}
                  {#if item === "preview-kanban-ghost"}
                    <div class="preview-drop-target"></div>
                  {:else}
                    <div class="preview-card-layout preview-task-card card shallow"></div>
                  {/if}
                {/each}
              </div>
            {/each}
          </div>
          <div class="preview-card-layout preview-drag-card"></div>
          <img
            class="preview-drag-cursor"
            src="/icon/noun-cursor-740125.svg"
            alt=""
          />
        </div>
      </div>

      <div class="asset-copy">
        <div class="asset-card-header">
          <h3>SnapSort</h3>
        </div>
        <p>Unstyled components for sortable lists, kanban boards, and more.</p>
        <a class="button primary learn-more-button" href="/snapsort">Learn more</a>
      </div>
    </article>

    <div id="asset-snapzap" class="asset-card planned-card">
      <div class="asset-preview pending-preview" aria-hidden="true">
        <div class="pending-plus-grid">
          {#each pendingPlusCells as cell (cell)}
            <span>+</span>
          {/each}
        </div>
        <span>Coming soon</span>
      </div>
      <div class="asset-copy">
        <div class="asset-card-header">
          <h3>SnapZap</h3>
        </div>
        <p>Zoom and pan made simple</p>
        <button
          type="button"
          class="button primary learn-more-button planned-button-placeholder"
          disabled
        >
          Learn more
        </button>
      </div>
    </div>

    <article id="asset-snapline" class="asset-card snapline-card">
      <div class="asset-preview snapline-preview" aria-hidden="true">
        <div class="pending-plus-grid">
          {#each pendingPlusCells as cell (cell)}
            <span>+</span>
          {/each}
        </div>
        <div class="snapline-connection">
          <SnapLinePreviewConnector />
        </div>
        <div class="snapline-node snapline-node-bottom-left card">
          <div class="snapline-connector disk">
            <div class="snapline-connector-core disk"></div>
          </div>
        </div>
        <div class="snapline-node snapline-node-top-right card">
          <div class="snapline-connector disk">
            <div class="snapline-connector-core disk"></div>
          </div>
        </div>
      </div>
      <div class="asset-copy">
        <div class="asset-card-header">
          <h3>SnapLine</h3>
        </div>
        <p>Node-based UI</p>
        <a class="button primary learn-more-button" href="/snapline">Learn more</a>
      </div>
    </article>
  </div>
</section>

<style lang="scss">
  @use "../landing.scss";

  .assets-header {
    width: min(100%, 760px);
    margin: 0 auto;
    text-align: center;
  }

  .eyebrow {
    margin: 0 0 var(--size-16);
    text-align: center;
  }

  .subhead {
    max-width: 620px;
    margin: 0 auto;
    color: #5d6266;
    font-size: clamp(1rem, 1.3vw, 1.18rem);
    line-height: 1.7;
    text-align: center;
  }

  .assets-showcase {
    --assets-content-gap: clamp(2rem, 4vw, 3rem);
    margin-bottom: clamp(3rem, 6vw, 6rem);
  }

  .assets-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1.5rem;
    margin-top: var(--assets-content-gap);
    text-align: left;
  }

  .asset-card {
    --asset-card-padding: clamp(1.5rem, 3vw, 2.5rem);

    display: flex;
    flex-direction: column;
    align-items: stretch;
    gap: var(--size-24);
    padding: var(--asset-card-padding);
    border-radius: var(--ui-radius);
    background: var(--color-background-tint);
    color: inherit;
    text-decoration: none;
    box-sizing: border-box;

    h3 {
      margin: 0;
      font-family: "Geist Pixel Circle", "Doto", sans-serif;
      font-size: clamp(1.75rem, 3vw, 2.75rem);
      font-weight: 500;
      letter-spacing: 0;
      line-height: 0.95;
    }

    p {
      max-width: 22rem;
      margin: 0;
      color: #5d6266;
      font-size: clamp(0.95rem, 1.1vw, 1.05rem);
      font-weight: 400;
      line-height: 1.6;
    }
  }

  .planned-card {
    min-height: 0;
  }

  .snapline-card {
    gap: 0;
    padding: 0;
    overflow: hidden;
  }

  .snapline-card .asset-copy {
    padding: var(--asset-card-padding);
  }

  .drop-snap-card {
    position: relative;
    gap: 0;
    padding: 0;
    overflow: hidden;
  }

  .drop-snap-card .asset-copy {
    padding: var(--size-16) var(--asset-card-padding) var(--asset-card-padding);
  }

  .asset-copy {
    position: relative;
    z-index: 5;
    min-width: 0;
  }

  .asset-card-header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--size-12);
    margin-bottom: var(--size-16);
  }

  .learn-more-button {
    display: inline-flex;
    align-self: flex-start;
    margin-top: var(--size-24);
    color: #ffffff;
    font-size: 0.9rem;
    font-weight: 500;
    line-height: 1.2;
    text-decoration: none;
  }

  .planned-button-placeholder {
    min-width: 5.5rem;
    min-height: 1.1rem;
  }

  .asset-preview {
    position: relative;
    flex: 1 1 auto;
    min-width: 0;
    min-height: 180px;
  }

  .snapsort-asset-preview {
    min-height: 360px;
    overflow: hidden;
    pointer-events: none;
    user-select: none;
  }

  .snapsort-asset-preview::before {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 4;
    height: 72px;
    background: linear-gradient(
      to top,
      var(--color-background-tint) 5%,
      color-mix(in srgb, var(--color-background-tint) 82%, transparent) 54%,
      transparent 100%
    );
    content: "";
  }

  .snapsort-asset-preview::after {
    position: absolute;
    inset: 0;
    z-index: 5;
    box-shadow: inset 0 0 var(--size-24) var(--size-12) var(--color-background-tint);
    content: "";
    pointer-events: none;
  }

  .preview-kanban-panel {
    position: absolute;
    top: -384px;
    left: -50%;
    width: 200%;
    min-height: 720px;
    padding: var(--size-32);
    border-radius: var(--ui-radius);
    background: transparent;
    color: #292d2f;
    box-sizing: border-box;
    user-select: none;
  }

  .preview-kanban-board {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 1rem;
    padding: var(--size-16);
    box-sizing: border-box;
  }

  .preview-kanban-column {
    --card-radius: var(--size-32);

    display: flex;
    flex-direction: column;
    align-items: stretch;
    justify-content: flex-end;
    gap: 0.5rem;
    min-height: 590px;
    padding: var(--size-16);
    box-sizing: border-box;
  }

  .preview-card-layout {
    min-height: 112px;
  }

  .preview-task-card {
    width: 100%;
    box-sizing: border-box;
  }

  .preview-drop-target {
    width: 100%;
    height: 112px;
    border: 2px dashed color-mix(in srgb, var(--color-primary) 45%, transparent);
    border-radius: 10px;
    background: color-mix(in srgb, var(--color-primary) 7%, transparent);
    box-sizing: border-box;
  }

  .preview-drag-card {
    position: absolute;
    top: 456px;
    left: 35%;
    z-index: 3;
    width: 31%;
    margin-bottom: 0;
    padding: 1.15rem 1.25rem;
    border-radius: 10px;
    background: var(--color-background);
    box-shadow:
      0 16px 30px -12px rgb(31 30 41 / 28%),
      0 6px 12px -5px rgb(31 30 41 / 18%);
    box-sizing: border-box;
  }

  .preview-drag-cursor {
    position: absolute;
    top: 540px;
    left: 62%;
    z-index: 4;
    width: 20px;
    height: 30px;
    transform: rotate(-10deg);
  }

  .pending-preview {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 180px;
    border-radius: var(--size-8);
  }

  .pending-preview > span {
    position: relative;
    z-index: 1;
    color: rgba(32, 36, 38, 0.24);
    font-family: "Bitcount Grid Single", monospace;
    font-size: clamp(2rem, 4vw, 3.5rem);
    font-weight: 300;
    line-height: 1;
    text-align: center;
  }

  .pending-plus-grid {
    position: absolute;
    inset: 10px;
    z-index: 0;
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(36px, 1fr));
    grid-auto-rows: 36px;
    overflow: hidden;
    pointer-events: none;
    color: rgba(0, 0, 0, 0.08);
    font-family: "Bitcount Grid Single", monospace;
    font-size: 10px;
    font-weight: 300;
    line-height: 1;
    place-items: center;
    user-select: none;
  }

  .pending-plus-grid span {
    margin: 0;
    color: inherit;
  }

  .snapline-preview {
    min-height: 180px;
    overflow: hidden;
    border-radius: var(--size-8);
  }

  .snapline-preview::before {
    position: absolute;
    right: 0;
    bottom: 0;
    left: 0;
    z-index: 4;
    height: 72px;
    background: linear-gradient(
      to top,
      var(--color-background-tint) 5%,
      color-mix(in srgb, var(--color-background-tint) 82%, transparent) 54%,
      transparent 100%
    );
    content: "";
    pointer-events: none;
  }

  .snapline-node {
    position: absolute;
    width: 62%;
    height: 208px;
    box-sizing: border-box;
  }

  .snapline-connection {
    position: absolute;
    top: 116px;
    right: 35%;
    bottom: 92px;
    left: 35%;
    z-index: 1;
    overflow: visible;
    pointer-events: none;
  }

  .snapline-node-bottom-left {
    bottom: -12px;
    left: -27%;
  }

  .snapline-node-top-right {
    top: 12px;
    right: -27%;
  }

  .snapline-connector {
    position: absolute;
    top: 50%;
    width: 20px;
    height: 20px;
    padding: 0;
    background: var(--color-primary);
    transform: translateY(-50%);
  }

  .snapline-connector::after {
    border-width: 1.5px;
  }

  .snapline-connector-core {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 8px;
    height: 8px;
    padding: 0;
    background: var(--color-background);
    transform: translate(-50%, -50%);
  }

  .snapline-node-bottom-left .snapline-connector {
    right: -10px;
  }

  .snapline-node-top-right .snapline-connector {
    left: -10px;
  }

  @media (max-width: 900px) {
    .assets-grid {
      grid-template-columns: 1fr;
    }

    .asset-card {
      flex-direction: column;
      align-items: stretch;
      min-height: 0;
    }

    .asset-copy,
    .asset-preview {
      flex-basis: auto;
    }

    .snapsort-asset-preview {
      min-height: 330px;
    }

  }
</style>
