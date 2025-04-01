import React from "react";
import { NodeComponent } from "./lib/snapline.mjs";

export default function NodeSelect({ name, component, setNodes }) {
  function createNode() {
    const NodeClass = component;
    const nodeObject = new NodeComponent(0, 0);
    const nodeComponent = <NodeClass nodeObject={nodeObject} />;
    nodeObject._prop["_reactComponent"] = nodeComponent;
    // const slNodeObject = nodeComponent.props.nodeObject;
    setNodes((nodes) => [...nodes, nodeObject]);
  }
  return (
    <li>
      <button className="sl-btn" onClick={createNode}>
        {name}
      </button>
    </li>
  );
}
