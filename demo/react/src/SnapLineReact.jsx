import React from "react";
import { useState } from "react";
import { useRef } from "react";
import { useEffect } from "react";

export default function SnapLineReact({ ...props }) {
  const snapLine = props.snapLine;
  const slContainer = useRef(null); // div to contain the canvas
  const slCanvas = useRef(null); // canvas that contains the nodes
  const slBackground = useRef(null); // Background of the canvas
  const slSelection = useRef(null); // selection bo

  const [slCanvasStyle, setSlCanvasStyle] = useState(null);
  const [slBackgroundStyle, setSlBackgroundStyle] = useState(null);
  const [slSelectionStyle, setSlSelectionStyle] = useState(null);

  useEffect(() => {
    if (!snapLine) {
      return;
    }
    snapLine.setRenderCanvasCallback(setSlCanvasStyle);
    snapLine.setRenderBackgroundCallback(setSlBackgroundStyle);
    snapLine.setRenderSelectionBoxCallback(setSlSelectionStyle);
    snapLine.init(
      slContainer.current,
      slCanvas.current,
      slBackground.current,
      slSelection.current,
    );
  }, []);

  return (
    <div
      className="sl-container"
      ref={slContainer}
      style={{ width: "100%", height: "100vh", overflow: "hidden" }}
      id="sl-canvas-container"
    >
      <div ref={slCanvas} id="slCanvas" style={slCanvasStyle}>
        <div
          ref={slBackground}
          id="sl-background"
          style={slBackgroundStyle}
        ></div>
        {props.children}
      </div>
      <div ref={slSelection} id="sl-selection" style={slSelectionStyle}></div>
    </div>
  );
}
