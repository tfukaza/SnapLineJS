import React, { useEffect } from "react";
import { useState } from "react";
import { useRef } from "react";
import Node from "../lib/Node";
import Output from "../lib/Output";
import InputNumber from "../lib/InputNumber";

export default function LerpNode(nodeObject) {
  let [node, setNode] = useState(nodeObject);
  let rangeDom = useRef(null);

  useEffect(() => {
    rangeDom.current.addEventListener("mousedown", blockPropagation);
  }, []);

  function calculateMath() {
    let input1 = +node.prop.input_1;
    let input2 = +node.prop.input_2;
    let alpha = +node.prop.alpha;

    let result = input1 + (alpha / 100) * (input2 - input1);

    node.prop.result = result;
  }

  function updateText(e, name) {
    node.prop[name] = e.target.value;
    calculateMath();
  }

  function updateAlpha(e) {
    node.prop.alpha = e.target.value;
    calculateMath();
    e.stopPropagation();
  }

  function blockPropagation(e) {
    e.stopPropagation();
  }

  return (
    <Node nodeObject={node}>
      <div className="sl-row right">
        <span className="sl-label right">Result</span>
        <Output nodeObject={node} setLineList={setLineList} name="result" />
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
