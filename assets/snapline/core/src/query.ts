import type { ConnectorMirror } from "./connector";
import type { GroupNodeMirror } from "./group";
import type { LineMirror } from "./line";
import type { NodeMirror } from "./node";
import type {
  ConnectorId,
  LineId,
  NodeId,
  ReconciliationError,
} from "./graph-mirror";
import { getGraphMirror } from "./snapline-globals";

type EngineLike = {
  global: {
    data: any;
  };
};

/**
 * Read-only view of one engine's graph mirror: snapshots and identity
 * lookups, nothing mutable. The mirrors it returns are the live interactive
 * runtime objects — their own mutation surface is constrained separately —
 * and the facade never exposes registry sets, topology arrays, controller
 * attachment, or mutation methods.
 */
export interface GraphQuery {
  nodes(): readonly NodeMirror[];
  connectors(): readonly ConnectorMirror[];
  groups(): readonly GroupNodeMirror[];
  /** Settled lines; gesture previews are not part of the settled graph. */
  lines(): readonly LineMirror[];
  node(id: NodeId): NodeMirror | null;
  connector(id: ConnectorId): ConnectorMirror | null;
  line(id: LineId): LineMirror | null;
  diagnostics(): readonly ReconciliationError[];
}

/** The read-only query facade for one engine's graph. */
export function query(engine: EngineLike): GraphQuery {
  const mirror = getGraphMirror(engine);
  return {
    nodes: () => mirror.nodes,
    connectors: () => mirror.connectors,
    groups: () => [...mirror.groups],
    lines: () => mirror.lines,
    node: (id) => mirror.node(id),
    connector: (id) => mirror.connector(id),
    line: (id) => mirror.line(id),
    diagnostics: () => mirror.diagnostics(),
  };
}

// Enumeration delegates to the per-engine GraphMirror registry (components
// register in their constructors), replacing the old engine-object-table
// scans. Public signatures unchanged.

export function getNodes(engine: EngineLike): readonly NodeMirror[] {
  return getGraphMirror(engine).nodes;
}

export function getConnectors(
  engine: EngineLike,
): readonly ConnectorMirror[] {
  return getGraphMirror(engine).connectors;
}

export function getGroupNodes(
  engine: EngineLike,
): readonly GroupNodeMirror[] {
  return [...getGraphMirror(engine).groups];
}

export function getSelectedNodes(
  engine: EngineLike,
): readonly NodeMirror[] {
  return [...getGraphMirror(engine).selection];
}
