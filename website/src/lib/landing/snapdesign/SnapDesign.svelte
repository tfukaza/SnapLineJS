<script lang="ts">
  type ShowcaseStyle = "existing" | "dev";

  let checkboxChecked = $state(false);
  // let radioValue = $state("option1");
  let rangeValue = $state(50);
  let textValue = $state("");
  let numberValue = $state(42);
  let selectValue = $state("option1");
  let dateValue = $state("");
  let progressValue = $state(65);
  let showcaseStyle = $state<ShowcaseStyle>("existing");
  let toggleEnabled = $state(true);
  let devStyleLoaded = false;

  async function setShowcaseStyle(style: ShowcaseStyle) {
    showcaseStyle = style;

    if (style === "dev" && !devStyleLoaded) {
      await import("./style.dev.scss");
      devStyleLoaded = true;
    }
  }
</script>

<div class="css-showcase" data-showcase-style={showcaseStyle}>
    <section class="showcase-section showcase-header col-12">
      <div class="showcase-hero-copy">
        <h1 class="showcase-title">Snap<br />Design</h1>
        <p class="large">
          A working inventory of SnapDesign type, color, cards, controls, and interface states.
        </p>
        <div class="style-selector" aria-label="Style">
          <button
            class="button small"
            class:active={showcaseStyle === "existing"}
            type="button"
            onclick={() => setShowcaseStyle("existing")}
          >
            Default
          </button>
          <button
            class="button small"
            class:active={showcaseStyle === "dev"}
            type="button"
            onclick={() => setShowcaseStyle("dev")}
          >
            Dev
          </button>
        </div>
      </div>
    </section>

    <!-- Typography Section -->
    <section class="showcase-section col-12">
      <h2>Typography</h2>
      <article class="type-article prose">
        <p class="type-page-title">Inside SnapEngine</p>
        <p>
          Snap Engine is an interaction layer for building direct,
          responsive web tools. It coordinates input, layout reads, DOM writes,
          animation, collision, and debug overlays through a shared frame loop.
        </p>

        <hr />

        <h2>A Staged Frame Loop</h2>
        <p>
          Work is split into explicit read and write stages. Reads collect
          geometry, writes update the DOM, and optional systems such as
          animation and collision run in known places between them.
        </p>
        <ul>
          <li>Input events collect user intent.</li>
          <li>Read stages measure the current document.</li>
          <li>Write stages apply DOM and transform updates.</li>
        </ul>

        <h3>Objects Own Their Behavior</h3>
        <p>
          Engine objects bind input handlers, transforms, DOM elements, and
          debugging metadata in one place. That keeps interaction code local
          without forcing each component to manually orchestrate a render loop.
        </p>
        <blockquote>
          The most useful abstraction is the one that keeps a frame predictable.
        </blockquote>

        <pre class="display code-display"><code>object.schedule(() => &#123;
  object.readDom(true, "READ_1");
&#125;, &#123; stage: "READ_1" &#125;);

object.schedule(() => &#123;
  object.writeTransform();
&#125;, &#123; stage: "WRITE_1" &#125;);</code></pre>

        <h4>Implementation Note</h4>
        <p>
          Inline code such as <code>schedule()</code> should sit comfortably
          inside body copy without changing the rhythm of the line. Related API
          notes can point to <a href="#buttons">controls</a> or
          <a href="#colors">color tokens</a> without feeling louder than the
          surrounding text.
        </p>
        <ol>
          <li>Capture the current state.</li>
          <li>Apply the smallest possible mutation.</li>
          <li>Animate from the old visual state into the new one.</li>
        </ol>

        <h5>Observation</h5>
        <p class="mono-sample">
          Geist Mono is reserved for code, labels, debug output, and compact
          technical annotations.
        </p>


      </article>
    </section>

    <!-- Colors Section -->
    <section class="showcase-section col-12">
      <h2>Color Palette</h2>
      <div class="color-grid">
        <div class="color-swatch primary">
          <span class="light">Primary</span>
          <code>#ff753a</code>
        </div>
        <div class="color-swatch secondary-1">
          <span class="light">Secondary 1</span>
          <code>#f34336</code>
        </div>
        <div class="color-swatch accent">
          <span class="light">Accent</span>
          <code>#4b403a</code>
        </div>
        <div class="color-swatch background">
          <span>Background</span>
          <code>#f6f5f4</code>
        </div>
        <div class="color-swatch background-tint">
          <span>Background Tint</span>
          <code>#e7e3e2</code>
        </div>
        <div class="color-swatch text">
          <span class="light">Text</span>
          <code>#453e3a</code>
        </div>
      </div>
    </section>

    <!-- Cards, Slots & Displays Section -->
    <section class="showcase-section col-12">
      <h2>Cards, Slots & Displays</h2>
      <div class="card-slot-grid">
        <div class="card">
          <h3>Card</h3>
          <p>A default card with subtle shadows to make it look as if it is a
            bump on the ground.
          </p>
        </div>
        <div class="slot">
          <div class="slot-content">
            <p>Slot Container</p>
            <span>Inset container for drop zones and recessed UI areas</span>
          </div>
        </div>
        <div class="display">
          <div class="display-content">
            <p>LCD Display</p>
            <span>ENGINE READY</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Buttons & Form Elements Section -->
    <section class="showcase-section col-12">
      <h2>Buttons & Form Elements</h2>
      <div class="controls-stack">
        <div class="controls-top">
          <div>
            <h3>Buttons</h3>
            <div class="button-row">
              <button class="button">Default Button</button>
              <button class="button primary">Primary Button</button>
              <button class="button active">Active State</button>
              <button class="button primary" disabled>Disabled</button>
            </div>
          </div>
          <div>
            <h3>Toggles</h3>
            <div class="toggle-demo">
              <div
                class="mini-toggle-switch slot"
                class:enabled={toggleEnabled}
                onclick={() => (toggleEnabled = !toggleEnabled)}
                role="switch"
                aria-checked={toggleEnabled}
                tabindex="0"
                onkeydown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    toggleEnabled = !toggleEnabled;
                  }
                }}
              >
                <div class="mini-toggle-knob disk"></div>
              </div>
              <span>{toggleEnabled ? "On" : "Off"}</span>
            </div>
          </div>
        </div>

        <div class="form-grid">
          <div class="form-control-group">
            <h3>Checkboxes</h3>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" bind:checked={checkboxChecked} />
                <span></span>
                Unchecked by default
              </label>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" checked />
                <span></span>
                Checked by default
              </label>
            </div>
            <div class="form-group">
              <label class="checkbox-label">
                <input type="checkbox" />
                <span></span>
                Another option
              </label>
            </div>
          </div>

          <div class="form-control-group">
            <h3>Radio Buttons</h3>
            <div class="form-group">
              <label class="radio-label">
                <input type="radio" name="demo-radio" value="option1"  />
                <span></span>
                Option One
              </label>
            </div>
            <div class="form-group">
              <label class="radio-label">
                <input type="radio" name="demo-radio" value="option2" />
                <span></span>
                Option Two
              </label>
            </div>
            <div class="form-group">
              <label class="radio-label">
                <input type="radio" name="demo-radio" value="option3"  />
                <span></span>
                Option Three
              </label>
            </div>
          </div>

          <div class="form-control-group">
            <h3>Range Sliders</h3>
            <div class="form-group">
              <label for="range-default">Default Range</label>
              <input id="range-default" type="range" min="0" max="100" bind:value={rangeValue} />
              <span class="range-value">{rangeValue}</span>
            </div>
            <div class="form-group">
              <label for="range-large">Large Range</label>
              <input id="range-large" type="range" class="large" min="0" max="100" value="75" />
            </div>
          </div>

          <div class="form-control-group">
            <h3>Dropdowns</h3>
            <div class="form-group">
              <label for="select-default">Default Select</label>
              <select id="select-default" bind:value={selectValue}>
                <option value="option1">Option One</option>
                <option value="option2">Option Two</option>
                <option value="option3">Option Three</option>
                <option value="option4">Option Four</option>
              </select>
            </div>
            <div class="form-group">
              <label for="select-grouped">Grouped Options</label>
              <select id="select-grouped">
                <optgroup label="Category A">
                  <option value="a1">Item A1</option>
                  <option value="a2">Item A2</option>
                </optgroup>
                <optgroup label="Category B">
                  <option value="b1">Item B1</option>
                  <option value="b2">Item B2</option>
                </optgroup>
              </select>
            </div>
            <div class="form-group">
              <label for="select-icons">Options with Logos</label>
              <select id="select-icons" class="select-with-icons">
                <button>
                  <selectedcontent></selectedcontent>
                </button>
                <option value="javascript">
                  <img src="/icon/javascript.svg" alt="" />
                  <span>JavaScript</span>
                </option>
                <option value="svelte">
                  <img src="/icon/svelte.svg" alt="" />
                  <span>Svelte</span>
                </option>
                <option value="react">
                  <img src="/icon/react.svg" alt="" />
                  <span>React</span>
                </option>
                <option value="vue">
                  <img src="/icon/vue.svg" alt="" />
                  <span>Vue</span>
                </option>
              </select>
            </div>
            <div class="form-group">
              <label for="select-disabled">Disabled Select</label>
              <select id="select-disabled" disabled>
                <option>Cannot change this</option>
              </select>
            </div>
          </div>

          <div class="form-control-group">
            <h3>Date Selectors</h3>
            <div class="form-group">
              <label for="date-input">Date Input</label>
              <input type="date" id="date-input" bind:value={dateValue} />
            </div>
            <div class="form-group">
              <label for="datetime-input">DateTime Input</label>
              <input type="datetime-local" id="datetime-input" />
            </div>
            <div class="form-group">
              <label for="time-input">Time Input</label>
              <input type="time" id="time-input" />
            </div>
          </div>

          <div class="form-control-group">
            <h3>Progress Bars</h3>
            <div class="form-group">
              <label for="progress-default">Default Progress ({progressValue}%)</label>
              <progress id="progress-default" value={progressValue} max="100"></progress>
            </div>
            <div class="form-group">
              <label for="progress-complete">Complete (100%)</label>
              <progress id="progress-complete" value="100" max="100"></progress>
            </div>
            <div class="form-group">
              <label for="progress-indeterminate">Indeterminate</label>
              <progress id="progress-indeterminate"></progress>
            </div>
            <div class="form-group">
              <label for="progress-adjust">Adjust Progress</label>
              <input id="progress-adjust" type="range" min="0" max="100" bind:value={progressValue} />
            </div>
          </div>

          <div class="form-control-group">
            <h3>Text Inputs</h3>
            <div class="form-group">
              <label for="text-input">Text Input</label>
              <input type="text" id="text-input" bind:value={textValue} placeholder="Enter text..." />
            </div>
            <div class="form-group">
              <label for="number-input">Number Input</label>
              <input type="number" id="number-input" bind:value={numberValue} />
            </div>
            <div class="form-group">
              <label for="disabled-input">Disabled Text Input</label>
              <input type="text" id="disabled-input" value="Cannot edit this" disabled />
            </div>
            <div class="form-group">
              <label for="disabled-number">Disabled Number Input</label>
              <input type="number" id="disabled-number" value="100" disabled />
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- UI Elements Section -->
    <section class="showcase-section col-12">
      <h2>UI Elements</h2>
      <div class="ui-elements-grid">
        <div class="ui-example">
          <h3>Table</h3>
          <div class="table-shell">
            <table>
              <thead>
                <tr>
                  <th>Asset</th>
                  <th>Status</th>
                  <th>Package</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>SnapSort</td>
                  <td><span class="chip chip-ready">Ready</span></td>
                  <td><code>@snap-engine/snapsort</code></td>
                  <td>Today</td>
                </tr>
                <tr>
                  <td>SnapLine</td>
                  <td><span class="chip chip-draft">Draft</span></td>
                  <td><code>@snap-engine/snapline</code></td>
                  <td>This week</td>
                </tr>
                <tr>
                  <td>SnapZap</td>
                  <td><span class="chip chip-muted">Queued</span></td>
                  <td><code>@snap-engine/snapzap</code></td>
                  <td>Later</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="ui-example">
          <h3>Chips</h3>
          <div class="chip-board">
            <span class="chip chip-ready">Ready</span>
            <span class="chip chip-active">Active</span>
            <span class="chip chip-warning">Needs read</span>
            <span class="chip chip-draft">Draft</span>
            <span class="chip chip-muted">Disabled</span>
            <span class="chip chip-code">READ_1</span>
          </div>
        </div>
      </div>
    </section>

