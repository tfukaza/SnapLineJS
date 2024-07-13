import React from "react";
import { useState } from "react";
import Node from "./lib/Node";
import Output from "./lib/Output";
import InputNumber from "./lib/InputNumber";

export default function PrintNode(nodeObject) {
  let [node, setNode] = useState(nodeObject);
  let [lineList, setLineList] = useState(node.svgLines || []);
  let [printText, setPrintText] = useState("0");

  function updateText(e, name) {}

  return (
    <Node nodeObject={node} lineList={lineList}>
      <div className="sl-row">
        <h2>{printText}</h2>
      </div>
      <div className="sl-row right">
        <span className="sl-label right">Output</span>
        <Output nodeObject={node} setLineList={setLineList} name="result" />
      </div>
      <div className="sl-row">
        <InputNumber
          nodeObject={node}
          name="input_1"
          updateText={updateText}
          setProp={setPrintText}
        />
      </div>
    </Node>
  );
}
