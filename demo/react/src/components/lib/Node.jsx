import React from "react";
import { useState } from "react";
import { useRef } from "react";
import { useEffect } from "react";
import Lines from "./Lines";

export default function Node({ nodeObject, children }) {
  let [node, setNode] = useState(nodeObject);
  let [nodeStyle, setNodeStyle] = useState(node.getNodeStyle());
  let [lineDict, setLineDict] = useState(node.getLines());

  let nodeDom = useRef(null);

  useEffect(() => {
    node.setRenderNodeCallback(setNodeStyle);
    node.setRenderLinesCallback((lines, name) => {
      setLineDict((prev) => {
        prev[name] = lines;
        return { ...prev };
      });
    });

    node.init(nodeDom.current);
  }, []);

  return (
    <>
      {Object.keys(lineDict).map((name, index) => (
        <Lines lineList={lineDict[name]} key={index} />
      ))}

      <div
        className={"sl-node " + (nodeStyle["_focus"] ? "focus" : "")}
        ref={nodeDom}
        style={nodeStyle}
      >
        {children}
      </div>
    </>
  );
}
