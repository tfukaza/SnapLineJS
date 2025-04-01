import React from "react";
import { useState } from "react";
import { useRef } from "react";
import Node from "../lib/Node";
import Output from "../lib/Output";
import InputNumber from "../lib/InputNumber";

export default function PrintNode({ nodeObject }) {
  let node = useRef(nodeObject);

  let [printText, setPrintText] = useState("0");

  function updateText(e, name) {}

  return (
    <Node nodeObject={node.current}>
      <div className="sl-row">
        <h2>{printText}</h2>
      </div>
      <div className="sl-row right">
        <span className="sl-label right">Output</span>
        <Output nodeObject={node.current} name="result" />
      </div>
      <div className="sl-row">
        <InputNumber
          nodeObject={node.current}
          name="input_1"
          updateText={updateText}
          setProp={setPrintText}
        />
      </div>
    </Node>
  );
}
