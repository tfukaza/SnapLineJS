import { expect, test } from "@playwright/test";
import {
  ConnectorMirror,
  GroupNodeMirror,
  NodeMirror,
} from "../../assets/snapline/core/src";
import { getGraphMirror } from "../../assets/snapline/core/src/snapline-globals";
import {
  createEngineHarness,
  createSiblingEngine,
  installObserverStubs,
} from "../helpers/snapline-harness";

test("mirrors mint domain ids when none is supplied and honor supplied ids", () => {
  const { engine } = createEngineHarness();
  const minted = new NodeMirror(engine, null);
  const named = new NodeMirror(engine, null, { id: "app-node" });
  const connector = new ConnectorMirror(engine, named, { name: "out" });
  const namedConnector = new ConnectorMirror(engine, named, {
    id: "app-port",
    name: "in",
  });

  expect(minted.nodeId).toMatch(/^node-\d+$/);
  expect(named.nodeId).toBe("app-node");
  expect(connector.connectorId).toMatch(/^connector-\d+$/);
  expect(namedConnector.connectorId).toBe("app-port");

  const line = connector.createLine();
  expect(line.lineId).toMatch(/^line-\d+$/);
});

test("the graph mirror indexes registrations and drops them on destroy", () => {
  const { engine } = createEngineHarness();
  const mirror = getGraphMirror(engine);
  const node = new NodeMirror(engine, null, { id: "n1" });
  const connector = new ConnectorMirror(engine, node, {
    id: "c1",
    name: "out",
  });

  expect(mirror.node("n1")).toBe(node);
  expect(mirror.connector("c1")).toBe(connector);
  expect(mirror.nodes).toContain(node);
  expect(mirror.connectors).toContain(connector);

  connector.destroy(false);
  node.destroy(false);
  expect(mirror.node("n1")).toBeNull();
  expect(mirror.connector("c1")).toBeNull();
  expect(mirror.nodes).not.toContain(node);
  expect(mirror.connectors).not.toContain(connector);
});

test("duplicate ids never steal the index: first wins, diagnostic until resolved", () => {
  const { engine } = createEngineHarness();
  const mirror = getGraphMirror(engine);
  const first = new NodeMirror(engine, null, { id: "dup" });
  const second = new NodeMirror(engine, null, { id: "dup" });

  expect(mirror.node("dup")).toBe(first);
  const errors = mirror.diagnostics();
  expect(errors).toHaveLength(1);
  expect(errors[0].code).toBe("duplicate-id");
  expect(errors[0].nodeId).toBe("dup");

  // The conflict resolves when the indexed mirror leaves: the survivor takes
  // over the entry and its diagnostic clears.
  first.destroy(false);
  expect(mirror.node("dup")).toBe(second);
  expect(mirror.diagnostics()).toHaveLength(0);

  second.destroy(false);
  expect(mirror.node("dup")).toBeNull();
});

test("lines move preview -> settled -> preview and unregister on destroy", () => {
  const restore = installObserverStubs();
  try {
    const { engine } = createEngineHarness();
    const mirror = getGraphMirror(engine);
    const sourceNode = new NodeMirror(engine, null);
    const targetNode = new NodeMirror(engine, null);
    const source = new ConnectorMirror(engine, sourceNode, {
      name: "out",
      rules: { maxIncoming: 0 },
    });
    const target = new ConnectorMirror(engine, targetNode, {
      name: "in",
      rules: { maxOutgoing: 0, maxIncoming: "unlimited" },
    });

    const line = source.createLine();
    expect(mirror.previewLines).toContain(line);
    expect(mirror.lines).not.toContain(line);
    expect(mirror.line(line.lineId)).toBeNull();

    expect(source.connectToConnector({ target, line })).toBe(true);
    expect(mirror.previewLines).not.toContain(line);
    expect(mirror.line(line.lineId)).toBe(line);

    line.clearTarget();
    expect(mirror.line(line.lineId)).toBeNull();
    expect(mirror.previewLines).toContain(line);

    line.destroy(false);
    expect(mirror.previewLines).not.toContain(line);
  } finally {
    restore();
  }
});

test("each engine on a shared GlobalManager gets its own isolated registry", () => {
  const { engine, global } = createEngineHarness();
  const sibling = createSiblingEngine(global);

  const nodeA = new NodeMirror(engine, null, { id: "shared-id" });
  const nodeB = new NodeMirror(sibling, null, { id: "shared-id" });

  const mirrorA = getGraphMirror(engine);
  const mirrorB = getGraphMirror(sibling);
  expect(mirrorA).not.toBe(mirrorB);
  // Same domain id on different engines is not a conflict.
  expect(mirrorA.node("shared-id")).toBe(nodeA);
  expect(mirrorB.node("shared-id")).toBe(nodeB);
  expect(mirrorA.diagnostics()).toHaveLength(0);
  expect(mirrorB.diagnostics()).toHaveLength(0);
  expect(mirrorA.nodes).not.toContain(nodeB);
  expect(mirrorB.nodes).not.toContain(nodeA);
});

test("selection is engine-scoped and removal is identity-based", () => {
  const { engine, global } = createEngineHarness();
  const sibling = createSiblingEngine(global);
  const nodeA = new NodeMirror(engine, null, { id: "same" });
  const nodeB = new NodeMirror(sibling, null, { id: "same" });

  nodeA.setSelected(true);
  nodeB.setSelected(true);
  expect(getGraphMirror(engine).selection).toEqual([nodeA]);
  expect(getGraphMirror(sibling).selection).toEqual([nodeB]);

  // Identity-based removal: deselecting A must not evict the same-id node on
  // the sibling engine (the old shared list filtered by id).
  nodeA.setSelected(false);
  expect(getGraphMirror(engine).selection).toEqual([]);
  expect(getGraphMirror(sibling).selection).toEqual([nodeB]);
});

test("group registries are engine-scoped", () => {
  const restore = installObserverStubs();
  try {
    const { engine, global } = createEngineHarness();
    const sibling = createSiblingEngine(global);
    const groupA = new GroupNodeMirror(engine, null);
    const groupB = new GroupNodeMirror(sibling, null);

    expect(getGraphMirror(engine).groups).toEqual([groupA]);
    expect(getGraphMirror(sibling).groups).toEqual([groupB]);

    groupA.destroy(false);
    expect(getGraphMirror(engine).groups).toEqual([]);
    expect(getGraphMirror(sibling).groups).toEqual([groupB]);
    groupB.destroy(false);
  } finally {
    restore();
  }
});
