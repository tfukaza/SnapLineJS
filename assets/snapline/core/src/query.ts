import type { ConnectorComponent } from "./connector";
import { GroupNodeComponent } from "./group";
import type { NodeComponent } from "./node";
import { getNodeManager, getSelectList } from "./snapline-globals";

type EngineLike = {
  global: {
    data: any;
  };
};

// Enumeration delegates to the per-engine NodeManager registry (components
// register in their constructors), replacing the old engine-object-table
// scans. Public signatures unchanged.

export function getNodes(engine: EngineLike): readonly NodeComponent[] {
  return getNodeManager(engine).nodes;
}

export function getConnectors(
  engine: EngineLike,
): readonly ConnectorComponent[] {
  return getNodeManager(engine).connectors;
}

export function getGroupNodes(
  engine: EngineLike,
): readonly GroupNodeComponent[] {
  return getNodeManager(engine).nodes.filter(
    (node): node is GroupNodeComponent => node instanceof GroupNodeComponent,
  );
}

export function getSelectedNodes(
  engine: EngineLike,
): readonly NodeComponent[] {
  return [...getSelectList(engine.global)];
}
