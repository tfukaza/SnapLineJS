<section
  id="how-it-works"
  class="interlude landing-section-gap landing-section-gap-wide"
>
  <div class="interlude-header">
    <h2 class="landing-section-heading">One foundation for all UI</h2>
    <p class="landing-section-lede">
      All assets are built on the SnapEngine Core, which takes care of low-level
      handling like processing inputs and detecting collision, playing animation,
      etc. This allows for maintainable code and high interoperability.
    </p>

    <a class="interlude-link" href="/about">
      Why use an engine model?
      <span
        class="interlude-link-icon material-symbols-rounded"
        aria-hidden="true">arrow_forward</span
      >
    </a>
  </div>

  <div class="engine-visualization">
    <ol class="engine-stack" aria-label="SnapEngine ecosystem layers">
      <li class="asset-group">
        <ul class="asset-columns">
          <li class="asset-column">
            <div
              class="framework-logos"
              aria-label="Svelte, React, and vanilla JavaScript adapters"
            >
              <span class="framework-adapter">
                <img src="/icon/svelte.svg" alt="" />
                <span class="asset-connector" aria-hidden="true">↓</span>
              </span>
              <span class="framework-adapter">
                <img src="/icon/react.svg" alt="" />
                <span class="asset-connector" aria-hidden="true">↓</span>
              </span>
              <span class="framework-adapter">
                <img src="/icon/javascript.svg" alt="" />
                <span class="asset-connector" aria-hidden="true">↓</span>
              </span>
            </div>
            <strong class="asset-node card">
              <span
                class="asset-icon snapsort-icon"
                aria-hidden="true"
              ></span>
              <span>SnapSort</span>
            </strong>
            <span class="asset-connector" aria-hidden="true">↓</span>
          </li>
          <li class="asset-column planned-asset-column">
            <div
              class="framework-logos"
              aria-label="Svelte, React, and vanilla JavaScript adapters"
            >
              <span class="framework-adapter">
                <img src="/icon/svelte.svg" alt="" />
                <span class="asset-connector" aria-hidden="true">↓</span>
              </span>
              <span class="framework-adapter">
                <img src="/icon/react.svg" alt="" />
                <span class="asset-connector" aria-hidden="true">↓</span>
              </span>
              <span class="framework-adapter">
                <img src="/icon/javascript.svg" alt="" />
                <span class="asset-connector" aria-hidden="true">↓</span>
              </span>
            </div>
            <strong class="asset-node planned-asset-node card">
              <span
                class="asset-icon snapline-icon"
                aria-hidden="true"
              ></span>
              <span class="asset-node-copy">
                <span>SnapLine</span>
                <small>Coming soon</small>
              </span>
            </strong>
            <span class="asset-connector" aria-hidden="true">↓</span>
          </li>
          <li class="asset-column planned-asset-column">
            <div
              class="framework-logos"
              aria-label="Svelte, React, and vanilla JavaScript adapters"
            >
              <span class="framework-adapter">
                <img src="/icon/svelte.svg" alt="" />
                <span class="asset-connector" aria-hidden="true">↓</span>
              </span>
              <span class="framework-adapter">
                <img src="/icon/react.svg" alt="" />
                <span class="asset-connector" aria-hidden="true">↓</span>
              </span>
              <span class="framework-adapter">
                <img src="/icon/javascript.svg" alt="" />
                <span class="asset-connector" aria-hidden="true">↓</span>
              </span>
            </div>
            <strong class="asset-node planned-asset-node card">
              <span
                class="asset-icon snapzap-icon"
                aria-hidden="true"
              ></span>
              <span class="asset-node-copy">
                <span>SnapZap</span>
                <small>Coming soon</small>
              </span>
            </strong>
            <span class="asset-connector" aria-hidden="true">↓</span>
          </li>
        </ul>
      </li>
      <li class="stack-layer core-layer card">
        <span class="core-icon" aria-hidden="true"></span>
        <strong>SnapEngine Core</strong>
      </li>
      <li class="stack-connector" aria-hidden="true">↓</li>
      <li class="stack-layer platform-layer card">
        <span class="platform-icon" aria-hidden="true"></span>
        <strong>DOM + browser APIs</strong>
      </li>
    </ol>
  </div>
</section>

