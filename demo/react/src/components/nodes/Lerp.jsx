import React, { useEffect } from "react";
import { useState } from "react";
import { useRef } from "react";
import Node from "../lib/Node";
import Output from "../lib/Output";
import InputNumber from "../lib/InputNumber";

export default function LerpNode({ nodeObject }) {
  let node = useRef(nodeObject);
  let rangeDom = useRef(null);

  useEffect(() => {
    rangeDom.current.addEventListener("mousedown", blockPropagation);
    node.current.setProp("input_1", 0);
    node.current.setProp("input_2", 0);
    node.current.setProp("alpha", 0);
    node.current.setProp("result", 0);
  }, []);

  function calculateMath() {
    let input1 = +node.current.getProp("input_1");
    let input2 = +node.current.getProp("input_2");
    let alpha = +node.current.getProp("alpha");

    let result = input1 + (alpha / 100) * (input2 - input1);

    node.current.setProp("result", result);

    console.log(result);
  }

  function updateText(e, name) {
    node.current.setProp(name, e.target.value);
    calculateMath();
  }

  function updateAlpha(e) {
    node.current.setProp("alpha", e.target.value);
    calculateMath();
    e.stopPropagation();
  }

  function blockPropagation(e) {
    e.stopPropagation();
  }

  return (
    <Node nodeObject={node.current}>
      <div className="sl-row right">
        <span className="sl-label right">Result</span>
        <Output nodeObject={node.current} name="result" />
      </div>
      <div className="sl-row">
        <input
          type="range"
          min="0"
          max="100"
          step="1"
          onInput={updateAlpha}
          ref={rangeDom}
        />
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