</div>


<style lang="scss">
  .css-showcase {
    width: 100%;
    height: 100%;
    position: relative;
    box-sizing: border-box;
    padding: clamp(var(--size-24), 4vw, var(--size-64));
    background: #fff;
  }

  .showcase-header {
    align-items: center;
    text-align: left;
    height: 500px;
  }

  .showcase-hero-copy {
    grid-column: 1 / span 7;
    align-self: center;
  }

  .showcase-title {
    font-size: 96px;
    line-height: 1;
    margin-bottom: var(--size-24);
  }

  .style-selector {
    display: flex;
    align-items: center;
    gap: var(--size-8);
    margin-top: var(--size-16);
  }

  .showcase-section {
    background: var(--color-background-tint);
    border-radius: 12px;
    padding: clamp(var(--size-32), 4vw, var(--size-48));
    margin-bottom: var(--size-48);

    > h2 {
      font-family: "Bitcount Grid Single", monospace;
      font-size: 18px;
      font-weight: 300;
      color: var(--color-background-dark);
      margin-bottom: var(--size-24);
      text-transform: lowercase;
    }
  }

  .showcase-section > :where(h2, article, .color-grid, .card-slot-grid, .controls-stack, .ui-elements-grid) {
    grid-column: 1 / -1;
  }

  .type-article {
    column-count: 2;
    column-gap: var(--size-48);

    .type-page-title,
    h2,
    h3,
    h4,
    h5,
    pre {
      break-inside: avoid;
    }

    .type-page-title {
      column-span: all;
      margin-top: 0;
      margin-bottom: var(--size-24);
      color: #373738;
      font-family: var(--font-display);
      font-size: var(--type-page-title);
      font-weight: 500;
      letter-spacing: -0.025em;
      line-height: var(--leading-display);
      text-wrap: balance;
    }
  }

  .code-display {
    white-space: pre-wrap;
    margin-bottom: var(--size-32);
  }

  @media (max-width: 900px) {
    .type-article {
      column-count: 1;
    }
  }

  .controls-stack {
    display: flex;
    flex-direction: column;
    gap: var(--size-48);
  }

  .controls-top {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--size-32);
    align-items: start;
  }

  .form-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: var(--size-48) var(--size-32);
  }

  .form-control-group h3,
  .controls-stack h3 {
    margin-bottom: var(--size-16);
  }

  .form-group {
    input[type="text"],
    input[type="number"] {
      height: var(--size-32);
    }
  }

  .toggle-demo {
    display: flex;
    align-items: center;
    gap: var(--size-12);

    span {
      font-family: var(--font-code);
      font-size: 1rem;
      color: var(--color-background-dark);
    }
  }

  .mini-toggle-switch {
    width: 36px;
    height: 22px;
    --ui-radius: 999px;
    position: relative;
    cursor: pointer;
    overflow: hidden;
    transition: background-color 0.3s ease;

    &:hover {
      background-color: rgba(0, 0, 0, 0.08);
    }

    &.enabled {
      background-color: var(--color-primary);
    }

    &:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }
  }

  .mini-toggle-knob {
    width: 16px;
    height: 16px;
    --ui-radius: 999px;
    --card-color: rgb(29, 29, 29);
    background-color: var(--color-primary);
    position: absolute;
    top: 3px;
    left: 3px;
    padding: 0;
    transition:
      transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275),
      background-color 0.3s ease;
  }

  .mini-toggle-switch.enabled .mini-toggle-knob {
    transform: translateX(14px);
    background-color: white;
  }

  .button-row {
    display: flex;
    flex-direction: column;
    gap: var(--size-16);
    align-items: flex-start;
  }

  .color-grid {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: var(--size-24);
  }

  @media (max-width: 640px) {
    .controls-top {
      grid-template-columns: 1fr;
    }
  }

  .color-swatch {
    padding: var(--size-24) var(--size-16);
    border-radius: var(--ui-radius);
    text-align: center;
    display: flex;
    flex-direction: column;
    gap: var(--size-8);

    span {
      font-family: var(--font-code);
      font-size: 1rem;
      font-weight: 600;
    }

    code {
      font-size: 1rem;
      opacity: 0.8;
    }

    &.primary {
      background-color: var(--color-primary);
      color: white;
    }
    &.secondary-1 {
      background-color: var(--color-secondary-1);
      color: white;
    }
    &.accent {
      background-color: var(--color-accent);
      color: white;
    }
    &.background {
      background-color: var(--color-background);
      color: var(--color-text);
    }
    &.background-tint {
      background-color: var(--color-background-tint);
      color: var(--color-text);
    }
    &.text {
      background-color: var(--color-text);
      color: white;
    }
  }

  .card-slot-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: var(--size-32);
    align-items: stretch;
  }

  .card-slot-grid .card {
    padding: var(--size-32);
  }

  @media (max-width: 800px) {
    .card-slot-grid {
      grid-template-columns: 1fr;
    }
  }

  .card-slot-grid .slot,
  .card-slot-grid .display {
    min-height: 120px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .card-slot-grid .slot-content {
    text-align: center;
    padding: var(--size-16);

    span {
      font-size: 12px;
      color: var(--color-background-dark);
    }
  }

  .display-content {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--size-8);
    min-height: 100%;
    width: 100%;
    padding: var(--size-16);
    text-transform: uppercase;

    p {
      margin: 0;
      font-size: 1rem;
    }

    span {
      opacity: 0.72;
      font-size: 0.78rem;
    }
  }

  .range-value {
    font-family: var(--font-code);
    font-size: 1rem;
    color: var(--color-background-dark);
  }

  .checkbox-label,
  .radio-label {
    cursor: pointer;
  }

  .ui-elements-grid {
    display: grid;
    grid-template-columns: minmax(0, 1.45fr) minmax(240px, 0.55fr);
    gap: var(--size-32);
    align-items: start;
  }

  .ui-example {
    min-width: 0;

    h3 {
      margin-bottom: var(--size-16);
    }
  }

  .chip-board {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-8);
    align-content: flex-start;
    padding: var(--size-16);
    border-radius: var(--ui-radius);
    background: var(--color-background);
  }

  @media (max-width: 900px) {
    .ui-elements-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
