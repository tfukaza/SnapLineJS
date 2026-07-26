import { expect, test } from "@playwright/test";
import {
  ConnectorMirror,
  NodeMirror,
  attachControlledGraph,
  type LineChangeRequest,
  type ReconciliationError,
} from "../../assets/snapline/core/src";
import { getGraphMirror } from "../../assets/snapline/core/src/snapline-globals";
import { createEngineHarness } from "../helpers/snapline-harness";

function controlledHarness() {
  const { engine, global } = createEngineHarness();
  const requests: LineChangeRequest[] = [];
  const diagnosticsLog: (readonly ReconciliationError[])[] = [];
  const handle = attachControlledGraph(engine, {
    onLineChangeRequest: (request) => requests.push(request),
    onDiagnosticsChanged: (diagnostics) => diagnosticsLog.push(diagnostics),
  });
  return { engine, global, handle, requests, diagnosticsLog };
}

function mountPair(engine: any) {
  const sourceNode = new NodeMirror(engine, null, { id: "n-src" });
  const targetNode = new NodeMirror(engine, null, { id: "n-tgt" });
  const source = new ConnectorMirror(engine, sourceNode, {
    id: "out-1",
    name: "out",
    rules: { maxIncoming: 0 },
  });
  const target = new ConnectorMirror(engine, targetNode, {
    id: "in-1",
    name: "in",
    rules: { maxOutgoing: 0 },
  });
  return { sourceNode, targetNode, source, target };
}

test("canonical records hydrate settled lines, stay latent until endpoints mount, and prune on removal", () => {
  const { engine, handle, requests } = controlledHarness();
  const mirror = getGraphMirror(engine);

  handle.setCanonicalGraph({
    lines: [
      {
        id: "line-a",
        fromConnectorId: "out-1",
        toConnectorId: "in-1",
        payload: { kind: "scalar" },
      },
    ],
  });
  handle.flush();
  // Latent: neither endpoint is mounted — silently retried, no diagnostic.
  expect(mirror.line("line-a")).toBeNull();
  expect(mirror.diagnostics()).toEqual([]);

  const { source, target } = mountPair(engine);
  handle.flush();
  const line = mirror.line("line-a");
  expect(line).not.toBeNull();
  expect(line!.start).toBe(source);
  expect(line!.target).toBe(target);
  expect(line!.phase).toBe("connected");
  expect(line!.payload).toEqual({ kind: "scalar" });

  handle.setCanonicalGraph({ lines: [] });
  handle.flush();
  expect(mirror.line("line-a")).toBeNull();
  expect(source.outgoingLines).toEqual([]);
  expect(target.incomingLines).toEqual([]);

  // Reconciliation is read-only w.r.t. canonical state: no requests emitted.
  expect(requests).toEqual([]);
});

test("a settled line is preserved by stable id across endpoint retargets", () => {
  const { engine, handle } = controlledHarness();
  const mirror = getGraphMirror(engine);
  const { source, targetNode } = mountPair(engine);
  const secondTarget = new ConnectorMirror(engine, targetNode, {
    id: "in-2",
    name: "in2",
    rules: { maxOutgoing: 0 },
  });

  handle.setCanonicalGraph({
    lines: [{ id: "line-a", fromConnectorId: "out-1", toConnectorId: "in-1" }],
  });
  handle.flush();
  const original = mirror.line("line-a")!;

  // toConnectorId change: the same mirror instance re-targets.
  handle.setCanonicalGraph({
    lines: [{ id: "line-a", fromConnectorId: "out-1", toConnectorId: "in-2" }],
  });
  handle.flush();
  expect(mirror.line("line-a")).toBe(original);
  expect(original.target).toBe(secondTarget);

  // fromConnectorId change: the start connector is fixed at construction,
  // so the mirror is recreated under the same stable id.
  const otherSource = new ConnectorMirror(
    engine,
    new NodeMirror(engine, null),
    { id: "out-2", name: "out2", rules: { maxIncoming: 0 } },
  );
  handle.setCanonicalGraph({
    lines: [{ id: "line-a", fromConnectorId: "out-2", toConnectorId: "in-2" }],
  });
  handle.flush();
  const recreated = mirror.line("line-a")!;
  expect(recreated).not.toBe(original);
  expect(recreated.start).toBe(otherSource);
  expect(source.outgoingLines).toEqual([]);
});

