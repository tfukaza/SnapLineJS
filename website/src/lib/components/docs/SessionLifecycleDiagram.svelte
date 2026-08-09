<figure class="lifecycle-diagram">
  <div
    class="sequence"
    role="img"
    aria-label="Four-step SnapSort lifecycle. SnapSort requests and binds a ghost, tracks the drag and updates the ghost preview, commits the drop through framework state, then measures and animates the framework-rendered DOM."
  >
    <div class="participant card shallow">SnapSort</div>
    <div class="participant card shallow">Framework</div>
    <div class="participant card shallow">DOM</div>

    <div class="lifeline is-snapsort" aria-hidden="true"></div>
    <div class="lifeline is-framework" aria-hidden="true"></div>
    <div class="lifeline is-dom" aria-hidden="true"></div>

    <div class="message is-ghost-request" aria-hidden="true">
      <div class="message-label">
        <strong><span class="step-number">1.1</span> Insert ghost</strong>
        <code>onGhostInsert</code>
      </div>
      <div class="arrow is-right"></div>
    </div>

    <div class="message is-ghost-render" aria-hidden="true">
      <div class="message-label">
        <strong><span class="step-number">1.2</span> Render ghost</strong>
        <code>&lt;Ghost /&gt;</code>
      </div>
      <div class="arrow is-right"></div>
    </div>

    <div class="message is-ghost-bound" aria-hidden="true">
      <div class="message-label">
        <strong><span class="step-number">1.3</span> Ghost bound</strong>
        <code>ghostItem.element</code>
      </div>
      <div class="arrow is-left is-return"></div>
    </div>

    <div class="self-message" aria-hidden="true">
      <div class="self-label">
        <strong><span class="step-number">2.1</span> Move phase</strong>
        <code>Track drag + preview destination</code>
      </div>
      <div class="self-loop"></div>
    </div>

    <div class="message is-preview-request" aria-hidden="true">
      <div class="message-label">
        <strong><span class="step-number">2.2</span> Move ghost preview</strong>
        <code>onGhostInsert</code>
      </div>
      <div class="arrow is-right"></div>
    </div>

    <div class="message is-preview-render" aria-hidden="true">
      <div class="message-label">
        <strong><span class="step-number">2.3</span> Reconcile ghost</strong>
        <code>&lt;Ghost /&gt;</code>
      </div>
      <div class="arrow is-right"></div>
    </div>

    <div class="message is-drop-remove" aria-hidden="true">
      <div class="message-label">
        <strong><span class="step-number">3.1</span> Drop</strong>
        <code>onGhostRemove</code>
      </div>
      <div class="arrow is-right"></div>
    </div>

    <div class="message is-drop-commit" aria-hidden="true">
      <div class="message-label">
        <strong><span class="step-number">3.2</span> Commit mutation</strong>
        <code>onItemMove | onItemSwap</code>
      </div>
      <div class="arrow is-right"></div>
    </div>

    <div class="message is-state-render" aria-hidden="true">
      <div class="message-label">
        <strong><span class="step-number">4.1</span> Render state</strong>
        <code>reconcile items</code>
      </div>
      <div class="arrow is-right"></div>
    </div>

    <div class="message is-layout-ready is-wide" aria-hidden="true">
      <div class="message-label">
        <strong><span class="step-number">4.2</span> Read final layout</strong>
        <code>getBoundingClientRect()</code>
      </div>
      <div class="arrow is-left is-return"></div>
    </div>

    <div class="message is-animate is-wide" aria-hidden="true">
      <div class="message-label">
        <strong><span class="step-number">4.3</span> Apply inverse and animate</strong>
        <code>FLIP</code>
      </div>
      <div class="arrow is-right"></div>
    </div>
  </div>
</figure>

