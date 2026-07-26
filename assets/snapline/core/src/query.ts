import type { ConnectorMirror } from "./connector";
import { GroupNodeMirror } from "./group";
import type { NodeMirror } from "./node";
import { getNodeManager, getSelectList } from "./snapline-globals";

type EngineLike = {
  global: {
    data: any;
  };
};

// Enumeration delegates to the per-engine NodeManager registry (components
// register in their constructors), replacing the old engine-object-table
// scans. Public signatures unchanged.

export function getNodes(engine: EngineLike): readonly NodeMirror[] {
  return getNodeManager(engine).nodes;
}

export function getConnectors(
  engine: EngineLike,
): readonly ConnectorMirror[] {
  return getNodeManager(engine).connectors;
}

export function getGroupNodes(
  engine: EngineLike,
): readonly GroupNodeMirror[] {
  return getNodeManager(engine).nodes.filter(
    (node): node is GroupNodeMirror => node instanceof GroupNodeMirror,
  );
}

export function getSelectedNodes(
  engine: EngineLike,
): readonly NodeMirror[] {
  return [...getSelectList(engine.global)];
}
