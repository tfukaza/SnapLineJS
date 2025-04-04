import React, { useRef, useState, useEffect } from "react";
import Node from "../lib/Node";
import Output from "../lib/Output";
import InputNumber from "../lib/InputNumber";

export default function MathNode({ nodeObject }) {
  let node = useRef(nodeObject);

  useEffect(() => {
    node.current.setProp("operation", "+");
    node.current.setProp("input_1", 0);
    node.current.setProp("input_2", 0);
    node.current.setProp("result", 0);
  }, []);

  function calculateMath() {
    let input1 = +node.current.getProp("input_1");
    let input2 = +node.current.getProp("input_2");
    let operation = node.current.getProp("operation");

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

    node.current.setProp("result", result);
  }

  function updateText(e, name) {
    node.current.setProp(name, e.target.value);
    calculateMath();
  }

  function updateOperation(e) {
    node.current.setProp("operation", e.target.value);
    calculateMath();
  }

  return (
    <Node nodeObject={node.current}>
      <div className="sl-row right">
        <span className="sl-label right">Result</span>
        <Output nodeObject={node.current} name="result" />
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
          nodeObject={node.current}
          name="input_1"
          updateText={updateText}
          setProp={calculateMath}
        />
      </div>
      <div className="sl-row">
        <InputNumber
          nodeObject={node.current}
          name="input_2"
          updateText={updateText}
          setProp={calculateMath}
        />
      </div>
    </Node>
  );
}
