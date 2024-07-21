import React from "react";

export default function NodeSelect({ snapLine, name, component, setNodes }) {
  let [sl, setSl] = React.useState(snapLine);
  function createNode() {
    const nodeObject = sl.createNode();
    const NodeClass = component;
    const nodeDOM = <NodeClass nodeObject={nodeObject} />;
    setNodes((nodes) => [...nodes, nodeDOM]);
  }
  return (
    <li>
      <button className="sl-btn" onClick={createNode}>
        {name}
      </button>
    </li>
  );
}
