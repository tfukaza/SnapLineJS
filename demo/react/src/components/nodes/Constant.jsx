import React, { useRef, useState } from "react";
import Node from "../lib/Node";
import Output from "../lib/Output";

export default function ConstantNode({ nodeObject }) {
  let node = useRef(nodeObject);
  let [value, setValue] = useState(node.current.getProp("floatOutput") || 0);

  function updateText(e) {
    node.current.setProp("floatOutput", e.target.value);
    setValue(e.target.value);
  }

  return (
    <Node nodeObject={node.current}>
      <div className="sl-row right">
        <span className="sl-label right">Output</span>
        <Output nodeObject={node.current} name="floatOutput" />
      </div>
      <div className="sl-row">
        <input
          className="sl-input"
          type="number"
          value={value}
          onChange={(e) => updateText(e)}
        />
      </div>
    </Node>
  );
}