test("rules violations leave records latent with structured diagnostics that clear on resolution", () => {
  const { engine, handle, diagnosticsLog } = controlledHarness();
  const mirror = getGraphMirror(engine);
  const { target } = mountPair(engine);
  // A second source so two records target the same maxIncoming: 1 connector.
  new ConnectorMirror(engine, new NodeMirror(engine, null), {
    id: "out-2",
    name: "out2",
    rules: { maxIncoming: 0 },
  });
  expect(target.rules.maxIncoming).toBe(1);

  handle.setCanonicalGraph({
    lines: [
      { id: "line-a", fromConnectorId: "out-1", toConnectorId: "in-1" },
      { id: "line-b", fromConnectorId: "out-2", toConnectorId: "in-1" },
    ],
  });
  handle.flush();
  expect(mirror.line("line-a")).not.toBeNull();
  expect(mirror.line("line-b")).toBeNull();
  const errors = mirror.diagnostics();
  expect(errors).toHaveLength(1);
  expect(errors[0].code).toBe("capacity-exceeded");
  expect(errors[0].lineId).toBe("line-b");
  expect(diagnosticsLog.at(-1)).toEqual(errors);

  // Canonical reconciliation never evicted line-a to make room ("replace-
  // oldest" is gesture policy, not document policy). Fixing the document
  // clears the derived diagnostic.
  handle.setCanonicalGraph({
    lines: [{ id: "line-a", fromConnectorId: "out-1", toConnectorId: "in-1" }],
  });
  handle.flush();
  expect(mirror.diagnostics()).toEqual([]);
  expect(diagnosticsLog.at(-1)).toEqual([]);
});

test("duplicate canonical ids and predicate vetoes surface as diagnostics", () => {
  const { engine, handle } = controlledHarness();
  const mirror = getGraphMirror(engine);
  const { source, target } = mountPair(engine);

  handle.setCanonicalGraph({
    lines: [
      { id: "dup", fromConnectorId: "out-1", toConnectorId: "in-1" },
      { id: "dup", fromConnectorId: "out-1", toConnectorId: "in-1" },
    ],
  });
  handle.flush();
  expect(mirror.diagnostics().map((error) => error.code)).toEqual([
    "duplicate-id",
  ]);
  expect(mirror.line("dup")).not.toBeNull();

  // Predicate veto: the record stays unrepresented with a
  // "connection-rejected" diagnostic, and admits once the rule changes.
  let admit = false;
  target.updateConfig({
    rules: { maxOutgoing: 0, isValidConnection: () => admit },
  });
  handle.setCanonicalGraph({
    lines: [{ id: "line-v", fromConnectorId: "out-1", toConnectorId: "in-1" }],
  });
  handle.flush();
  expect(mirror.line("line-v")).toBeNull();
  expect(mirror.diagnostics().map((error) => error.code)).toEqual([
    "connection-rejected",
  ]);

  admit = true;
  handle.flush();
  expect(mirror.line("line-v")).not.toBeNull();
  expect(mirror.line("line-v")!.start).toBe(source);
  expect(mirror.diagnostics()).toEqual([]);
});

// ---- Controlled gesture protocol (3e) ----

function pos(x: number, y: number) {
  return { x, y, cameraX: x, cameraY: y, screenX: x, screenY: y };
}

/** targetHitTest that only accepts drops left of x=500 (so far drops miss). */
const nearStrategy = {
  targetHitTest: ({ position }: any) =>
    position.x < 500 ? { anchor: { x: position.x, y: position.y }, distance: 0 } : null,
};

function gestureHarness() {
  const base = controlledHarness();
  const sourceNode = new NodeMirror(base.engine, null, { id: "n-src" });
  const targetNode = new NodeMirror(base.engine, null, { id: "n-tgt" });
  const source = new ConnectorMirror(base.engine, sourceNode, {
    id: "out-1",
    name: "out",
    rules: { maxIncoming: 0 },
  });
  const target = new ConnectorMirror(base.engine, targetNode, {
    id: "in-1",
    name: "in",
    rules: { maxOutgoing: 0 },
    surfaceStrategies: [nearStrategy],
  });
  return { ...base, source, target };
}

function dragFrom(connector: ConnectorMirror, dropX: number, pointerId = 7) {
  const event = { button: 0, pointerId } as any;
  connector.onCursorDown({ position: pos(0, 0), event } as any);
}

function driveDrop(owner: ConnectorMirror, dropX: number, pointerId = 7) {
  const event = { button: 0, pointerId } as any;
  (owner as any).event.input.dragStart({
    start: pos(0, 0),
    pointerId,
    event,
  });
  (owner as any).event.input.dragEnd({
    end: pos(dropX, 10),
    pointerId,
    event,
  });
}