<style>
  .lifecycle-diagram {
    width: min(100%, var(--doc-reading-width, 700px));
    margin: var(--size-24) auto var(--size-32);
    padding: var(--size-24);
    border-radius: var(--ui-radius);
    background: var(--color-background-tint);
    box-sizing: border-box;
    user-select: none;
  }

  .sequence {
    position: relative;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: min(100%, 38rem);
    min-height: 55rem;
    margin: 0 auto;
  }

  .participant {
    position: relative;
    z-index: 2;
    display: flex;
    align-self: start;
    align-items: center;
    justify-content: center;
    min-width: 0;
    height: 3.25rem;
    margin: 0 clamp(var(--size-4), 1.5vw, var(--size-12));
    padding: var(--size-8);
    color: var(--color-text);
    font-family: "Bitcount Grid Single", monospace;
    font-size: clamp(0.7rem, 2.5vw, 0.88rem);
    font-weight: 350;
    text-align: center;
    box-sizing: border-box;
  }

  .lifeline {
    position: absolute;
    top: 3.25rem;
    bottom: 0;
    z-index: 0;
    width: 1px;
    background: repeating-linear-gradient(
      to bottom,
      color-mix(in srgb, var(--color-background-dark) 35%, transparent) 0 5px,
      transparent 5px 10px
    );
    transform: translateX(-50%);
  }

  .lifeline.is-snapsort {
    left: 16.666%;
  }

  .lifeline.is-framework {
    left: 50%;
  }

  .lifeline.is-dom {
    left: 83.333%;
  }

  .message {
    position: absolute;
    z-index: 1;
    width: 33.334%;
  }

  .message.is-ghost-request {
    top: 7.5rem;
    left: 16.666%;
  }

  .message.is-ghost-render {
    top: 12.25rem;
    left: 50%;
  }

  .message.is-ghost-bound {
    top: 17rem;
    left: 16.666%;
  }

  .message.is-preview-request {
    top: 27rem;
    left: 16.666%;
  }

  .message.is-preview-render {
    top: 31rem;
    left: 50%;
  }

  .message.is-drop-remove {
    top: 36rem;
    left: 16.666%;
  }

  .message.is-drop-commit {
    top: 40rem;
    left: 16.666%;
  }

  .message.is-state-render {
    top: 44rem;
    left: 50%;
  }

  .message.is-layout-ready {
    top: 48rem;
    left: 16.666%;
  }

  .message.is-animate {
    top: 52rem;
    left: 16.666%;
  }

  .message.is-wide {
    width: 66.667%;
  }

  .arrow {
    position: relative;
    height: 2px;
    background: var(--color-primary);
  }

  .arrow.is-return {
    height: 1px;
    background: repeating-linear-gradient(
      to right,
      var(--color-primary) 0 6px,
      transparent 6px 11px
    );
  }

  .arrow.is-right::after,
  .arrow.is-left::before {
    position: absolute;
    top: 50%;
    width: 0;
    height: 0;
    border-top: 5px solid transparent;
    border-bottom: 5px solid transparent;
    content: "";
    transform: translateY(-50%);
  }

  .arrow.is-right::after {
    right: -1px;
    border-left: 8px solid var(--color-primary);
  }

  .arrow.is-left::before {
    left: -1px;
    border-right: 8px solid var(--color-primary);
  }

  .message-label {
    position: absolute;
    left: 50%;
    bottom: var(--size-8);
    display: flex;
    flex-direction: column;
    align-items: center;
    width: max-content;
    max-width: calc(100% - var(--size-8));
    padding: 0 var(--size-4);
    background: var(--color-background-tint);
    text-align: center;
    transform: translateX(-50%);
  }

  .message-label strong {
    color: var(--color-primary);
    font-family: "Bitcount Grid Single", monospace;
    font-size: clamp(0.62rem, 2vw, 0.76rem);
    font-weight: 450;
    line-height: 1.25;
  }

  .message-label code {
    color: var(--color-background-dark);
    font-family: "Geist Mono", monospace;
    font-size: clamp(0.54rem, 1.8vw, 0.66rem);
    line-height: 1.4;
  }

  .step-number {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 1.65rem;
    height: 1.15rem;
    margin-right: 0.2rem;
    padding: 0 0.28rem;
    border-radius: 999px;
    background: var(--color-primary);
    color: var(--color-background);
    font-family: "Geist Mono", monospace;
    font-size: 0.58rem;
    line-height: 1;
    vertical-align: middle;
    box-sizing: border-box;
  }

  .self-message {
    position: absolute;
    top: 21.75rem;
    left: 16.666%;
    z-index: 1;
    width: 33.334%;
    height: 3.75rem;
  }

  .self-loop {
    position: relative;
    width: 68%;
    height: 100%;
    border-top: 2px solid var(--color-primary);
    border-right: 2px solid var(--color-primary);
    border-bottom: 2px solid var(--color-primary);
    border-radius: 0 var(--size-8) var(--size-8) 0;
    box-sizing: border-box;
  }

  .self-loop::after {
    position: absolute;
    left: -1px;
    bottom: -5px;
    width: 0;
    height: 0;
    border-top: 5px solid transparent;
    border-right: 8px solid var(--color-primary);
    border-bottom: 5px solid transparent;
    content: "";
  }

  .self-label {
    position: absolute;
    left: var(--size-8);
    bottom: calc(100% + var(--size-4));
    display: flex;
    flex-direction: column;
    width: max-content;
    max-width: calc(100% - var(--size-8));
    padding: 0 var(--size-4);
    background: var(--color-background-tint);
  }

  .self-label strong {
    color: var(--color-primary);
    font-family: "Bitcount Grid Single", monospace;
    font-size: clamp(0.62rem, 2vw, 0.76rem);
    font-weight: 450;
    line-height: 1.25;
  }

  .self-label code {
    color: var(--color-background-dark);
    font-family: "Geist Mono", monospace;
    font-size: clamp(0.52rem, 1.7vw, 0.64rem);
    line-height: 1.35;
    white-space: normal;
  }

  @media (max-width: 480px) {
    .lifecycle-diagram {
      padding: var(--size-16) var(--size-8);
    }

    .participant {
      margin-inline: var(--size-4);
    }
  }
</style>
