import React from "react";
import { useState } from "react";
import { useRef } from "react";
import { useEffect } from "react";
import Line from "./Line";

export default function Node({ nodeObject, children }) {
  let node = useRef(nodeObject);
  let [nodeStyle, setNodeStyle] = useState(node.current.getNodeStyle());
  let [lineList, setLineList] = useState(node.current.getAllLines());

  let nodeDom = useRef(null);

  const updateNodeStyle = (style) => {
    setNodeStyle(style);
    nodeDom.current.style.transform = style.transform;
    nodeDom.current.style.position = "absolute";
    nodeDom.current.style.transformOrigin = "top left";
  };

  useEffect(() => {
    node.current.setRenderNodeCallback(updateNodeStyle);
    node.current.setRenderLinesCallback(() => {
      let lines = node.current.getAllLines();
      setLineList(lines);
    });
    node.current.init(nodeDom.current);
  }, []);

  return (
    <>
      {lineList.map((line, index) => (
        <Line key={index} line={line} />
      ))}

      <div
        className={"sl-node"}
        data-snapline-state={nodeStyle["_focus"] ? "focus" : "idle"}
        ref={nodeDom}
        // style={nodeStyle}
      >
        {children}
      </div>
    </>
  );
}
