import React from "react";
import { SnapLine } from "./lib/snapline.mjs";
import { useState } from "react";
import { useRef } from "react";
import { useEffect } from "react";

export default function SnapLineReact({ ...props }) {
  const snapLine = useRef(new SnapLine());
  const slContainer = useRef(null); // div to contain the canvas
  const slCanvas = useRef(null); // canvas that contains the nodes
  const slBackground = useRef(null); // Background of the canvas
  const slSelection = useRef(null); // selection bo

  const [slCanvasStyle, setSlCanvasStyle] = useState(null);
  const [slBackgroundStyle, setSlBackgroundStyle] = useState(null);
  const [slSelectionStyle, setSlSelectionStyle] = useState(null);

  useEffect(() => {
    if (!snapLine.current) {
      return;
    }
    snapLine.current.setRenderCanvasCallback(setSlCanvasStyle);
    snapLine.current.setRenderBackgroundCallback(setSlBackgroundStyle);
    snapLine.current.setRenderSelectionBoxCallback(setSlSelectionStyle);
    snapLine.current.init(
      slContainer.current,
      slCanvas.current,
      slBackground.current,
      slSelection.current,
    );
  }, []);

  useEffect(() => {
    props.children.forEach((child) => {
      if (child.g == null) {
        snapLine.current.addNode(child);
      }
    });
  }, [props.children]);

  return (
    <div
      ref={slContainer}
      // style={{ width: "100%", height: "100vh", overflow: "hidden" }}
      id="sl-canvas-container"
    >
      <div ref={slCanvas} id="slCanvas" style={slCanvasStyle}>
        <div
          ref={slBackground}
          id="sl-background"
          style={slBackgroundStyle}
        ></div>
        {props.children.map((child) => {
          return child._prop["_reactComponent"];
        })}
      </div>
      <div ref={slSelection} id="sl-selection" style={slSelectionStyle}></div>
    </div>
  );
}