test("a controlled connect stages, proposes one atomic request, and settles in place on adoption", () => {
  const { engine, handle, requests, source, target } = gestureHarness();
  const mirror = getGraphMirror(engine);

  dragFrom(source, 100);
  driveDrop(source, 100);

  expect(requests).toHaveLength(1);
  const request = requests[0];
  expect(request.intent).toBe("connect");
  expect(request.remove).toEqual([]);
  expect(request.add).toHaveLength(1);
  expect(request.add[0].fromConnectorId).toBe("out-1");
  expect(request.add[0].toConnectorId).toBe("in-1");

  // Staged: visually attached, but no topology commitment anywhere.
  const staged = source.outgoingLines[0];
  expect(staged.lineId).toBe(request.add[0].id);
  expect(staged.phase).toBe("staged");
  expect(staged.target).toBe(target);
  expect(target.incomingLines).toEqual([]);
  expect(mirror.line(staged.lineId)).toBeNull();

  // Adoption settles the SAME mirror in place.
  handle.setCanonicalGraph({
    lines: [
      {
        id: request.add[0].id,
        fromConnectorId: "out-1",
        toConnectorId: "in-1",
      },
    ],
  });
  handle.flush();
  expect(mirror.line(staged.lineId)).toBe(staged);
  expect(staged.phase).toBe("connected");
  expect(target.incomingLines).toEqual([staged]);
});

test("rejection-by-inaction discards the staged line on the decisive pass", () => {
  const { engine, handle, requests, source } = gestureHarness();
  const mirror = getGraphMirror(engine);

  dragFrom(source, 100);
  driveDrop(source, 100);
  expect(requests).toHaveLength(1);
  expect(source.outgoingLines).toHaveLength(1);

  // The application declines by doing nothing; the adapter's post-request
  // push still delivers the unchanged (empty) snapshot.
  handle.flush();
  expect(source.outgoingLines).toEqual([]);
  expect(mirror.diagnostics()).toEqual([]);
  expect(mirror.previewLines).toEqual([]);
});

test("a full replace-oldest target yields one atomic replace request with no local eviction", () => {
  const { engine, handle, requests, source, target } = gestureHarness();
  const mirror = getGraphMirror(engine);
  target.updateConfig({
    rules: { maxOutgoing: 0, maxIncoming: 1, onFull: "replace-oldest" },
    surfaceStrategies: [nearStrategy],
  });
  const otherSource = new ConnectorMirror(
    engine,
    new NodeMirror(engine, null),
    { id: "out-2", name: "out2", rules: { maxIncoming: 0 } },
  );

  handle.setCanonicalGraph({
    lines: [{ id: "line-a", fromConnectorId: "out-2", toConnectorId: "in-1" }],
  });
  handle.flush();
  const existing = mirror.line("line-a")!;

  dragFrom(source, 100);
  driveDrop(source, 100);
  expect(requests).toHaveLength(1);
  const request = requests[0];
  expect(request.intent).toBe("replace");
  expect(request.remove).toEqual(["line-a"]);
  expect(request.add).toHaveLength(1);

  // Nothing was evicted locally: the app decides.
  expect(existing.phase).toBe("connected");
  expect(target.incomingLines).toEqual([existing]);

  handle.setCanonicalGraph({
    lines: [
      {
        id: request.add[0].id,
        fromConnectorId: "out-1",
        toConnectorId: "in-1",
      },
    ],
  });
  handle.flush();
  expect(mirror.line("line-a")).toBeNull();
  expect(mirror.line(request.add[0].id)).not.toBeNull();
  expect(target.incomingLines).toHaveLength(1);
  expect(otherSource.outgoingLines).toEqual([]);
});

test("a gesture disconnect proposes removal; rejection re-glues, acceptance discards", () => {
  const { engine, handle, requests, source, target } = gestureHarness();
  const mirror = getGraphMirror(engine);

  handle.setCanonicalGraph({
    lines: [{ id: "line-a", fromConnectorId: "out-1", toConnectorId: "in-1" }],
  });
  handle.flush();
  const line = mirror.line("line-a")!;

  // Pick the line up from its target and drop it in the void (x >= 500).
  const event = { button: 0, pointerId: 9 } as any;
  target.armSurfaceGesture({ position: pos(0, 0), event } as any, null);
  driveDrop(source, 900, 9);

  expect(requests).toHaveLength(1);
  expect(requests[0]).toMatchObject({
    intent: "disconnect",
    remove: ["line-a"],
  });
  expect(line.phase).toBe("staged");
  expect(line.target).toBeNull();
  expect(target.incomingLines).toEqual([]);

  // Rejected: the unchanged document still contains line-a — re-glue the
  // SAME mirror back onto its canonical target.
  handle.flush();
  expect(mirror.line("line-a")).toBe(line);
  expect(line.phase).toBe("connected");
  expect(line.target).toBe(target);
  expect(target.incomingLines).toEqual([line]);

  // Accepted: the document drops the record — the mirror goes with it.
  target.armSurfaceGesture({ position: pos(0, 0), event } as any, null);
  driveDrop(source, 900, 9);
  expect(requests).toHaveLength(2);
  handle.setCanonicalGraph({ lines: [] });
  handle.flush();
  expect(mirror.line("line-a")).toBeNull();
  expect(source.outgoingLines).toEqual([]);
});
