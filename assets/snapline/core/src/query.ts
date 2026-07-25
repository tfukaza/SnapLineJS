import { ConnectorComponent } from "./connector";
import { GroupNodeComponent } from "./group";
import { NodeComponent } from "./node";
import { getSelectList } from "./snapline-globals";

type EngineLike = {
  global: {
    data: unknown;
    getEngineObjectTable(engine: unknown): Record<string, unknown>;
  };
};

function objects(engine: EngineLike): unknown[] {
  return Object.values(engine.global.getEngineObjectTable(engine));
}

export function getNodes(engine: EngineLike): readonly NodeComponent[] {
  return objects(engine).filter(
    (object): object is NodeComponent => object instanceof NodeComponent,
  );
}

export function getConnectors(
  engine: EngineLike,
): readonly ConnectorComponent[] {
  return objects(engine).filter(
    (object): object is ConnectorComponent =>
      object instanceof ConnectorComponent,
  );
}

export function getGroupNodes(
  engine: EngineLike,
): readonly GroupNodeComponent[] {
  return objects(engine).filter(
    (object): object is GroupNodeComponent =>
      object instanceof GroupNodeComponent,
  );
}

export function getSelectedNodes(
  engine: EngineLike,
): readonly NodeComponent[] {
  return [...getSelectList(engine.global)];
}
