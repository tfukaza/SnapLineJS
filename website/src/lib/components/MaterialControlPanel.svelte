<script lang="ts">
  import Dial from "./Dial.svelte";
  import MaterialSurface from "./MaterialSurface.svelte";
  import Slider from "./Slider.svelte";
  import SnapButton from "./SnapButton.svelte";
  import Toggle from "./Toggle.svelte";
  import {
    defaultCreviceFreeMaterialSettings,
    defaultMaterialSettings,
    type MaterialSettings,
  } from "./materialSurface";

  export type MaterialControlTarget = {
    id: string;
    label: string;
  };

  type MaterialControlPanelProps = {
    targets: MaterialControlTarget[];
    configurations: Record<string, MaterialSettings>;
    defaults?: Record<string, MaterialSettings>;
    selectedTarget?: string;
  };

  let {
    targets,
    configurations = $bindable(),
    defaults,
    selectedTarget = $bindable("button"),
  }: MaterialControlPanelProps = $props();

  let copyStatus = $state("");
  let previewToggleChecked = $state(true);
  let previewSliderValue = $state(58);
  const selectedLabel = $derived(
    targets.find((target) => target.id === selectedTarget)?.label ?? selectedTarget,
  );
  const selectedConfiguration = $derived(configurations[selectedTarget]);

  function selectTarget(target: string) {
    selectedTarget = target;
    copyStatus = "";
  }

  function resetSelectedConfiguration() {
    const configuredDefault = defaults?.[selectedTarget];
    const creviceFree = selectedTarget === "toggle" || selectedTarget === "slider" ||
      selectedTarget === "raisedCard" || selectedTarget === "insetSlot";
    configurations[selectedTarget] = {
      ...(configuredDefault ?? (creviceFree ? defaultCreviceFreeMaterialSettings : defaultMaterialSettings)),
    };
    copyStatus = "Reset";
  }

  async function copyConfiguration(scope: "selected" | "all") {
    const payload = scope === "selected"
      ? { target: selectedTarget, settings: selectedConfiguration }
      : { targets: configurations };
    const instruction = [
      scope === "selected"
        ? `Update the SnapDesign ${selectedLabel} material configuration. Apply these MaterialSettings values exactly and leave the other component configurations unchanged.`
        : "Update the SnapDesign material configurations. Apply each target's MaterialSettings values exactly.",
      "",
      "```json",
      JSON.stringify(payload, null, 2),
      "```",
    ].join("\n");

    try {
      await navigator.clipboard.writeText(instruction);
      copyStatus = scope === "selected" ? "Selected copied" : "All copied";
    } catch {
      copyStatus = "Copy failed";
    }
  }
</script>

