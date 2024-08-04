import React from "react";
import { useState } from "react";
import { useEffect } from "react";
import Node from "../lib/Node";
import Output from "../lib/Output";
import InputNumber from "../lib/InputNumber";

export default function MathNode({ nodeObject }) {
  let [node, setNode] = useState(nodeObject);

  console.log(node);

  useEffect(() => {
    node.setProp("operation", "+");
    node.setProp("input_1", 0);
    node.setProp("input_2", 0);
    node.setProp("result", 0);
  }, []);

  function calculateMath() {
    let input1 = +node.getProp("input_1");
    let input2 = +node.getProp("input_2");
    let operation = node.getProp("operation");

    let result = 0;

    if (operation == "+") {
      result = input1 + input2;
    } else if (operation == "-") {
      result = input1 - input2;
    } else if (operation == "*") {
      result = input1 * input2;
    } else {
      result = input1 / input2;
    }

    node.setProp("result", result);
  }

  function updateText(e, name) {
    node.setProp(name, e.target.value);
    calculateMath();
  }

  function updateOperation(e) {
    node.setProp("operation", e.target.value);
    calculateMath();
  }

  return (
    <Node nodeObject={node}>
      <div className="sl-row right">
        <span className="sl-label right">Result</span>
        <Output nodeObject={node} name="result" />
      </div>
      <div className="sl-row">
        <select className="sl-input" onChange={updateOperation}>
          <option value="+">Add</option>
          <option value="-">Subtract</option>
          <option value="*">Multiply</option>
          <option value="/">Divide</option>
        </select>
      </div>
      <div className="sl-row">
        <InputNumber
          nodeObject={node}
          name="input_1"
          updateText={updateText}
          setProp={calculateMath}
        />
      </div>
      <div className="sl-row">
        <InputNumber
          nodeObject={node}
          name="input_2"
          updateText={updateText}
          setProp={calculateMath}
        />
      </div>
    </Node>
  );
}