<style lang="scss">
  @use "../landing.scss";

  .interlude {
    display: grid;
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.15fr);
    align-items: center;
    gap: clamp(var(--size-48), 7vw, 6rem);
  }

  .interlude-header {
    width: 100%;
    text-align: left;

    :global(.landing-section-lede) {
      margin-right: 0;
      margin-left: 0;
    }
  }

  .engine-visualization {
    width: min(100%, 760px);
  }

  .engine-stack {
    display: flex;
    flex-direction: column;
    gap: var(--size-8);
    width: 100%;
    margin: 0;
    padding: 0;
    font-family: var(--font-label);
    font-weight: 350;
    list-style: none;
    box-sizing: border-box;
  }

  .asset-group {
    display: flex;
    flex-direction: column;
    gap: var(--size-8);
  }

  .asset-columns {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--size-8);
    margin: 0;
    padding: 0;
    list-style: none;
  }

  .asset-column {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: var(--size-8);
    font-family: var(--font-label);
  }

  .framework-logos {
    display: flex;
    align-items: flex-start;
    justify-content: center;
    gap: clamp(var(--size-8), 1.5vw, var(--size-16));
    box-sizing: border-box;
  }

  .framework-adapter {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: var(--size-8);
  }

  .framework-logos img {
    width: clamp(20px, 2vw, 26px);
    height: clamp(20px, 2vw, 26px);
    object-fit: contain;
  }

  .asset-node {
    display: flex;
    min-height: 64px;
    align-items: center;
    justify-content: center;
    gap: var(--size-8);
    padding: var(--size-16) var(--size-8);
    color: var(--color-text);
    font-size: var(--type-body);
    font-weight: 350;
    line-height: var(--leading-caption);
    box-sizing: border-box;
  }

  .planned-asset-column .framework-logos {
    opacity: 0.45;
  }

  .planned-asset-node {
    color: var(--color-text-subtle);
  }

  .asset-node-copy {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: var(--size-2);
  }

  .asset-node-copy small {
    color: var(--color-text-subtle);
    font-size: 0.65rem;
    font-weight: 450;
    letter-spacing: 0.04em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .asset-icon {
    width: 22px;
    height: 22px;
    flex: 0 0 22px;
    background-color: var(--color-text);
  }

  .snapsort-icon {
    -webkit-mask: url("/icon/bullet-list-588573.png") center / contain no-repeat;
    mask: url("/icon/bullet-list-588573.png") center / contain no-repeat;
  }

  .snapline-icon {
    -webkit-mask: url("/icon/nodes-6450391.png") center / contain no-repeat;
    mask: url("/icon/nodes-6450391.png") center / contain no-repeat;
  }

  .snapzap-icon {
    -webkit-mask: url("/icon/camera-8384877.png") center / contain no-repeat;
    mask: url("/icon/camera-8384877.png") center / contain no-repeat;
  }

  .asset-connector {
    height: var(--size-24);
    color: var(--color-text-subtle);
    font-family: inherit;
    font-size: 1.35rem;
    line-height: 1;
    text-align: center;
  }

  .stack-layer {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--size-16);
    min-height: 72px;
    padding: var(--size-16) var(--size-24);
    box-sizing: border-box;
    font-family: var(--font-label);
    text-align: center;

    strong {
      color: var(--color-text);
      font-size: var(--type-body);
      font-weight: 350;
      line-height: var(--leading-caption);
    }
  }

  .core-layer,
  .platform-layer {
    flex-direction: row;
    gap: var(--size-8);
  }

  .core-icon,
  .platform-icon {
    width: 22px;
    height: 22px;
    flex: 0 0 22px;
    background-color: var(--color-text);
  }

  .core-icon {
    -webkit-mask: url("/icon/engine-5888296.png") center / contain no-repeat;
    mask: url("/icon/engine-5888296.png") center / contain no-repeat;
  }

  .platform-icon {
    -webkit-mask: url("/icon/browse-8396205.png") center / contain no-repeat;
    mask: url("/icon/browse-8396205.png") center / contain no-repeat;
  }

  .stack-connector {
    height: var(--size-24);
    color: var(--color-text-subtle);
    font-family: inherit;
    font-size: 1.35rem;
    line-height: 1;
    text-align: center;
  }

  .interlude-link {
    display: inline-flex;
    align-items: center;
    gap: var(--size-4);
    margin-top: var(--size-24);
    color: var(--color-action);
    font-size: 1rem;
    font-weight: 500;
    text-decoration: none;

    &:hover .interlude-link-icon {
      transform: translateX(2px);
    }
  }

  .interlude-link-icon {
    font-size: 1.1rem;
    transition: transform 160ms ease;
  }

  @media (max-width: 900px) {
    .interlude {
      grid-template-columns: 1fr;
      gap: clamp(var(--size-32), 8vw, var(--size-64));
    }

    .interlude-header {
      width: min(100%, 760px);
      margin: 0 auto;
      text-align: center;

      :global(.landing-section-lede) {
        margin-right: auto;
        margin-left: auto;
      }
    }

    .engine-visualization {
      margin: 0 auto;
    }
  }

  @media (max-width: 560px) {
    .stack-layer {
      grid-template-columns: 1fr;
      gap: var(--size-4);
      padding: var(--size-16);
      text-align: center;
    }

  }

  @media (prefers-reduced-motion: reduce) {
    .interlude-link-icon {
      transition: none;
    }
  }
</style>