<section class="material-control-panel" aria-labelledby="material-panel-title">
  <header class="material-panel-header">
    <div>
      <p>Interactive configuration</p>
      <h2 id="material-panel-title">Material</h2>
    </div>
    <span>{selectedLabel}</span>
  </header>

  <nav class="material-targets" aria-label="Material target">
    {#each targets as target}
      <button
        type="button"
        class:active={target.id === selectedTarget}
        aria-pressed={target.id === selectedTarget}
        onclick={() => selectTarget(target.id)}
      >
        {target.label}
      </button>
    {/each}
  </nav>

  {#if selectedConfiguration}
    {#key selectedTarget}
      <section class="live-preview" aria-labelledby="live-preview-title">
        <div class="panel-title-row">
          <h3 id="live-preview-title">Live Preview</h3>
          <output>{selectedLabel}</output>
        </div>
        <div class="live-preview-stage">
          {#if selectedTarget === "dial"}
            <Dial value={selectedConfiguration.lightAngle} material={selectedConfiguration} aria-label="Dial material preview" />
          {:else if selectedTarget === "button"}
            <SnapButton material={selectedConfiguration}>Button</SnapButton>
          {:else if selectedTarget === "toggle"}
            <Toggle bind:checked={previewToggleChecked} material={selectedConfiguration} aria-label="Toggle material preview" />
          {:else if selectedTarget === "slider"}
            <Slider width={240} bind:value={previewSliderValue} material={selectedConfiguration} aria-label="Slider material preview" />
          {:else if selectedTarget === "raisedCard"}
            <MaterialSurface depth="raised" shape="rounded" radius={12} width={240} height={112} material={selectedConfiguration} className="preview-container">
              <span>Raised Card</span>
            </MaterialSurface>
          {:else if selectedTarget === "insetSlot"}
            <MaterialSurface depth="recessed" shape="rounded" radius={12} width={240} height={112} material={selectedConfiguration} className="preview-container">
              <span>Inset Slot</span>
            </MaterialSurface>
          {/if}
        </div>
      </section>

      <div class="material-panel-body">
      <section class="lighting-panel" aria-labelledby="lighting-panel-title">
        <div class="panel-title-row">
          <h3 id="lighting-panel-title">Lighting</h3>
        </div>

        <div class="control-list">
          <label>
            <span>Light Direction <output>{Math.round(selectedConfiguration.lightAngle)}°</output></span>
            <Slider width={180} min={0} max={359} step={1} bind:value={selectedConfiguration.lightAngle} material={configurations.slider} aria-label={`${selectedLabel} light direction`} />
          </label>
          <label>
            <span>Ambient <output>{selectedConfiguration.ambientBrightness.toFixed(2)}</output></span>
            <Slider width={180} min={0} max={1} step={0.01} bind:value={selectedConfiguration.ambientBrightness} material={configurations.slider} aria-label={`${selectedLabel} ambient brightness`} />
          </label>
          <label>
            <span>Shadow Distance <output>{selectedConfiguration.shadowDistance.toFixed(2)}px</output></span>
            <Slider width={180} min={0} max={16} step={0.25} bind:value={selectedConfiguration.shadowDistance} material={configurations.slider} aria-label={`${selectedLabel} shadow distance`} />
          </label>
          <label>
            <span>Shadow Blur <output>{selectedConfiguration.shadowBlur.toFixed(1)}px</output></span>
            <Slider width={180} min={0} max={20} step={0.25} bind:value={selectedConfiguration.shadowBlur} material={configurations.slider} aria-label={`${selectedLabel} shadow blur`} />
          </label>
          <label>
            <span>Shadow Strength <output>{selectedConfiguration.shadowStrength.toFixed(2)}</output></span>
            <Slider width={180} min={0} max={1} step={0.01} bind:value={selectedConfiguration.shadowStrength} material={configurations.slider} aria-label={`${selectedLabel} shadow strength`} />
          </label>
          <label>
            <span>Specular Strength <output>{selectedConfiguration.specularIntensity.toFixed(2)}</output></span>
            <Slider width={180} min={0} max={1} step={0.01} bind:value={selectedConfiguration.specularIntensity} material={configurations.slider} aria-label={`${selectedLabel} specular strength`} />
          </label>
          <label>
            <span>Specular Power <output>{selectedConfiguration.specularPower}</output></span>
            <Slider width={180} min={1} max={32} step={1} bind:value={selectedConfiguration.specularPower} material={configurations.slider} aria-label={`${selectedLabel} specular power`} />
          </label>
        </div>
      </section>

      <section class="edge-panel" aria-labelledby="edge-panel-title">
        <div class="panel-title-row">
          <h3 id="edge-panel-title">Edge</h3>
        </div>
        <div class="control-list">
          <label>
            <span>Rim Width <output>{selectedConfiguration.rimWidth.toFixed(2)}px</output></span>
            <Slider width={180} min={0.5} max={4} step={0.25} bind:value={selectedConfiguration.rimWidth} material={configurations.slider} aria-label={`${selectedLabel} rim width`} />
          </label>
          <label>
            <span>Rim Blur <output>{selectedConfiguration.rimBlur.toFixed(1)}px</output></span>
            <Slider width={180} min={0} max={3} step={0.1} bind:value={selectedConfiguration.rimBlur} material={configurations.slider} aria-label={`${selectedLabel} rim blur`} />
          </label>
          <label>
            <span>Crevice Brightness <output>{selectedConfiguration.creviceBrightness.toFixed(2)}</output></span>
            <Slider width={180} min={0} max={1} step={0.01} bind:value={selectedConfiguration.creviceBrightness} material={configurations.slider} aria-label={`${selectedLabel} crevice brightness`} />
          </label>
        </div>

        <div class="toggle-list">
          <label>
            <Toggle bind:checked={selectedConfiguration.shadedRim} material={configurations.toggle} aria-label={`${selectedLabel} shaded rim`} />
            <span>Shaded Rim</span>
          </label>
          <label>
            <Toggle bind:checked={selectedConfiguration.creviceOutline} material={configurations.toggle} aria-label={`${selectedLabel} crevice outline`} />
            <span>Crevice Outline</span>
          </label>
        </div>

        <div class="configuration-preview">
          <span>Agent configuration</span>
          <pre>{JSON.stringify(selectedConfiguration, null, 2)}</pre>
        </div>

        <div class="panel-actions">
          <SnapButton material={configurations.button} onclick={() => copyConfiguration("selected")}>Copy Selected</SnapButton>
          <SnapButton material={configurations.button} onclick={() => copyConfiguration("all")}>Copy All</SnapButton>
          <button type="button" onclick={resetSelectedConfiguration}>Reset</button>
          <output aria-live="polite">{copyStatus}</output>
        </div>
      </section>
      </div>
    {/key}
  {/if}
</section>

<style>
  .material-control-panel {
    padding: clamp(28px, 4vw, 52px);
    border: 1px solid #d7d7d7;
    background: #f6f6f6;
  }

  .material-panel-header,
  .panel-title-row,
  .control-list label > span,
  .panel-actions {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 16px;
  }

  .material-panel-header p,
  .material-panel-header h2,
  .panel-title-row h3 {
    margin: 0;
  }

  .material-panel-header p,
  .configuration-preview > span {
    color: rgb(0 0 0 / 55%);
    font-family: var(--font-code);
    font-size: 0.78rem;
    text-transform: uppercase;
  }

  .material-panel-header h2 {
    font-family: var(--font-label);
    font-size: clamp(44px, 5vw, 72px);
    font-weight: 400;
  }

  .material-panel-header > span,
  output {
    color: var(--color-primary);
    font-family: var(--font-code);
  }

  .material-targets {
    display: flex;
    flex-wrap: wrap;
    margin: 28px 0 0;
    border-top: 1px solid #d7d7d7;
    border-left: 1px solid #d7d7d7;
  }

  .material-targets button {
    padding: 10px 14px;
    border: 0;
    border-right: 1px solid #d7d7d7;
    border-bottom: 1px solid #d7d7d7;
    background: transparent;
    font: inherit;
    cursor: pointer;
  }

  .material-targets button.active {
    color: #fff;
    background: #000;
  }

  .material-panel-body {
    display: grid;
    grid-template-columns: minmax(280px, 0.8fr) minmax(320px, 1.2fr);
    margin-top: 28px;
    border: 1px solid #d7d7d7;
  }

  .live-preview {
    margin-top: 28px;
    padding: 28px;
    border: 1px solid #d7d7d7;
    background: #ececeb;
  }

  .live-preview-stage {
    display: flex;
    min-height: 144px;
    align-items: center;
    justify-content: center;
    margin-top: 20px;
    overflow: hidden;
  }

  .live-preview :global(.preview-container) {
    --material-content-padding: 20px;
    font-family: var(--font-label);
  }

  .lighting-panel,
  .edge-panel {
    min-width: 0;
    padding: 28px;
  }

  .edge-panel {
    border-left: 1px solid #d7d7d7;
  }

  .panel-title-row h3 {
    font-family: var(--font-label);
    font-size: 28px;
    font-weight: 400;
  }

  .control-list {
    display: grid;
    grid-template-columns: minmax(0, 1fr);
    gap: 22px;
  }

  .control-list label {
    display: flex;
    min-width: 0;
    flex-direction: column;
    gap: 10px;
  }

  .control-list output {
    font-size: 0.78rem;
  }

  .control-list :global(.slider) {
    width: min(100%, 180px) !important;
  }

  .toggle-list {
    display: flex;
    flex-wrap: wrap;
    gap: 18px 28px;
    margin-top: 28px;
  }

  .toggle-list label {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .configuration-preview {
    margin-top: 28px;
  }

  .configuration-preview pre {
    max-height: 220px;
    margin: 10px 0 0;
    padding: 16px;
    overflow: auto;
    border-radius: 8px;
    color: #f6f6f6;
    background: #000;
    font-family: var(--font-code);
    font-size: 0.78rem;
    line-height: 1.5;
  }

  .panel-actions {
    justify-content: flex-start;
    margin-top: 20px;
  }

  .panel-actions > button {
    padding: 8px 12px;
    border: 1px solid #d7d7d7;
    background: transparent;
    font: inherit;
    cursor: pointer;
  }

  .panel-actions output {
    margin-left: auto;
  }

  @media (max-width: 900px) {
    .material-panel-body,
    .control-list {
      grid-template-columns: 1fr;
    }

    .edge-panel {
      border-top: 1px solid #d7d7d7;
      border-left: 0;
    }

    .control-list :global(.slider) {
      width: 100% !important;
    }
  }

  @media (max-width: 500px) {
    .material-control-panel {
      padding: 20px;
    }

    .material-panel-header {
      flex-wrap: wrap;
    }

    .material-panel-header h2 {
      font-size: 40px;
    }

    .lighting-panel,
    .edge-panel {
      padding: 16px;
    }

  }
</style>
