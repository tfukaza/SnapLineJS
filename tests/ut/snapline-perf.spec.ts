import { test } from "@playwright/test";
import {
  ConnectorMirror,
  NodeMirror,
  type LineRecord,
} from "../../assets/snapline/core/src";
import { getGraphMirror } from "../../assets/snapline/core/src/snapline-globals";
import {
  createControlledHarness,
  nearTargetStrategy,
} from "../helpers/snapline-harness";

// Informational only — no assertions on timings. Logs the hot paths so a
// pathological regression (accidental O(n²), per-pointer-move scans) is
// visible in test output before it reaches an application.
test("perf: reconcile, candidate discovery, and bulk load on a 200-node graph", () => {
  const { engine, handle } = createControlledHarness();
  const mirror = getGraphMirror(engine);

  const NODES = 200;
  const LINES = 150;
  const sources: ConnectorMirror[] = [];
  for (let index = 0; index < NODES; index += 1) {
    const node = new NodeMirror(engine, null, { id: `n${index}` });
    sources.push(
      new ConnectorMirror(engine, node, {
        id: `n${index}:out`,
        name: "out",
        rules: { maxIncoming: 0 },
      }),
    );
    new ConnectorMirror(engine, node, {
      id: `n${index}:in`,
      name: "in",
      rules: { maxOutgoing: 0 },
      surfaceStrategies: [nearTargetStrategy],
    });
  }
  const records: LineRecord[] = [];
  for (let index = 0; index < LINES; index += 1) {
    records.push({
      id: `l${index}`,
      fromConnectorId: `n${index}:out`,
      toConnectorId: `n${(index + 1) % NODES}:in`,
    });
  }

  const coldStart = performance.now();
  handle.setCanonicalGraph({ lines: records });
  handle.flush();
  const cold = performance.now() - coldStart;

  const warmStart = performance.now();
  handle.flush();
  const warm = performance.now() - warmStart;

  // Candidate discovery is the per-pointer-move hot path during a drag.
  const probeStart = performance.now();
  const PROBES = 100;
  for (let index = 0; index < PROBES; index += 1) {
    sources[0].findCandidateAtPoint({ x: 100 + (index % 50), y: 10 });
  }
  const probe = (performance.now() - probeStart) / PROBES;

  // Bulk load: fresh records over a cleared document inside one batch.
  handle.setCanonicalGraph({ lines: [] });
  handle.flush();
  const bulkStart = performance.now();
  const batch = mirror.beginBatch();
  handle.setCanonicalGraph({ lines: records });
  batch.end();
  mirror.flush();
  const bulk = performance.now() - bulkStart;

  console.log(
    `[snapline-perf] ${NODES} nodes / ${LINES} lines — ` +
      `cold reconcile ${cold.toFixed(1)}ms, warm ${warm.toFixed(1)}ms, ` +
      `candidate probe ${probe.toFixed(3)}ms/move, bulk load ${bulk.toFixed(1)}ms`,
  );
});
