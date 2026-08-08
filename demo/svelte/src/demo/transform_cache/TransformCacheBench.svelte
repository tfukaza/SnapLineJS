<script lang="ts">
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { BaseObject } from "@snap-engine/core";
  import type { Engine as EngineType } from "@snap-engine/core";
  import { RectCollider } from "@snap-engine/core/collision";
  import { onDestroy } from "svelte";

  type BenchMode =
    | "steady"
    | "parent-moved"
    | "one-leaf-moved"
    | "few-leaves-moved"
    | "one-leaf-moved-unrelated";

  interface TransformSnapshot {
    x: number;
    y: number;
    scaleX: number;
    scaleY: number;
  }

  interface Metric {
    latest: number;
    average: number;
    p95: number;
    max: number;
  }

  const emptyMetric: Metric = {
    latest: 0,
    average: 0,
    p95: 0,
    max: 0,
  };

  let engine: EngineType | null = $state(null);
  let objectCount = $state(10000);
  let hierarchyDepth = $state(4);
  let sampleCount = $state(60);
  let colliderReadsEnabled = $state(true);
  let mode: BenchMode = $state("steady");
  let running = $state(false);
  let status = $state("Idle");
  let setupMs = $state(0);
  let completedSamples = $state(0);
  let objectCached = $state<Metric>({ ...emptyMetric });
  let objectBaseline = $state<Metric>({ ...emptyMetric });
  let colliderCached = $state<Metric>({ ...emptyMetric });
  let colliderBaseline = $state<Metric>({ ...emptyMetric });
  let checksumDisplay = $state(0);

  let rootObject: BaseObject | null = null;
  let parentObject: BaseObject | null = null;
  let objects: BaseObject[] = [];
  let colliders: RectCollider[] = [];
  let runId = 0;

  function waitForFrame(): Promise<void> {
    return new Promise((resolve) => {
      requestAnimationFrame(() => resolve());
    });
  }

  function percentile(values: number[], ratio: number): number {
    if (values.length === 0) {
      return 0;
    }

    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.min(
      sorted.length - 1,
      Math.floor((sorted.length - 1) * ratio),
    );
    return sorted[index];
  }

  function toMetric(values: number[]): Metric {
    if (values.length === 0) {
      return { ...emptyMetric };
    }

    const total = values.reduce((sum, value) => sum + value, 0);
    return {
      latest: values[values.length - 1],
      average: total / values.length,
      p95: percentile(values, 0.95),
      max: Math.max(...values),
    };
  }

  function resetStats() {
    completedSamples = 0;
    objectCached = { ...emptyMetric };
    objectBaseline = { ...emptyMetric };
    colliderCached = { ...emptyMetric };
    colliderBaseline = { ...emptyMetric };
    checksumDisplay = 0;
  }

  function disposeScene() {
    for (const object of objects) {
      object.destroy();
    }
    objects = [];
    colliders = [];
    parentObject = null;

    rootObject?.destroy();
    rootObject = null;
  }

  function buildScene(currentEngine: EngineType) {
    const setupStart = performance.now();
    disposeScene();

    rootObject = new BaseObject(currentEngine);
    rootObject.localTransform = { x: 20, y: 30, scaleX: 1.05, scaleY: 0.95 };

    parentObject = rootObject;
    for (let depthIndex = 1; depthIndex < hierarchyDepth; depthIndex++) {
      const parent = new BaseObject(currentEngine, parentObject);
      parent.localTransform = {
        x: depthIndex * 3,
        y: depthIndex * 5,
        scaleX: 1 + depthIndex * 0.01,
        scaleY: 1 - depthIndex * 0.005,
      };
      parentObject = parent;
    }

    for (let index = 0; index < objectCount; index++) {
      const object = new BaseObject(currentEngine, parentObject);
      object.localTransform = {
        x: (index % 250) * 2,
        y: Math.floor(index / 250) * 3,
        scaleX: 1 + (index % 5) * 0.01,
        scaleY: 1 + (index % 7) * 0.01,
      };
      objects.push(object);

      if (colliderReadsEnabled) {
        const collider = new RectCollider(currentEngine, object, 1, 2, 8, 6);
        object.addCollider(collider);
        colliders.push(collider);
      }
    }

    setupMs = performance.now() - setupStart;
  }

  function readUncachedTransform(object: BaseObject | RectCollider): TransformSnapshot {
    const chain: Array<BaseObject | RectCollider> = [];
    let current: BaseObject | RectCollider | null = object;
    while (current) {
      chain.push(current);
      current = current.transformParent as BaseObject | RectCollider | null;
    }

    let x = 0;
    let y = 0;
    let scaleX = 1;
    let scaleY = 1;
    for (let index = chain.length - 1; index >= 0; index--) {
      const local = chain[index].localTransform;
      x += local.x * scaleX;
      y += local.y * scaleY;
      scaleX *= local.scaleX;
      scaleY *= local.scaleY;
    }

    return { x, y, scaleX, scaleY };
  }

  function readStartIndex(): number {
    return mode === "one-leaf-moved-unrelated" ? 1 : 0;
  }

  function moveLeaf(index: number, sampleIndex: number) {
    const object = objects[index];
    if (!object) {
      return;
    }

    object.localTransform = {
      x: (index % 250) * 2 + (sampleIndex % 17),
      y: Math.floor(index / 250) * 3 + (sampleIndex % 11),
    };
  }

  function applySampleMutation(sampleIndex: number) {
    if (mode === "parent-moved" && rootObject) {
      rootObject.worldTransform = {
        x: 20 + (sampleIndex % 30),
        y: 30 + (sampleIndex % 20),
      };
      return;
    }

    if (mode === "one-leaf-moved" || mode === "one-leaf-moved-unrelated") {
      moveLeaf(0, sampleIndex);
      return;
    }

    if (mode === "few-leaves-moved") {
      for (let index = 0; index < Math.min(8, objects.length); index++) {
        moveLeaf(index, sampleIndex + index);
      }
    }
  }

  function readCachedObjects(): number {
    let checksum = 0;
    for (let index = readStartIndex(); index < objects.length; index++) {
      const object = objects[index];
      checksum +=
        object.worldTransform.x +
        object.worldTransform.y +
        object.worldTransform.scaleX +
        object.worldTransform.scaleY;
    }
    return checksum;
  }

  function readBaselineObjects(): number {
    let checksum = 0;
    for (let index = readStartIndex(); index < objects.length; index++) {
      const object = objects[index];
      const xTransform = readUncachedTransform(object);
      const yTransform = readUncachedTransform(object);
      const scaleXTransform = readUncachedTransform(object);
      const scaleYTransform = readUncachedTransform(object);
      checksum +=
        xTransform.x +
        yTransform.y +
        scaleXTransform.scaleX +
        scaleYTransform.scaleY;
    }
    return checksum;
  }

  function readCachedColliders(): number {
    let checksum = 0;
    for (let index = readStartIndex(); index < colliders.length; index++) {
      const collider = colliders[index];
      checksum +=
        collider.worldLeft +
        collider.worldRight +
        collider.worldTop +
        collider.worldBottom;
    }
    return checksum;
  }

  function readBaselineColliders(): number {
    let checksum = 0;
    for (let index = readStartIndex(); index < colliders.length; index++) {
      const collider = colliders[index];
      const leftTransform = readUncachedTransform(collider);
      const rightTransform = readUncachedTransform(collider);
      const topTransform = readUncachedTransform(collider);
      const bottomTransform = readUncachedTransform(collider);
      const leftRightEdge =
        leftTransform.x + collider.width * leftTransform.scaleX;
      const rightRightEdge =
        rightTransform.x + collider.width * rightTransform.scaleX;
      const topBottomEdge =
        topTransform.y + collider.height * topTransform.scaleY;
      const bottomBottomEdge =
        bottomTransform.y + collider.height * bottomTransform.scaleY;

      checksum +=
        Math.min(leftTransform.x, leftRightEdge) +
        Math.max(rightTransform.x, rightRightEdge) +
        Math.min(topTransform.y, topBottomEdge) +
        Math.max(bottomTransform.y, bottomBottomEdge);
    }
    return checksum;
  }

  function measure(read: () => number): { duration: number; checksum: number } {
    const start = performance.now();
    const checksum = read();
    return {
      duration: performance.now() - start,
      checksum,
    };
  }

  async function runBench() {
    if (!engine || running) {
      return;
    }

    const currentRunId = ++runId;
    running = true;
    status = "Building scene";
    resetStats();
    await waitForFrame();
    buildScene(engine);

    const objectCachedSamples: number[] = [];
    const objectBaselineSamples: number[] = [];
    const colliderCachedSamples: number[] = [];
    const colliderBaselineSamples: number[] = [];
    let checksum = 0;

    status = "Running";
    readCachedObjects();
    readCachedColliders();

    for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex++) {
      if (currentRunId !== runId) {
        break;
      }

      applySampleMutation(sampleIndex);

      const cachedObjects = measure(readCachedObjects);
      const baselineObjects = measure(readBaselineObjects);
      const cachedColliders = measure(readCachedColliders);
      const baselineColliders = measure(readBaselineColliders);

      objectCachedSamples.push(cachedObjects.duration);
      objectBaselineSamples.push(baselineObjects.duration);
      colliderCachedSamples.push(cachedColliders.duration);
      colliderBaselineSamples.push(baselineColliders.duration);
      checksum +=
        cachedObjects.checksum +
        baselineObjects.checksum +
        cachedColliders.checksum +
        baselineColliders.checksum;

      completedSamples = sampleIndex + 1;
      objectCached = toMetric(objectCachedSamples);
      objectBaseline = toMetric(objectBaselineSamples);
      colliderCached = toMetric(colliderCachedSamples);
      colliderBaseline = toMetric(colliderBaselineSamples);
      checksumDisplay = checksum;

      await waitForFrame();
    }

    if (currentRunId === runId) {
      status = "Complete";
      running = false;
    }
  }

  function stopBench() {
    runId++;
    running = false;
    status = "Stopped";
  }

  function speedup(baseline: Metric, cached: Metric): string {
    if (cached.average === 0) {
      return "0.00x";
    }
    return `${(baseline.average / cached.average).toFixed(2)}x`;
  }

  onDestroy(() => {
    stopBench();
    disposeScene();
  });
