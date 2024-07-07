import React from "react";
import { useState } from "react";
import Node from "./lib/Node";
import Output from "./lib/Output";

export default function ConstantNode(nodeObject) {
  let [node, setNode] = useState(nodeObject);

  function updateText(e) {
    node.prop.floatOutput = e.target.value;
  }

  return (
    <Node nodeObject={node}>
      <div className="sl-row right">
        <span className="sl-label right">Output</span>
        <Output nodeObject={node} name="floatOutput" />
      </div>
      <div className="sl-row">
        <input
          className="sl-input"
          type="number"
          value={node.prop.floatOutput || 0}
          onChange={(e) => updateText(e)}
        />
      </div>
    </Node>
  );
}
