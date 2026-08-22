<script lang="ts">
  import MaterialControlPanel, {
    type MaterialControlTarget,
  } from "$lib/components/MaterialControlPanel.svelte";
  import MaterialSurface from "$lib/components/MaterialSurface.svelte";
  import SnapButton from "$lib/components/SnapButton.svelte";
  import Slider from "$lib/components/Slider.svelte";
  import Toggle from "$lib/components/Toggle.svelte";
  import type { MaterialSettings } from "$lib/components/materialSurface";

  type ShowcaseStyle = "existing" | "dev";
  type MaterialTargetId =
    | "dial"
    | "button"
    | "toggle"
    | "slider"
    | "raisedCard"
    | "insetSlot";

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
  const materialTargets = [
    { id: "dial", label: "Dial" },
    { id: "button", label: "Button" },
    { id: "toggle", label: "Toggle" },
    { id: "slider", label: "Slider" },
    { id: "raisedCard", label: "Raised Card" },
    { id: "insetSlot", label: "Inset Slot" },
  ] satisfies MaterialControlTarget[];
  const materialDefaultConfigurations: Record<MaterialTargetId, MaterialSettings> = {
    dial: {
      lightAngle: 315,
      ambientBrightness: 0,
      shadowDistance: 14,
      shadowBlur: 11.25,
      shadowStrength: 1,
      specularIntensity: 0.34,
      specularPower: 31,
      rimWidth: 1.75,
      rimBlur: 0.7,
      creviceBrightness: 0.41,
      shadedRim: true,
      creviceOutline: true,
    },
    button: {
      lightAngle: 325,
      ambientBrightness: 0,
      shadowDistance: 6.5,
      shadowBlur: 6.25,
      shadowStrength: 1,
      specularIntensity: 0.85,
      specularPower: 10,
      rimWidth: 1,
      rimBlur: 0.1,
      creviceBrightness: 0.14,
      shadedRim: true,
      creviceOutline: true,
    },
    toggle: {
      lightAngle: 325,
      ambientBrightness: 0.1,
      shadowDistance: 6,
      shadowBlur: 5,
      shadowStrength: 1,
      specularIntensity: 0.85,
      specularPower: 10,
      rimWidth: 0.75,
      rimBlur: 0.75,
      creviceBrightness: 0,
      shadedRim: true,
      creviceOutline: false,
    },
    slider: {
      lightAngle: 325,
      ambientBrightness: 0.1,
      shadowDistance: 3.5,
      shadowBlur: 9,
      shadowStrength: 1,
      specularIntensity: 0.85,
      specularPower: 10,
      rimWidth: 0.75,
      rimBlur: 0.5,
      creviceBrightness: 0,
      shadedRim: true,
      creviceOutline: false,
    },
    raisedCard: {
      lightAngle: 325,
      ambientBrightness: 0.1,
      shadowDistance: 3.75,
      shadowBlur: 5.25,
      shadowStrength: 1,
      specularIntensity: 0.85,
      specularPower: 10,
      rimWidth: 0.5,
      rimBlur: 0.1,
      creviceBrightness: 0,
      shadedRim: true,
      creviceOutline: false,
    },
    insetSlot: {
      lightAngle: 325,
      ambientBrightness: 0,
      shadowDistance: 2.25,
      shadowBlur: 7.75,
      shadowStrength: 1,
      specularIntensity: 0.85,
      specularPower: 10,
      rimWidth: 0.5,
      rimBlur: 0.1,
      creviceBrightness: 0,
      shadedRim: true,
      creviceOutline: false,
    },
  };
  let materialConfigurations = $state<Record<MaterialTargetId, MaterialSettings>>({
    dial: { ...materialDefaultConfigurations.dial },
    button: { ...materialDefaultConfigurations.button },
    toggle: { ...materialDefaultConfigurations.toggle },
    slider: { ...materialDefaultConfigurations.slider },
    raisedCard: { ...materialDefaultConfigurations.raisedCard },
    insetSlot: { ...materialDefaultConfigurations.insetSlot },
  });
  let selectedMaterialTarget = $state<MaterialTargetId>("button");
  let devStyleLoaded = false;
  const progressCellCount = 20;

  function filledProgressCells(value: number, max = 100) {
    const ratio = Math.max(0, Math.min(value / max, 1));
    return Math.round(ratio * progressCellCount);
  }

  function progressCells(character: string, count: number) {
    return character.repeat(Math.max(0, count));
  }

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
      </div>
      <div class="hero-specimen">
        <p class="hero-description">
          A working inventory of type, color, controls, and interface states.
        </p>
        <div class="style-selector" aria-label="Style">
          <SnapButton
            material={materialConfigurations.button}
            className={`small ${showcaseStyle === "existing" ? "active" : ""}`}
            onclick={() => setShowcaseStyle("existing")}
          >
            Default
          </SnapButton>
          <SnapButton
            material={materialConfigurations.button}
            className={`small ${showcaseStyle === "dev" ? "active" : ""}`}
            onclick={() => setShowcaseStyle("dev")}
          >
            Dev
          </SnapButton>
        </div>
        <span class="hero-kicker">Design System</span>
      </div>
    </section>

    <!-- Foundations Section -->
    <section class="showcase-section foundation-section col-12">
      <div class="foundation-main">
        <article class="type-article prose">
          <div class="type-column">
            <p class="type-group-label">Headings</p>
            <div class="heading-stack">
              <h1>Heading 1</h1>
              <h2>Heading 2</h2>
              <h3>Heading 3</h3>
              <h4>Heading 4</h4>
              <h5>Heading 5</h5>
              <h6>Heading 6</h6>
            </div>

            <hr />

            <p class="type-group-label">Paragraph & Quote</p>
            <p>
              Body copy should remain calm and readable across documentation,
              product interfaces, and longer explanations. A second sentence
              demonstrates the rhythm of a typical paragraph.
            </p>
            <blockquote>
              <p>Useful details should support the interaction, never obscure it.</p>
              <cite>SnapDesign principle</cite>
            </blockquote>

            <details>
              <summary>Details and summary</summary>
              <p>Expandable content stays available without dominating the page.</p>
            </details>
          </div>

          <div class="type-column">
            <p class="type-group-label">Inline Elements</p>
            <p class="inline-elements">
              <a href="#buttons">Link</a>, <strong>strong</strong>,
              <em>emphasis</em>, <mark>highlight</mark>,
              <abbr title="Snap Design System">abbreviation</abbr>,
              <code>inlineCode()</code>, <kbd>⌘ K</kbd>,
              <samp>sample output</samp>, <del>deleted</del>,
              <ins>inserted</ins>, H<sub>2</sub>O, x<sup>2</sup>, and
              <small>small print</small>.
            </p>

            <div class="list-grid">
              <div>
                <p class="type-group-label">Unordered List</p>
                <ul>
                  <li>Direct interaction</li>
                  <li>Clear hierarchy</li>
                  <li>Purposeful motion</li>
                </ul>
              </div>
              <div>
                <p class="type-group-label">Ordered List</p>
                <ol>
                  <li>Read the state</li>
                  <li>Apply the change</li>
                  <li>Show feedback</li>
                </ol>
              </div>
            </div>

            <dl>
              <dt>Definition term</dt>
              <dd>A short explanation associated with the term.</dd>
            </dl>

            <p class="type-group-label">Code Block</p>
            <pre class="display shiki specimen-code" aria-label="Code display example"><code><span class="line" data-line="1"><span class="code-keyword">const</span> snap = create();</span><span class="line" data-line="2">snap.mount();</span><span class="line" data-line="3"><span class="code-comment">// Ready for input</span></span></code></pre>
          </div>
        </article>
      </div>
    </section>

    <!-- Color, Cards & Slots Section -->
    <section class="showcase-section palette-components-section col-12">
      <aside class="color-aside" id="colors">
        <h2>Color</h2>
        <div class="color-grid">
          <div class="color-swatch background">
            <span>Gray 01</span>
            <code>#f6f6f6</code>
          </div>
          <div class="color-swatch background-tint">
            <span>Gray 02</span>
            <code>#ececeb</code>
          </div>
          <div class="color-swatch black">
            <span class="light">Black</span>
            <code>#000000</code>
          </div>
          <div class="color-swatch primary">
            <span class="light">Primary</span>
            <code>#ff5d0f</code>
          </div>
        </div>
      </aside>

      <div class="cards-slots-aside">
        <h2>Container</h2>
        <div class="cards-slots-stage">
          <MaterialSurface depth="raised" shape="rounded" radius={16} material={materialConfigurations.raisedCard} className="specimen-card">
            <h3>Raised Card</h3>
            <p>Emphasizes important content with depth. Use it sparingly so the emphasis keeps its meaning.</p>
          </MaterialSurface>
          <MaterialSurface depth="recessed" shape="rounded" radius={16} material={materialConfigurations.insetSlot} className="specimen-slot">
            <div class="slot-content">
              <h3>Inset Slot</h3>
              <p>Emphasizes an important drop zone or recessed area. Use it sparingly so it remains distinct.</p>
            </div>
          </MaterialSurface>
          <div class="compact-specimen">
            <div class="compact-card">
              <h3>Compact Card</h3>
              <p>A toned-down card for repeated UI such as list items, rows, and closely grouped controls.</p>
            </div>
          </div>
          <div class="compact-specimen">
            <div class="compact-slot">
              <h3>Compact Slot</h3>
              <p>A toned-down slot for interfaces where drop zones or containers need to repeat.</p>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="material-panel-section col-12">
      <MaterialControlPanel
        targets={materialTargets}
        defaults={materialDefaultConfigurations}
        bind:configurations={materialConfigurations}
        bind:selectedTarget={selectedMaterialTarget}
      />
    </section>

    <!-- Buttons & Form Elements Section -->
    <section class="showcase-section elements-section col-12" id="buttons">
      <h2 class="oversized-section-title">UI<br />Elements</h2>
      <div class="controls-stack">
        <div class="controls-top">
          <div>
            <h3>Buttons</h3>
            <div class="button-row">
              <SnapButton material={materialConfigurations.button}>Default Button</SnapButton>
              <SnapButton material={materialConfigurations.button} className="primary">Primary Button</SnapButton>
              <SnapButton material={materialConfigurations.button} className="active">Active State</SnapButton>
              <SnapButton material={materialConfigurations.button} className="primary" disabled>Disabled</SnapButton>
            </div>
          </div>
          <div class="toggle-range-card">
            <div class="toggle-range-half">
              <h3>Toggles</h3>
              <div class="toggle-examples">
                <div class="toggle-demo">
                  <Toggle bind:checked={toggleEnabled} material={materialConfigurations.toggle} aria-label="Toggle example" />
                  <span>{toggleEnabled ? "On" : "Off"}</span>
                </div>
              </div>
            </div>
            <div class="toggle-range-half">
              <h3>Range</h3>
              <div class="range-demo">
                <Slider id="range-default" min={0} max={100} bind:value={rangeValue} material={materialConfigurations.slider} />
                <span class="range-value">{rangeValue}</span>
              </div>
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
              <div class="ascii-progress">
                <progress
                  class="ascii-progress-native"
                  id="progress-default"
                  value={progressValue}
                  max="100"
                ></progress>
                <span class="ascii-progress-visual" aria-hidden="true">
                  <span class="ascii-progress-bracket">├</span><span class="ascii-progress-cells"><span class="ascii-progress-filled">{progressCells("■", filledProgressCells(progressValue))}</span><span class="ascii-progress-empty">{progressCells("□", progressCellCount - filledProgressCells(progressValue))}</span></span><span class="ascii-progress-bracket">┤</span>
                  <span class="ascii-progress-value">{progressValue}%</span>
                </span>
              </div>
            </div>
            <div class="form-group">
              <label for="progress-complete">Complete (100%)</label>
              <div class="ascii-progress">
                <progress
                  class="ascii-progress-native"
                  id="progress-complete"
                  value="100"
                  max="100"
                ></progress>
                <span class="ascii-progress-visual" aria-hidden="true">
                  <span class="ascii-progress-bracket">├</span><span class="ascii-progress-cells"><span class="ascii-progress-filled">{progressCells("■", progressCellCount)}</span></span><span class="ascii-progress-bracket">┤</span>
                  <span class="ascii-progress-value">100%</span>
                </span>
              </div>
            </div>
            <div class="form-group">
              <label for="progress-indeterminate">Indeterminate</label>
              <div class="ascii-progress">
                <progress class="ascii-progress-native" id="progress-indeterminate"></progress>
                <span class="ascii-progress-visual" aria-hidden="true">
                  <span class="ascii-progress-bracket">├</span><span class="ascii-progress-cells ascii-progress-indeterminate"><span class="ascii-progress-empty">{progressCells("□", progressCellCount)}</span><span class="ascii-progress-scanner">■■■■</span></span><span class="ascii-progress-bracket">┤</span>
                  <span class="ascii-progress-value">···</span>
                </span>
              </div>
            </div>
            <div class="form-group">
              <label for="progress-adjust">Adjust Progress</label>
              <Slider id="progress-adjust" min={0} max={100} bind:value={progressValue} material={materialConfigurations.slider} />
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
    min-height: 100%;
    position: relative;
    box-sizing: border-box;
    padding: clamp(18px, 3vw, 44px);
    background: #f6f6f6;
  }

  .showcase-header {
    display: grid;
    grid-template-columns: minmax(0, 0.85fr) minmax(420px, 1.15fr);
    align-items: stretch;
    text-align: left;
    min-height: 496px;
  }

  .showcase-hero-copy {
    display: flex;
    align-items: flex-start;
    padding: clamp(48px, 6vw, 72px);
  }

  .showcase-title {
    margin: 0;
    color: #080808;
    font-family: "Geist", sans-serif;
    font-size: clamp(84px, 9vw, 132px);
    font-weight: 500;
    letter-spacing: -0.075em;
    line-height: 0.9;
  }

  .hero-specimen {
    position: relative;
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: var(--size-24);
    margin: 32px;
    padding: 28px;
    overflow: hidden;
    border-radius: 16px;
    background: #ececeb;
  }

  .hero-description {
    width: min(300px, 55%);
    margin: 0;
    color: #6b6867;
    font-size: 0.9rem;
    line-height: 1.45;
  }

  .hero-kicker {
    position: absolute;
    right: 28px;
    bottom: 24px;
    color: var(--color-primary);
    font-family: "Bitcount Grid Single", monospace;
    font-size: 18px;
    text-transform: uppercase;
  }

  .style-selector {
    display: flex;
    align-items: center;
    gap: var(--size-8);
  }

  .showcase-section {
    width: min(1400px, 100%);
    margin-inline: auto;
    margin-bottom: 60px;
    border: 1px solid #d7d7d7;
    border-radius: 0;
    background: transparent;

    > h2 {
      font-family: "Bitcount Grid Single", monospace;
      font-size: 18px;
      font-weight: 300;
      color: var(--color-background-dark);
      margin-bottom: var(--size-24);
    }
  }

  .showcase-section:not(.showcase-header):not(.foundation-section):not(.palette-components-section):not(.elements-section) {
    display: block;
  }

  .foundation-section {
    display: grid;
    grid-template-columns: 1fr;
    min-height: 420px;
  }

  .foundation-main {
    display: flex;
    align-items: center;
    padding: clamp(46px, 6vw, 72px);
  }

  .type-article {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: clamp(32px, 4vw, 64px);
    align-items: start;
    width: 100%;
    margin: 0;

    h1,
    h2,
    h3,
    h4,
    h5,
    h6,
    pre {
      break-inside: avoid;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      font-family: var(--font-label);
      font-weight: 400;
      letter-spacing: 0;
      line-height: 1;
    }

    h1 {
      margin-bottom: var(--size-16);
      font-size: clamp(48px, 5vw, 72px);
    }

    h2 {
      font-size: clamp(36px, 4vw, 52px);
    }

    h3 {
      font-size: 25px;
    }

    h4 {
      font-size: 21px;
    }

    h5 {
      font-size: 20px;
    }

    h6 {
      font-size: 17px;
    }
  }

  .type-column {
    min-width: 0;

    > :last-child {
      margin-bottom: 0;
    }
  }

  .type-group-label {
    margin-bottom: 12px !important;
    color: var(--color-primary);
    font-family: var(--font-label);
    font-size: 15px;
    line-height: 1;
    text-transform: uppercase;
  }

  .heading-stack {
    display: flex;
    flex-direction: column;
    gap: 12px;

    > :where(h1, h2, h3, h4, h5, h6) {
      margin: 0;
    }
  }

  .type-column > hr {
    margin: 32px 0;
    border: 0;
    border-top: 1px solid #d7d7d7;
  }

  .type-column blockquote {
    margin: 24px 0 28px;
    padding-left: 20px;
    border-left: 2px solid var(--color-primary);

    p {
      margin-bottom: 8px;
    }

    cite {
      color: var(--color-text-muted);
      font-family: var(--font-code);
      font-size: 12px;
      font-style: normal;
    }
  }

  .type-column details {
    padding: 14px 0;
    border-top: 1px solid #d7d7d7;
    border-bottom: 1px solid #d7d7d7;

    summary {
      cursor: pointer;
      font-family: var(--font-label);
    }

    p {
      margin: 12px 0 0;
    }
  }

  .inline-elements {
    line-height: 2;

    mark,
    code,
    kbd,
    samp {
      padding: 2px 5px;
      border-radius: 3px;
    }

    mark {
      background: color-mix(in srgb, var(--color-primary) 28%, white);
    }

    code,
    samp {
      background: #ececeb;
      font-family: var(--font-code);
    }

    kbd {
      color: white;
      background: #000;
      font-family: var(--font-code);
    }
  }

  .list-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 24px;
    margin: 28px 0;

    ul,
    ol {
      margin: 0;
      padding-left: 22px;
    }
  }

  .type-column dl {
    display: grid;
    grid-template-columns: minmax(120px, 0.35fr) minmax(0, 1fr);
    gap: 12px;
    margin: 0 0 28px;

    dt {
      font-family: var(--font-label);
    }

    dd {
      margin: 0;
    }
  }

  .palette-components-section {
    display: grid;
    grid-template-columns: minmax(280px, 0.65fr) minmax(0, 1.35fr);
    align-items: stretch;
    gap: 0;
    min-height: 500px;
  }

  .color-aside {
    display: flex;
    min-width: 0;
    flex-direction: column;
    padding: 28px 24px 24px;
    border-left: 0;

    > h2 {
      margin: 0 0 16px;
      padding-left: var(--ui-radius);
      font-family: "Bitcount Grid Single", monospace;
      font-size: 28px;
      font-weight: 400;
    }
  }

  .cards-slots-aside {
    min-width: 0;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    padding: 28px 24px 24px;
    border-left: 1px solid #d7d7d7;

    > h2 {
      margin: 0 0 20px;
      padding-left: var(--ui-radius);
      font-family: var(--font-label);
      font-size: 28px;
      font-weight: 400;
    }

    .cards-slots-stage {
      flex: 1;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: clamp(28px, 3vw, 48px);
      box-sizing: border-box;
      min-height: 0;
      padding: clamp(44px, 5vw, 72px);
      border-radius: 16px;
      background: #ececeb;
    }
  }

  :global(.specimen-slot) {
    display: flex;
    width: 100%;
    min-height: 0;
    align-items: stretch;
  }

  .cards-slots-stage .slot-content {
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    padding: clamp(36px, 4vw, 60px);
  }

  :global(.specimen-card) {
    --material-content-direction: column;
    --material-content-gap: 12px;
    --material-content-padding: clamp(28px, 3vw, 44px);
    box-sizing: border-box;
  }

  .cards-slots-stage :global(.specimen-card h3) {
    padding-left: var(--ui-radius);
    font-weight: 400;
  }

  .cards-slots-stage :global(.specimen-slot h3) {
    padding-left: var(--ui-radius);
    font-weight: 400;
  }

  .compact-specimen {
    display: flex;
    min-width: 0;
    flex-direction: column;
    justify-content: center;

    h3 {
      margin: 0;
      padding-left: var(--ui-radius);
      font-weight: 400;
    }

    p {
      margin: 0;
      color: color-mix(in srgb, #000 58%, transparent);
      font-size: 0.9rem;
      line-height: 1.45;
    }
  }

  .compact-card {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 16px;
    min-height: 108px;
    padding: 20px;
    box-sizing: border-box;
    border: 1px solid color-mix(in srgb, #000 24%, transparent);
    border-radius: 8px;
    background: #f6f6f6;
    box-shadow: 0 3px 10px rgb(36 38 39 / 5%);
  }

  .compact-slot {
    display: flex;
    min-height: 108px;
    flex-direction: column;
    justify-content: center;
    gap: 16px;
    padding: 20px;
    box-sizing: border-box;
    border: 1px solid #d7d7d7;
    border-radius: 8px;
    color: color-mix(in srgb, #000 52%, transparent);
  }

  .material-panel-section {
    display: block;
    width: 100%;
    margin: 0 0 60px;
    border: 0;
  }

  .material-panel-section > :global(.material-control-panel) {
    width: 100%;
    margin: 0;
    box-sizing: border-box;
  }

  .controls-stack {
    display: contents;
  }

  .elements-section {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 0;
    align-items: stretch;
    border: 0;
  }

  .oversized-section-title {
    display: flex;
    align-items: center;
    margin: 0 !important;
    padding: clamp(50px, 6vw, 74px);
    color: #080808 !important;
    font-family: "Geist", sans-serif !important;
    font-size: clamp(72px, 7.5vw, 116px) !important;
    font-weight: 500 !important;
    letter-spacing: -0.07em;
    line-height: 0.9;
    grid-row: span 2;
    min-height: 560px;
    box-sizing: border-box;
    border: 1px solid #d7d7d7;
  }

  .controls-top {
    display: contents;
  }

  .form-grid {
    display: contents;
  }

  .controls-top > div,
  .form-control-group {
    margin: 0;
    min-width: 0;
    box-sizing: border-box;
    padding: 24px;
    border: 0;
    background: transparent;
  }

  // Each adjoining tile owns only one side of a shared seam, keeping it 1px.
  .controls-top > div:first-child,
  .controls-top > div:last-child {
    border-top: 1px solid #d7d7d7;
    border-right: 1px solid #d7d7d7;
    border-bottom: 1px solid #d7d7d7;
  }

  .form-control-group:nth-child(1),
  .form-control-group:nth-child(2),
  .form-control-group:nth-child(4),
  .form-control-group:nth-child(5) {
    border-right: 1px solid #d7d7d7;
    border-bottom: 1px solid #d7d7d7;
  }

  .form-control-group:nth-child(3),
  .form-control-group:nth-child(6) {
    border-right: 1px solid #d7d7d7;
    border-bottom: 1px solid #d7d7d7;
    border-left: 1px solid #d7d7d7;
  }

  .toggle-range-card {
    display: grid;
    grid-template-rows: repeat(2, minmax(0, 1fr));
    padding: 0 !important;
  }

  .toggle-range-half {
    min-width: 0;
    padding: 16px 24px;

    & + & {
      border-top: 1px solid #d7d7d7;
    }
  }

  .form-control-group h3,
  .controls-stack h3 {
    margin-bottom: var(--size-16);
    padding-left: var(--ui-radius);
    font-weight: 400;
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

  .toggle-examples {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: var(--size-16);
    justify-content: center;
    min-height: 88px;
    box-sizing: border-box;
    padding: 16px 24px;
    border-radius: 16px;
    background: #ececeb;
  }

  .range-demo {
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--size-12);
    min-height: 88px;
    box-sizing: border-box;
    padding: 16px 24px;
    border-radius: 16px;
    background: #ececeb;
  }

  .button-row {
    display: flex;
    flex-direction: column;
    gap: var(--size-16);
    align-items: flex-start;
    justify-content: center;
    min-height: 180px;
    box-sizing: border-box;
    padding: 32px;
    border-radius: 16px;
    background: #ececeb;
  }

  .color-grid {
    min-height: 0;
    flex: 1;
    width: 100%;
    box-sizing: border-box;
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: 46% 27% 15% 12%;
    gap: 0;
    overflow: hidden;
    border: 1px solid #d7d7d7;
    border-radius: 16px;
  }

  @media (max-width: 640px) {
    .controls-top {
      grid-template-columns: 1fr;
    }
  }

  .color-swatch {
    min-height: 0;
    padding: 10px 16px;
    border-radius: 0;
    text-align: left;
    display: flex;
    flex-direction: row;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;

    span {
      font-family: var(--font-code);
      font-size: 1rem;
      font-weight: 600;
    }

    code {
      font-size: 0.75rem;
      opacity: 0.8;
    }

    &.primary {
      background-color: #ff5d0f;
      color: white;
    }
    &.background {
      background-color: #f6f6f6;
      color: var(--color-text);
    }
    &.background-tint {
      background-color: #ececeb;
      color: var(--color-text);
    }
    &.black {
      background-color: #000;
      color: white;
    }

    &.primary code,
    &.black code {
      color: white;
    }
  }

  .showcase-section:not(.showcase-header):not(.foundation-section):not(.elements-section) > h2 {
    margin: 0;
    padding: 28px clamp(28px, 4vw, 48px);
  }

  .specimen-code {
    min-width: 0;
    min-height: 180px;
    margin: 0;
    padding: 0;
    overflow: hidden;
    border: 1px solid
      color-mix(in srgb, var(--color-background-dark) 22%, transparent);
    border-radius: var(--ui-radius);
    background: #050708;
    box-shadow: none;

    &::before,
    &::after {
      display: none;
    }

    code {
      display: block;
      box-sizing: border-box;
      padding: var(--size-16) 0;
      overflow-x: auto;
      color: #e8e6dc;
      background: transparent;
      font-family: var(--font-code);
      line-height: 1.6;
      white-space: pre;
    }

    .line {
      display: block;
      min-height: 1.6em;
      padding-right: var(--size-16);
    }

    .line::before {
      content: attr(data-line);
      display: inline-block;
      width: 3ch;
      margin-right: var(--size-16);
      padding: 0 var(--size-12);
      border-right: 1px solid rgb(255 255 255 / 14%);
      color: #777d81;
      font-variant-numeric: tabular-nums;
      text-align: right;
      user-select: none;
    }

    .code-keyword {
      color: #ff7a3c;
    }

    .code-comment {
      color: #8a9296;
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
    padding: 0 clamp(28px, 4vw, 48px) clamp(28px, 4vw, 48px);
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

  @media (max-width: 1050px) {
    .showcase-header,
    .elements-section {
      grid-template-columns: 1fr;
    }

    .showcase-header {
      min-height: auto;
    }

    .hero-specimen {
      min-height: 320px;
    }

    .foundation-section,
    .palette-components-section {
      grid-template-columns: 1fr;
    }

    .color-aside {
      border-left: 0;
    }

    .cards-slots-aside {
      border-top: 1px solid #d7d7d7;
      border-left: 0;
    }

    .color-grid {
      min-height: 220px;
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: 1fr;
    }

    .oversized-section-title {
      min-height: 300px;
      grid-row: auto;
    }

    .controls-top > div:first-child,
    .controls-top > div:last-child,
    .form-control-group:nth-child(n) {
      border: 1px solid #d7d7d7;
      border-top: 0;
    }
  }

  @media (max-width: 700px) {
    .css-showcase {
      padding: 12px;
    }

    .showcase-section {
      margin-bottom: 32px;
    }

    .showcase-hero-copy,
    .foundation-main,
    .oversized-section-title {
      padding: 32px 24px;
    }

    .showcase-title,
    .oversized-section-title {
      font-size: clamp(64px, 22vw, 96px) !important;
    }

    .hero-specimen {
      min-height: 260px;
      margin: 12px;
      padding: 20px;
    }

    .hero-description {
      display: none;
    }

    .type-article {
      grid-template-columns: 1fr;
    }

    .color-grid {
      grid-template-columns: 1fr;
      grid-template-rows: none;
    }

    .cards-slots-stage {
      grid-template-columns: 1fr;
      padding: 28px;
    }

    .controls-stack {
      display: contents;
    }
  }
</style>
