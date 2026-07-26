import type { ConnectorMirror } from "./connector";
import type { GroupNodeMirror } from "./group";
import type { NodeMirror } from "./node";
import { getGraphMirror } from "./snapline-globals";

type EngineLike = {
  global: {
    data: any;
  };
};

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