</script>

<Engine id="transform-cache-bench-canvas" bind:engine>
  <div class="bench">
    <section class="controls">
      <div class="field">
        <label for="object-count">Objects</label>
        <input
          id="object-count"
          type="number"
          min="1"
          step="1000"
          bind:value={objectCount}
          disabled={running}
        />
      </div>

      <div class="field">
        <label for="hierarchy-depth">Depth</label>
        <input
          id="hierarchy-depth"
          type="number"
          min="1"
          max="32"
          step="1"
          bind:value={hierarchyDepth}
          disabled={running}
        />
      </div>

      <div class="field">
        <label for="sample-count">Samples</label>
        <input
          id="sample-count"
          type="number"
          min="1"
          step="10"
          bind:value={sampleCount}
          disabled={running}
        />
      </div>

      <div class="field">
        <label for="bench-mode">Mode</label>
        <select id="bench-mode" bind:value={mode} disabled={running}>
          <option value="steady">Steady reads</option>
          <option value="parent-moved">Parent moved</option>
          <option value="one-leaf-moved">One leaf moved</option>
          <option value="few-leaves-moved">Few leaves moved</option>
          <option value="one-leaf-moved-unrelated">One leaf moved, read siblings</option>
        </select>
      </div>

      <label class="toggle">
        <input type="checkbox" bind:checked={colliderReadsEnabled} disabled={running} />
        <span>Rect colliders</span>
      </label>

      <div class="actions">
        <button onclick={() => void runBench()} disabled={running}>Run</button>
        <button onclick={stopBench} disabled={!running}>Stop</button>
      </div>
    </section>

    <section class="summary">
      <div>
        <span>Status</span>
        <strong>{status}</strong>
      </div>
      <div>
        <span>Setup</span>
        <strong>{setupMs.toFixed(2)} ms</strong>
      </div>
      <div>
        <span>Samples</span>
        <strong>{completedSamples.toLocaleString()} / {sampleCount.toLocaleString()}</strong>
      </div>
      <div>
        <span>Checksum</span>
        <strong>{checksumDisplay.toFixed(2)}</strong>
      </div>
    </section>

    <section class="results">
      <div class="result-heading">Object world transforms</div>
      <div class="metric">
        <span>Cached average</span>
        <strong>{objectCached.average.toFixed(4)} ms</strong>
      </div>
      <div class="metric">
        <span>Baseline average</span>
        <strong>{objectBaseline.average.toFixed(4)} ms</strong>
      </div>
      <div class="metric">
        <span>Speedup</span>
        <strong>{speedup(objectBaseline, objectCached)}</strong>
      </div>
      <div class="metric">
        <span>Cached p95</span>
        <strong>{objectCached.p95.toFixed(4)} ms</strong>
      </div>
      <div class="metric">
        <span>Baseline p95</span>
        <strong>{objectBaseline.p95.toFixed(4)} ms</strong>
      </div>

      <div class="result-heading">Collider bounds</div>
      <div class="metric">
        <span>Cached average</span>
        <strong>{colliderCached.average.toFixed(4)} ms</strong>
      </div>
      <div class="metric">
        <span>Baseline average</span>
        <strong>{colliderBaseline.average.toFixed(4)} ms</strong>
      </div>
      <div class="metric">
        <span>Speedup</span>
        <strong>{speedup(colliderBaseline, colliderCached)}</strong>
      </div>
      <div class="metric">
        <span>Cached p95</span>
        <strong>{colliderCached.p95.toFixed(4)} ms</strong>
      </div>
      <div class="metric">
        <span>Baseline p95</span>
        <strong>{colliderBaseline.p95.toFixed(4)} ms</strong>
      </div>
    </section>
  </div>
