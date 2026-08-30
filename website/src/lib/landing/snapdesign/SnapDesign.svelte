<script lang="ts">
  import MaterialControlPanel, {
    type MaterialControlTarget,
  } from "$lib/components/MaterialControlPanel.svelte";
  import Checkbox from "$lib/components/Checkbox.svelte";
  import Dial from "$lib/components/Dial.svelte";
  import MaterialSurface from "$lib/components/MaterialSurface.svelte";
  import Radio from "$lib/components/Radio.svelte";
  import SnapButton from "$lib/components/SnapButton.svelte";
  import Slider from "$lib/components/Slider.svelte";
  import Toggle from "$lib/components/Toggle.svelte";
  import {
    defaultButtonMaterialSettings,
    defaultDialMaterialSettings,
    defaultInsetSlotMaterialSettings,
    defaultRaisedCardMaterialSettings,
    defaultSliderMaterialSettings,
    defaultToggleMaterialSettings,
    type MaterialSettings,
  } from "$lib/components/materialSurface";
  import SnapDesignCodeTabs, {
    type SnapDesignCodeTab,
  } from "./SnapDesignCodeTabs.svelte";

  type MaterialTargetId =
    | "dial"
    | "button"
    | "toggle"
    | "slider"
    | "raisedCard"
    | "insetSlot";

  let {
    codeExamples,
  }: {
    codeExamples: {
      standalone: string;
      tabs: SnapDesignCodeTab[];
    };
  } = $props();

  let materialCheckboxChecked = $state(true);
  let materialRadioValue = $state("first");
  let rangeValue = $state(50);
  let precisionRangeValue = $state(50);
  let minimalCheckboxChecked = $state(true);
  let minimalRadioValue = $state("first");
  let minimalRangeValue = $state(50);
  let textValue = $state("");
  let numberValue = $state(42);
  let selectValue = $state("option1");
  let dateValue = $state("");
  const minimalProgressValue = 65;
  let dialValue = $state(320);
  let minimalDialValue = $state(40);
  let toggleEnabled = $state(true);
  let minimalToggleEnabled = $state(true);
  const materialTargets = [
    { id: "dial", label: "Dial" },
    { id: "button", label: "Button" },
    { id: "toggle", label: "Toggle" },
    { id: "slider", label: "Slider" },
    { id: "raisedCard", label: "Raised Card" },
    { id: "insetSlot", label: "Inset Slot" },
  ] satisfies MaterialControlTarget[];
  const materialDefaultConfigurations: Record<MaterialTargetId, MaterialSettings> = {
    dial: { ...defaultDialMaterialSettings },
    button: { ...defaultButtonMaterialSettings },
    toggle: { ...defaultToggleMaterialSettings },
    slider: { ...defaultSliderMaterialSettings },
    raisedCard: { ...defaultRaisedCardMaterialSettings },
    insetSlot: { ...defaultInsetSlotMaterialSettings },
  };
  const minimalDialMaterial: MaterialSettings = {
    lightAngle: 0,
    ambientBrightness: 1,
    shadowDistance: 0,
    shadowBlur: 0,
    shadowStrength: 0,
    specularIntensity: 0,
    specularPower: 1,
    rimWidth: 0,
    rimBlur: 0,
    creviceBrightness: 0,
    shadedRim: false,
    creviceOutline: true,
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
  const progressCellCount = 20;
  const progressCellIndexes = Array.from(
    { length: progressCellCount },
    (_, index) => index,
  );
  const brailleCellCount = 40;
  const brailleCellIndexes = Array.from(
    { length: brailleCellCount },
    (_, index) => index,
  );

  function filledProgressCells(value: number, max = 100, cellCount = progressCellCount) {
    const ratio = Math.max(0, Math.min(value / max, 1));
    return Math.round(ratio * cellCount);
  }

</script>

<div class="css-showcase">
    <section class="showcase-section showcase-header">
      <div class="showcase-hero-copy">
        <h1 class="showcase-title">Snap<br />Design</h1>
      </div>
      <div class="hero-specimen" aria-hidden="true"></div>
    </section>

    <section class="showcase-section foundation-section">
      <aside class="color-aside" id="colors">
        <h2>Color</h2>
        <div class="color-grid">
          <div class="color-swatch background"><span>Gray 01</span><code>#f6f6f6</code></div>
          <div class="color-swatch background-tint"><span>Gray 02</span><code>#ececeb</code></div>
          <div class="color-swatch black"><span>Black</span><code>#000000</code></div>
          <div class="color-swatch primary"><span>Primary</span><code>#ff5d0f</code></div>
        </div>
      </aside>

      <div class="foundation-main">
        <article class="type-article prose">
          <div class="type-grid">
            <div class="type-column primary-type-column">
              <p class="type-group-label">Heading</p>
              <div class="heading-stack">
                <h1>Heading 1</h1>
                <h2>Heading 2</h2>
                <h3>Heading 3</h3>
                <h4>Heading 4</h4>
                <h5>Heading 5</h5>
                <h6>Heading 6</h6>
              </div>

              <p class="number-specimen" aria-label="Number specimen: zero through nine">0123456789</p>
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
            </div>

            <div class="type-column code-column">
              <p class="type-group-label">Inline Elements</p>
              <p class="inline-elements">
                <a href="#ui-elements">Link</a>, <strong>strong</strong>,
                <em>emphasis</em>, <mark>highlight</mark>,
                <abbr title="Snap Design System">abbreviation</abbr>,
                <code>inlineCode()</code>, <kbd>⌘ K</kbd>,
                <samp>sample output</samp>, <del>deleted</del>,
                <ins>inserted</ins>, H<sub>2</sub>O, x<sup>2</sup>, and
                <small>small print</small>.
              </p>

              <div class="code-specimens">
                <div>
                  <p class="type-group-label">Code Block</p>
                  <div class="specimen-code" aria-label="Light code display example">
                    {@html codeExamples.standalone}
                  </div>
                </div>
                <div>
                  <p class="type-group-label">Tabbed Code</p>
                  <SnapDesignCodeTabs tabs={codeExamples.tabs} />
                </div>
              </div>
            </div>
          </div>
        </article>
      </div>
    </section>

    <section class="showcase-section elements-section" id="ui-elements">
      <div class="elements-grid">
        <header class="oversized-section-title">
          <h2>UI<br />Elements</h2>
        </header>

        <article class="element-card control-card buttons-card">
          <header class="control-card-heading"><span class="control-index" aria-hidden="true">01</span><h3>Buttons</h3></header>
          <div class="control-stage variant-stage">
            <div class="control-variant button-stack" role="group" aria-label="Skeuomorphic buttons">
              <SnapButton material={materialConfigurations.button}>Default</SnapButton>
              <SnapButton material={materialConfigurations.button} className="primary">Primary</SnapButton>
              <SnapButton material={materialConfigurations.button} className="active" aria-pressed="true">Active</SnapButton>
            </div>
            <div class="control-variant button-stack" role="group" aria-label="Minimal buttons">
              <button type="button" class="minimal-button">Default</button>
              <button type="button" class="minimal-button primary">Primary</button>
              <button type="button" class="minimal-button active" aria-pressed="true">Active</button>
            </div>
          </div>
        </article>

        <article class="element-card control-card dial-card">
          <header class="control-card-heading"><span class="control-index" aria-hidden="true">05</span><h3>Dial</h3></header>
          <div class="control-stage variant-stage dial-stage">
            <div class="control-variant dial-stack" role="group" aria-label="Skeuomorphic dial">
              <Dial size={88} step={10} bind:value={dialValue} material={materialConfigurations.dial} aria-label="Skeuomorphic dial" />
            </div>
            <div class="control-variant dial-stack" role="group" aria-label="Minimal dial">
              <Dial size={88} step={10} bind:value={minimalDialValue} material={minimalDialMaterial} aria-label="Minimal dial" />
            </div>
          </div>
        </article>

        <article class="element-card control-card sliders-card">
          <header class="control-card-heading"><span class="control-index" aria-hidden="true">02</span><h3>Sliders</h3></header>
          <div class="control-stage variant-stage slider-variants-stage">
            <div class="control-variant slider-stack" role="group" aria-label="Skeuomorphic sliders">
              <Slider id="material-range" min={0} max={100} step={10} markers="dots" width={150} bind:value={rangeValue} material={materialConfigurations.slider} aria-label="Skeuomorphic slider" />
            </div>
            <div class="control-variant slider-stack" role="group" aria-label="Minimal sliders">
              <input id="minimal-range" class="minimal-range" type="range" min="0" max="100" bind:value={minimalRangeValue} aria-label="Minimal slider" />
            </div>
            <div class="control-variant precision-slider-stack">
              <Slider id="precision-range" min={0} max={100} step={1} markers="precision" fluid bind:value={precisionRangeValue} material={materialConfigurations.slider} aria-label="Precision slider" />
            </div>
          </div>
        </article>

        <article class="element-card control-card selection-card">
          <header class="control-card-heading"><span class="control-index" aria-hidden="true">03</span><h3>Selection</h3></header>
          <div class="control-stage variant-stage">
            <div class="control-variant choice-stack" role="group" aria-label="Skeuomorphic selection controls">
              <div class="toggle-demo"><Toggle bind:checked={toggleEnabled} material={materialConfigurations.toggle} aria-label="Skeuomorphic toggle" /><span>{toggleEnabled ? "On" : "Off"}</span></div>
              <label class="checkbox-label"><Checkbox bind:checked={materialCheckboxChecked} material={materialConfigurations.toggle} />Checkbox</label>
              <label class="radio-label"><Radio name="material-radio" value="first" bind:group={materialRadioValue} material={materialConfigurations.toggle} />First</label>
              <label class="radio-label"><Radio name="material-radio" value="second" bind:group={materialRadioValue} material={materialConfigurations.toggle} />Second</label>
            </div>
            <div class="control-variant choice-stack minimal-choices" role="group" aria-label="Minimal selection controls">
              <label class="minimal-toggle"><input type="checkbox" bind:checked={minimalToggleEnabled} /><span aria-hidden="true"></span><span>{minimalToggleEnabled ? "On" : "Off"}</span></label>
              <label class="minimal-checkbox"><input type="checkbox" bind:checked={minimalCheckboxChecked} /><span class="minimal-checkbox-box" aria-hidden="true"></span><span>Checkbox</span></label>
              <label class="minimal-radio"><input type="radio" name="minimal-radio" value="first" bind:group={minimalRadioValue} /><span class="minimal-radio-ring" aria-hidden="true"></span><span>First</span></label>
              <label class="minimal-radio"><input type="radio" name="minimal-radio" value="second" bind:group={minimalRadioValue} /><span class="minimal-radio-ring" aria-hidden="true"></span><span>Second</span></label>
            </div>
          </div>
        </article>

        <article class="element-card control-card progress-card">
          <header class="control-card-heading"><span class="control-index" aria-hidden="true">04</span><h3>Progress</h3></header>
          <div class="control-stage progress-stage">
            <div class="progress-stack" role="group" aria-label="Minimal progress">
              <div class="ascii-progress">
                <progress class="ascii-progress-native" id="minimal-progress" value={minimalProgressValue} max="100"></progress>
                <span class="ascii-progress-visual" aria-hidden="true">
                  <span>├</span>
                  <span class="ascii-progress-cells">
                    {#each progressCellIndexes as index}
                      <span class:ascii-progress-filled={index < filledProgressCells(minimalProgressValue)} class:ascii-progress-empty={index >= filledProgressCells(minimalProgressValue)}>{index < filledProgressCells(minimalProgressValue) ? "■" : "□"}</span>
                    {/each}
                  </span>
                  <span>┤</span>
                </span>
                <span class="ascii-progress-value" aria-hidden="true">{minimalProgressValue}%</span>
              </div>
              <div class="ascii-progress loading-progress">
                <progress class="ascii-progress-native" id="loading-progress" max="100" aria-label="Loading"></progress>
                <span class="ascii-loading-visual" aria-hidden="true">
                  <span>├</span>
                  <span class="ascii-loading-cells">
                    {#each progressCellIndexes as index}
                      <span class="ascii-loading-cell" style:animation-delay={`${index * -55}ms`}>│</span>
                    {/each}
                  </span>
                  <span>┤</span>
                </span>
              </div>
              <div class="ascii-progress braille-progress">
                <progress class="ascii-progress-native" id="braille-progress" value={minimalProgressValue} max="100" aria-label="Braille progress"></progress>
                <span class="ascii-progress-visual braille-progress-visual" aria-hidden="true">
                  <span>⡇</span>
                  <span class="ascii-progress-cells braille-progress-cells">
                    {#each brailleCellIndexes as index}
                      <span class:ascii-progress-filled={index < filledProgressCells(minimalProgressValue, 100, brailleCellCount)} class:ascii-progress-empty={index >= filledProgressCells(minimalProgressValue, 100, brailleCellCount)}>{index < filledProgressCells(minimalProgressValue, 100, brailleCellCount) ? "⣿" : "⣀"}</span>
                    {/each}
                  </span>
                  <span>⢸</span>
                </span>
                <span class="ascii-progress-value" aria-hidden="true">{minimalProgressValue}%</span>
              </div>
              <div class="ascii-progress braille-loading-progress">
                <progress class="ascii-progress-native" id="braille-loading-progress" max="100" aria-label="Braille loading"></progress>
                <span class="ascii-loading-visual braille-loading-visual" aria-hidden="true">
                  <span>⡇</span>
                  <span class="ascii-loading-cells braille-loading-cells">
                    {#each brailleCellIndexes as index}
                      <span class="braille-loading-cell" style:animation-delay={`${index * -28}ms`}></span>
                    {/each}
                  </span>
                  <span>⢸</span>
                </span>
              </div>
            </div>
          </div>
        </article>

        <article class="element-card form-control-group dropdown-card">
          <header class="control-card-heading"><span class="control-index" aria-hidden="true">06</span><h3>Dropdowns</h3></header>
          <div class="form-group">
            <label for="select-default">Default Select</label>
            <select id="select-default" bind:value={selectValue}>
              <option value="option1">Option One</option>
              <option value="option2">Option Two</option>
              <option value="option3">Option Three</option>
            </select>
          </div>
          <div class="form-group">
            <label for="select-grouped">Grouped Options</label>
            <select id="select-grouped">
              <optgroup label="Category A"><option>Item A1</option><option>Item A2</option></optgroup>
              <optgroup label="Category B"><option>Item B1</option><option>Item B2</option></optgroup>
            </select>
          </div>
          <div class="form-group">
            <label for="select-icons">Dropdown with Icons</label>
            <select id="select-icons" class="select-with-icons">
              <button>
                <selectedcontent></selectedcontent>
              </button>
              <option value="palette" selected>
                <span class="material-symbols-rounded" aria-hidden="true">palette</span>
                <span>Design</span>
              </option>
              <option value="code">
                <span class="material-symbols-rounded" aria-hidden="true">code</span>
                <span>Development</span>
              </option>
              <option value="animation">
                <span class="material-symbols-rounded" aria-hidden="true">animation</span>
                <span>Motion</span>
              </option>
            </select>
          </div>
        </article>

        <article class="element-card form-control-group">
          <header class="control-card-heading"><span class="control-index" aria-hidden="true">07</span><h3>Date Selectors</h3></header>
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
        </article>

        <article class="element-card form-control-group">
          <header class="control-card-heading"><span class="control-index" aria-hidden="true">08</span><h3>Text Inputs</h3></header>
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
        </article>

        <article class="element-card control-card chips-card">
          <header class="control-card-heading"><span class="control-index" aria-hidden="true">09</span><h3>Chips</h3></header>
          <div class="control-stage shared-stage chip-board">
            <span class="chip chip-ready">Ready</span>
            <span class="chip chip-active">Active</span>
            <span class="chip chip-warning">Needs read</span>
            <span class="chip chip-draft">Draft</span>
            <span class="chip chip-muted">Disabled</span>
            <span class="chip chip-code">READ_1</span>
          </div>
        </article>

      </div>
    </section>

    <section class="showcase-section layout-section">
      <header class="section-heading">
        <h2>Layout</h2>
      </header>
      <div class="layout-grid">
        <article class="layout-card container-card">
          <div class="cards-slots-stage">
            <MaterialSurface depth="raised" shape="rounded" radius={16} material={materialConfigurations.raisedCard} className="specimen-card">
              <h3>Raised<br />cards</h3>
            </MaterialSurface>
            <MaterialSurface depth="recessed" shape="rounded" radius={16} material={materialConfigurations.insetSlot} className="specimen-slot">
              <div class="slot-content">
                <h3>Inset Slot</h3>
              </div>
            </MaterialSurface>
            <div class="compact-specimen"><div class="compact-card"><h3>Simple<br />card</h3></div></div>
            <div class="compact-specimen"><div class="compact-slot"><h3>Simple<br />slot</h3></div></div>
          </div>
        </article>

        <article class="layout-card table-card">
          <h3>Table</h3>
          <div class="table-shell">
            <table>
              <thead><tr><th>Asset</th><th>Status</th><th>Updated</th></tr></thead>
              <tbody>
                <tr><td>SnapSort</td><td><span class="chip chip-ready">Ready</span></td><td>Today</td></tr>
                <tr><td>SnapLine</td><td><span class="chip chip-draft">Draft</span></td><td>This week</td></tr>
                <tr><td>SnapZap</td><td><span class="chip chip-muted">Queued</span></td><td>Later</td></tr>
              </tbody>
            </table>
          </div>
        </article>
      </div>
    </section>

    <details class="material-editor">
      <summary>
        <span>Material editor</span>
        <small>Advanced surface controls</small>
      </summary>
      <div class="material-panel-section">
        <MaterialControlPanel
          targets={materialTargets}
          defaults={materialDefaultConfigurations}
          bind:configurations={materialConfigurations}
          bind:selectedTarget={selectedMaterialTarget}
        />
      </div>
    </details>
</div>


<style lang="scss">
  .css-showcase {
    width: 100%;
    min-height: 100%;
    box-sizing: border-box;
    padding: clamp(18px, 3vw, 44px);
    background: #f6f6f6;
  }

  .showcase-section,
  .material-editor {
    width: min(1400px, 100%);
    margin-inline: auto;
    margin-bottom: clamp(32px, 5vw, 60px);
    box-sizing: border-box;
  }

  .showcase-section {
    border: 1px solid #d7d7d7;
  }

  .showcase-header {
    display: grid;
    grid-template-columns: minmax(0, 0.85fr) minmax(380px, 1.15fr);
    min-height: clamp(300px, 43vw, 520px);
    align-items: stretch;
  }

  .showcase-hero-copy {
    display: flex;
    min-width: 0;
    align-items: center;
    padding: clamp(40px, 7vw, 96px);
  }

  .hero-specimen {
    min-width: 0;
    margin: clamp(18px, 2.5vw, 34px);
    border-radius: var(--size-16);
    background: #ececeb;
  }

  .showcase-title {
    margin: 0;
    color: #080808;
    font-family: "Geist", sans-serif;
    font-size: clamp(72px, 11vw, 156px);
    font-weight: 500;
    letter-spacing: -0.075em;
    line-height: 0.86;
  }

  .foundation-section {
    display: grid;
    grid-template-columns: minmax(240px, 0.62fr) minmax(0, 2.38fr);
    gap: 0;
    align-items: stretch;
  }

  .foundation-main,
  .color-aside {
    min-width: 0;
    box-sizing: border-box;
  }

  .foundation-main {
    padding: clamp(36px, 4.5vw, 64px);
  }

  .color-aside {
    padding: clamp(24px, 2.5vw, 36px) clamp(18px, 2vw, 28px);
  }

  .type-article {
    width: 100%;
    margin: 0;
  }

  .number-specimen {
    margin: clamp(40px, 5vw, 64px) 0 var(--size-32) !important;
    overflow-wrap: anywhere;
    color: #080808;
    font-family: "Zen Dots", sans-serif;
    font-size: clamp(1.65rem, 3vw, 3.25rem);
    font-weight: 400;
    line-height: 1;
  }

  .type-grid {
    display: grid;
    grid-template-columns: minmax(0, 0.82fr) minmax(420px, 1.18fr);
    gap: clamp(40px, 5vw, 72px);
    align-items: start;
  }

  .code-specimens {
    display: flex;
    flex-direction: column;
    gap: var(--size-24);
    margin-top: clamp(36px, 4vw, 52px);
  }

  .type-column {
    min-width: 0;

    > :last-child {
      margin-bottom: 0;
    }

    h1,
    h2,
    h3,
    h4,
    h5,
    h6 {
      margin: 0;
      font-family: var(--font-label);
      font-weight: 400;
      letter-spacing: 0;
      line-height: 1;
    }

    h1 {
      font-size: clamp(44px, 4.5vw, 68px);
    }

    h2 {
      font-size: clamp(34px, 3.5vw, 50px);
    }

    h3 {
      font-size: 25px;
    }

    h4 {
      font-size: 21px;
    }

    h5 {
      font-size: 19px;
    }

    h6 {
      font-size: 17px;
    }
  }

  .type-group-label {
    margin: 0 0 var(--size-12) !important;
    color: var(--color-primary);
    font-family: var(--font-label);
    font-size: 0.86rem;
    line-height: 1;
    text-transform: uppercase;
  }

  .heading-stack {
    display: flex;
    flex-direction: column;
    gap: var(--size-12);
  }

  .type-column > hr {
    margin: var(--size-32) 0;
    border: 0;
    border-top: 1px solid #d7d7d7;
  }

  .type-column blockquote {
    margin: var(--size-24) 0;
    padding-left: var(--size-20);
    border-left: 2px solid var(--color-primary);

    p {
      margin-bottom: var(--size-8);
    }

    cite {
      color: var(--color-text-muted);
      font-family: var(--font-code);
      font-size: 0.75rem;
      font-style: normal;
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

  .specimen-code {
    min-width: 0;
    overflow: hidden;
    border: 1px solid #d7d7d7;
    border-radius: var(--ui-radius);
    background: #fff;

    :global(pre.shiki.display) {
      margin: 0;
      padding: 0;
      overflow: hidden;
      border: 0;
      border-radius: 0;
      background: #fff !important;
      box-shadow: none;
    }

    :global(pre.shiki.display::before),
    :global(pre.shiki.display::after) {
      display: none;
    }

    :global(pre.shiki.display code) {
      display: block;
      box-sizing: border-box;
      padding: var(--size-16) 0;
      overflow-x: auto;
      background: transparent !important;
      line-height: 1.6;
    }

    :global(.line::before) {
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
  }

  .color-aside {
    display: flex;
    flex-direction: column;
    border-right: 1px solid #d7d7d7;

    > h2 {
      margin: 0 0 var(--size-20);
      padding-left: var(--ui-radius);
      font-family: var(--font-label);
      font-size: 28px;
      font-weight: 400;
    }
  }

  .color-grid {
    display: grid;
    flex: 1;
    min-height: 520px;
    grid-template-rows: 42% 28% 16% 14%;
    overflow: hidden;
    border: 1px solid #d7d7d7;
    border-radius: var(--size-16);
  }

  .color-swatch {
    display: flex;
    min-height: 0;
    align-items: flex-end;
    justify-content: space-between;
    gap: var(--size-12);
    padding: var(--size-12) var(--size-16);

    span {
      font-family: var(--font-code);
      font-weight: 600;
    }

    code {
      font-size: 0.75rem;
      opacity: 0.8;
    }

    &.background {
      color: var(--color-text);
      background: #f6f6f6;
    }

    &.background-tint {
      color: var(--color-text);
      background: #ececeb;
    }

    &.black {
      color: #fff;
      background: #000;
    }

    &.primary {
      color: #fff;
      background: var(--color-primary);
    }

    &.black code,
    &.primary code {
      color: #fff;
    }
  }

  .elements-section {
    border: 0;
  }

  .elements-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 1px;
    padding: 1px;
    background: #d7d7d7;
  }

  .oversized-section-title,
  .element-card {
    min-width: 0;
    box-sizing: border-box;
    background: #f6f6f6;
  }

  .oversized-section-title {
    container-type: inline-size;
    display: flex;
    min-height: 390px;
    align-items: center;
    padding: clamp(28px, 4vw, 64px);
    overflow: hidden;

    h2 {
      max-width: 100%;
      margin: 0;
      color: #080808;
      font-family: "Geist", sans-serif;
      font-size: clamp(3.1rem, 18cqi, 7rem);
      font-weight: 500;
      letter-spacing: -0.07em;
      line-height: 0.88;
    }
  }

  .element-card {
    padding: clamp(22px, 2.5vw, 34px);
  }

  .control-card {
    container-type: inline-size;
    min-height: 390px;
  }

  .sliders-card {
    grid-column: span 2;
  }

  .control-card-heading {
    display: flex;
    align-items: flex-start;
    gap: var(--size-12);
    margin-bottom: var(--size-20);

    h3 {
      margin: 0;
      font-family: var(--font-label);
      font-size: 1.05rem;
      font-weight: 400;
      letter-spacing: 0;
      line-height: 1;
    }
  }

  .control-index {
    color: #080808;
    font-family: "Zen Dots", sans-serif;
    font-size: clamp(2.25rem, 3vw, 3rem);
    font-weight: 400;
    line-height: 0.8;
  }

  .control-stage {
    min-height: 270px;
    padding: clamp(20px, 6cqi, 32px);
    border-radius: var(--size-16);
    background: #ececeb;
    box-sizing: border-box;
  }

  .variant-stage {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: clamp(18px, 5cqi, 30px);
  }

  .control-variant {
    display: flex;
    min-width: 0;
    flex-direction: column;
    justify-content: center;
    gap: var(--size-12);
  }

  .button-stack {
    align-items: center;
  }

  .slider-stack {
    align-items: flex-start;
  }

  .slider-variants-stage {
    align-items: center;
  }

  .precision-slider-stack {
    grid-column: span 1;
    width: 100%;
    padding-top: clamp(18px, 4cqi, 28px);
    border-top: 1px solid color-mix(
      in srgb,
      var(--color-background-dark) 18%,
      transparent
    );
    box-sizing: border-box;
  }

  .toggle-demo > span {
    color: var(--color-background-dark);
    font-family: var(--font-code);
    font-size: 0.9rem;
  }

  .dial-stage {
    align-items: center;
  }

  .dial-stack {
    align-items: center;
  }

  .toggle-demo,
  .choice-stack label,
  .minimal-toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--size-8);
  }

  .checkbox-label,
  .radio-label {
    padding: 2px var(--size-4);
  }

  .radio-label {
    cursor: pointer;
  }

  .minimal-button {
    --minimal-button-background: #fff;
    --minimal-button-interaction-color: #000;

    min-height: 38px;
    padding: 10px 14px 8px;
    border: 1px solid #d7d7d7;
    border-radius: 8px;
    background: var(--minimal-button-background);
    color: #000;
    font: inherit;
    font-family: var(--font-label);
    font-weight: 400;
    cursor: pointer;
    transition: background-color 120ms ease;

    &.primary {
      --minimal-button-background: var(--color-primary);
      --minimal-button-interaction-color: #fff;
      color: #fff;
    }

    &.active {
      --minimal-button-background: #000;
      --minimal-button-interaction-color: #fff;
      color: #fff;
    }

    &:hover:not(:disabled) {
      background: color-mix(
        in srgb,
        var(--minimal-button-background) 92%,
        var(--minimal-button-interaction-color) 8%
      );
    }

    &:active:not(:disabled) {
      background: color-mix(
        in srgb,
        var(--minimal-button-background) 84%,
        var(--minimal-button-interaction-color) 16%
      );
    }

    &.primary:hover:not(:disabled),
    &.active:hover:not(:disabled) {
      background: color-mix(in srgb, var(--minimal-button-background) 84%, #fff 16%);
    }

    &.primary:active:not(:disabled),
    &.active:active:not(:disabled) {
      background: color-mix(in srgb, var(--minimal-button-background) 72%, #fff 28%);
    }

    &:disabled {
      border-color: #8a8a8a;
      color: #737373;
      cursor: not-allowed;
    }
  }

  .minimal-toggle {
    display: inline-flex;
    align-items: center;
    gap: var(--size-8);

    input + span {
      width: 42px !important;
      height: 22px !important;
      box-sizing: border-box;
      border: 1px solid #b8b8b8 !important;
      border-radius: 999px !important;
      background: transparent !important;
      box-shadow: none !important;

      &::before {
        content: "" !important;
        top: 2px !important;
        left: 2px !important;
        width: 18px !important;
        height: 18px !important;
        border: 0 !important;
        border-radius: 50% !important;
        background: var(--color-primary) !important;
        box-shadow: none !important;
        transform: none !important;
        transition: left 120ms ease !important;
      }

      &::after {
        display: none !important;
      }
    }

    input:checked + span::before {
      left: 22px !important;
    }
  }

  .minimal-range {
    width: 100%;
    height: 12px;
    box-sizing: border-box;
    padding: 1px;
    appearance: none;
    border: 1px solid #b8b8b8;
    border-radius: 999px;
    background: transparent;
    box-shadow: none;

    &::-webkit-slider-thumb {
      width: 8px;
      height: 8px;
      appearance: none;
      border: 0;
      border-radius: 50%;
      background: var(--color-primary);
      box-shadow: none;
    }

    &::-moz-range-thumb {
      width: 8px;
      height: 8px;
      border: 0;
      border-radius: 50%;
      background: var(--color-primary);
      box-shadow: none;
    }

    &:disabled {
      opacity: 0.42;
      cursor: not-allowed;
    }
  }

  .minimal-choices {
    label {
      display: inline-grid;
      grid-template-columns: 42px auto;
      align-items: center;
      gap: var(--size-8);
    }

    .minimal-checkbox-box,
    .minimal-radio-ring {
      display: inline-grid !important;
      width: 18px !important;
      height: 18px !important;
      box-sizing: border-box;
      justify-self: center;
      place-items: center;
      border: 1px solid #b8b8b8 !important;
      background: transparent !important;
      box-shadow: none !important;
      position: relative;
    }

    .minimal-checkbox-box {
      border-radius: 3px !important;
    }

    .minimal-radio-ring {
      border-radius: 50% !important;
    }

    .minimal-checkbox-box::before,
    .minimal-radio-ring::after {
      display: none !important;
    }

    .minimal-checkbox-box::after,
    .minimal-radio-ring::before {
      content: "" !important;
      position: static !important;
      inset: auto !important;
      display: block !important;
      width: 14px !important;
      height: 14px !important;
      border: 0 !important;
      border-radius: 2px !important;
      background: var(--color-primary) !important;
      box-shadow: none !important;
      opacity: 0;
      transform: none !important;
    }

    .minimal-radio-ring::before {
      border-radius: 50% !important;
    }

    .minimal-checkbox input:checked + .minimal-checkbox-box::after,
    .minimal-radio input:checked + .minimal-radio-ring::before {
      opacity: 1;
    }
  }

  .form-control-group {
    .form-group:last-child {
      margin-bottom: 0;
    }

    input[type="text"],
    input[type="number"],
    input[type="date"],
    input[type="datetime-local"],
    input[type="time"],
    select {
      width: 100%;
      min-height: 38px;
    }
  }

  :global(.css-showcase .dropdown-card select::picker(select)) {
    padding-block: var(--size-8);
    border: 1px solid rgb(0 0 0 / 24%);
    border-radius: var(--ui-radius);
    background: #fff;
    box-shadow: 0 3px 10px rgb(36 38 39 / 5%);
  }

  .dropdown-card select {
    padding-inline-start: var(--size-16);
  }

  :global(.css-showcase .dropdown-card #select-grouped::picker(select)) {
    padding-block: var(--size-16);
  }

  .dropdown-card select option {
    background: transparent;
    color: var(--color-text);
    font-family: "Geist", sans-serif;
    font-size: 1rem;
    font-weight: 400;
    text-indent: 0;
  }

  .dropdown-card select option:hover,
  .dropdown-card select option:focus-visible {
    background: #ececeb;
  }

  .dropdown-card select optgroup {
    color: rgb(0 0 0 / 58%);
    font-family: var(--font-label);
    font-size: 0.9rem;
    font-weight: 400;
    text-indent: var(--size-8);
  }

  .dropdown-card select optgroup + optgroup {
    margin-top: var(--size-24);
  }

  .dropdown-card .select-with-icons .material-symbols-rounded {
    flex: 0 0 auto;
    color: var(--color-primary);
    font-family: "Material Symbols Rounded";
    font-size: 1.15rem;
    font-style: normal;
    font-weight: 500;
    line-height: 1;
  }

  .progress-card .control-stage {
    display: flex;
    min-height: 240px;
    align-items: center;
  }

  .progress-stack {
    display: flex;
    width: 100%;
    flex-direction: column;
    gap: clamp(34px, 8cqi, 48px);
  }

  .ascii-progress {
    position: relative;
    width: 100%;
    min-width: 0;
  }

  .ascii-progress-native {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0 0 0 0);
    clip-path: inset(50%);
    white-space: nowrap;
  }

  .ascii-progress-visual {
    display: grid;
    width: 100%;
    min-width: 0;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 3px;
    color: #000;
    font-family: var(--font-code);
    font-size: clamp(0.62rem, 2.6cqi, 0.92rem);
    white-space: nowrap;
  }

  .ascii-progress-cells {
    display: grid;
    width: 100%;
    min-width: 0;
    grid-template-columns: repeat(20, minmax(0, 1fr));
    align-items: center;
    text-align: center;
  }

  .ascii-progress-filled {
    color: #000;
  }

  .ascii-progress-empty,
  .ascii-progress-value {
    color: #777;
  }

  .ascii-progress-value {
    position: absolute;
    z-index: 1;
    top: 50%;
    left: 50%;
    margin: 0;
    padding: 0 5px;
    background: #ececeb;
    color: #000;
    font-family: var(--font-code);
    font-size: 0.78rem;
    line-height: 1;
    transform: translate(-50%, -50%);
  }

  .ascii-loading-visual {
    display: grid;
    width: 100%;
    min-width: 0;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 3px;
    color: #000;
    font-family: var(--font-code);
    font-size: clamp(0.62rem, 2.6cqi, 0.92rem);
    line-height: 1;
    white-space: nowrap;
  }

  .ascii-loading-cells {
    display: grid;
    height: 1.5em;
    grid-template-columns: repeat(20, minmax(0, 1fr));
    align-items: center;
    text-align: center;
  }

  .ascii-loading-cell {
    display: inline-block;
    line-height: 1;
    transform: scaleY(0.18);
    transform-origin: center;
    animation: ascii-loading-wave 1.1s ease-in-out infinite;
  }

  .braille-progress-cells,
  .braille-loading-cells {
    grid-template-columns: repeat(40, minmax(0, 1fr));
    gap: 0;
    letter-spacing: -0.1em;
  }

  .braille-loading-cell {
    display: inline-block;
    line-height: 1;
    text-align: center;
  }

  .braille-loading-cell::before {
    content: "⠒";
    animation: braille-loading-wave 1.1s steps(1, end) infinite;
    animation-delay: inherit;
  }

  @keyframes ascii-loading-wave {
    0%,
    100% {
      opacity: 0.38;
      transform: scaleY(0.18);
    }

    50% {
      opacity: 1;
      transform: scaleY(1.35);
    }
  }

  @keyframes braille-loading-wave {
    0%,
    100% {
      content: "⠒";
      opacity: 0.38;
    }

    20%,
    80% {
      content: "⠛";
      opacity: 0.58;
    }

    38%,
    62% {
      content: "⠿";
      opacity: 0.78;
    }

    50% {
      content: "⣿";
      opacity: 1;
    }
  }

  .chip-board {
    display: flex;
    flex-wrap: wrap;
    gap: var(--size-8);
    align-content: flex-start;
  }

  .shared-stage {
    align-items: flex-start;
  }

  .layout-section {
    min-height: clamp(680px, 68vw, 940px);
    padding: clamp(32px, 4vw, 64px);
  }

  .section-heading {
    display: flex;
    min-height: clamp(220px, 25vw, 360px);
    align-items: flex-start;

    h2 {
      margin: 0;
      color: #080808;
      font-family: "Geist", sans-serif;
      font-size: clamp(76px, 10vw, 148px);
      font-weight: 500;
      letter-spacing: -0.065em;
      line-height: 0.9;
    }
  }

  .layout-grid {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.28fr);
    gap: clamp(28px, 4vw, 64px);
    align-items: stretch;
  }

  .layout-card {
    min-width: 0;
    min-height: clamp(340px, 32vw, 470px);

    > h3 {
      margin: 0 0 var(--size-20);
      font-family: var(--font-label);
      font-weight: 400;
    }
  }

  .container-card {
    display: flex;
  }

  .cards-slots-stage {
    display: grid;
    width: 100%;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    grid-template-rows: repeat(2, minmax(0, 1fr));
    gap: var(--size-16);
  }

  :global(.specimen-slot) {
    display: flex;
    width: 100%;
    min-height: 0;
    align-items: flex-start !important;
    justify-content: flex-start !important;
  }

  :global(.specimen-card) {
    --material-content-direction: column;
    --material-content-gap: 12px;
    --material-content-padding: clamp(22px, 2.5vw, 34px);
    align-items: flex-start !important;
    justify-content: flex-start !important;
    box-sizing: border-box;
  }

  .cards-slots-stage .slot-content {
    display: flex;
    width: 100%;
    flex-direction: column;
    justify-content: flex-start;
    gap: var(--size-12);
    box-sizing: border-box;
    padding: clamp(22px, 2.5vw, 34px);
  }

  .cards-slots-stage :global(h3),
  .compact-specimen h3 {
    margin: 0;
    padding-left: var(--ui-radius);
    font-weight: 400;
  }

  .compact-specimen {
    display: flex;
    min-width: 0;
    flex-direction: column;
    justify-content: stretch;
  }

  .compact-card,
  .compact-slot {
    display: flex;
    min-height: 100%;
    flex-direction: column;
    justify-content: flex-start;
    gap: var(--size-12);
    padding: clamp(22px, 2.5vw, 34px);
    box-sizing: border-box;
    border-radius: var(--size-16);
  }

  .compact-card {
    border: 0;
    background: #ececeb;
    box-shadow: none;
  }

  .compact-slot {
    border: 0;
    background: #ececeb;
  }

  .table-card {
    display: flex;
    flex-direction: column;
    padding: clamp(22px, 2.5vw, 34px);
    border-radius: var(--size-16);
    background: #ececeb;
  }

  .table-card .table-shell {
    flex: 1;
    border: 1px solid #e2e2e2;
  }

  .table-card table {
    min-width: 430px;
  }

  .material-editor {
    border: 1px solid #d7d7d7;
    background: #f6f6f6;

    > summary {
      display: flex;
      min-height: 68px;
      align-items: center;
      justify-content: space-between;
      gap: var(--size-16);
      padding: var(--size-16) clamp(20px, 3vw, 36px);
      box-sizing: border-box;
      cursor: pointer;
      list-style: none;
      font-family: var(--font-label);
      font-size: 1.1rem;

      &::-webkit-details-marker {
        display: none;
      }

      &::after {
        content: "+";
        color: var(--color-primary);
        font-family: var(--font-code);
        font-size: 1.5rem;
      }

      small {
        margin-left: auto;
        color: var(--color-text-muted);
        font-family: var(--font-code);
        font-size: 0.75rem;
        font-weight: 400;
      }
    }

    &[open] > summary {
      border-bottom: 1px solid #d7d7d7;

      &::after {
        content: "−";
      }
    }
  }

  .material-panel-section {
    padding: clamp(16px, 2vw, 28px);
  }

  .material-panel-section > :global(.material-control-panel) {
    width: 100%;
    margin: 0;
    box-sizing: border-box;
  }

  @media (max-width: 1050px) {
    .showcase-header {
      grid-template-columns: 1fr;
    }

    .hero-specimen {
      min-height: 260px;
      margin-top: 0;
    }

    .foundation-section {
      grid-template-columns: 1fr;
    }

    .color-aside {
      border-right: 0;
      border-bottom: 1px solid #d7d7d7;
    }

    .color-grid {
      min-height: 230px;
      grid-template-columns: repeat(4, 1fr);
      grid-template-rows: 1fr;
    }

    .elements-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .oversized-section-title {
      grid-column: 1 / -1;
      min-height: 320px;
    }

    .layout-grid {
      grid-template-columns: 1fr;
    }

    .container-card {
      grid-column: auto;
    }
  }

  @media (max-width: 850px) {
    .type-grid {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 700px) {
    .css-showcase {
      padding: var(--size-12);
    }

    .showcase-header {
      min-height: 0;
    }

    .showcase-hero-copy {
      padding: var(--size-32) var(--size-24);
    }

    .showcase-title {
      font-size: clamp(64px, 23vw, 96px);
    }

    .hero-specimen {
      min-height: 200px;
      margin: 0 var(--size-12) var(--size-12);
    }

    .type-grid,
    .elements-grid {
      grid-template-columns: 1fr;
    }

    .sliders-card {
      grid-column: auto;
    }

    .foundation-main,
    .color-aside {
      padding: var(--size-24);
    }

    .color-grid {
      min-height: 360px;
      grid-template-columns: 1fr;
      grid-template-rows: repeat(4, minmax(80px, 1fr));
    }

    .oversized-section-title {
      min-height: 250px;
    }

    .variant-stage {
      grid-template-columns: 1fr;
    }

    .cards-slots-stage {
      grid-template-columns: 1fr;
      padding: var(--size-24);
    }

    .section-heading {
      align-items: start;
      flex-direction: column;
      gap: var(--size-4);
    }

    .material-editor > summary small {
      display: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .ascii-loading-cell {
      animation: none;
      opacity: 0.72;
      transform: scaleY(0.5);
    }

    .braille-loading-cell::before {
      content: "⠿";
      animation: none;
      opacity: 0.72;
    }

    .minimal-toggle input + span::before {
      transition: none !important;
    }

    .minimal-button {
      transition: none;
    }
  }
</style>