</Engine>

<style lang="scss">
  .bench {
    width: 100%;
    height: 100%;
    box-sizing: border-box;
    padding: 24px;
    display: grid;
    grid-template-rows: auto auto 1fr;
    gap: 18px;
    color: #111111;
    background: #ffffff;
    font-family: "Geist", sans-serif;
  }

  .controls {
    display: flex;
    align-items: end;
    flex-wrap: wrap;
    gap: 12px;
    padding-bottom: 16px;
    border-bottom: 1px solid #111111;
  }

  .field {
    display: grid;
    gap: 6px;
  }

  label,
  span {
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0;
  }

  input,
  select,
  button {
    height: 36px;
    box-sizing: border-box;
    border: 1px solid #111111;
    border-radius: 0;
    background: #ffffff;
    color: #111111;
    font: inherit;
  }

  input,
  select {
    width: 150px;
    padding: 0 10px;
  }

  button {
    padding: 0 14px;
    cursor: pointer;
  }

  button:hover:not(:disabled) {
    background: #111111;
    color: #ffffff;
  }

  button:disabled,
  input:disabled,
  select:disabled {
    opacity: 0.45;
    cursor: default;
  }

  .toggle {
    height: 36px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
  }

  .actions {
    display: flex;
    gap: 8px;
  }

  .summary,
  .results {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
    border: 1px solid #111111;
  }

  .summary > div,
  .metric,
  .result-heading {
    min-height: 92px;
    box-sizing: border-box;
    padding: 14px;
    display: grid;
    align-content: space-between;
    border-right: 1px solid #111111;
    border-bottom: 1px solid #111111;
  }

  .result-heading {
    background: #111111;
    color: #ffffff;
    font-size: 16px;
    align-content: center;
  }

  strong {
    font-size: 24px;
    line-height: 1.1;
    font-weight: 400;
    overflow-wrap: anywhere;
  }
</style>
