import React from "react";

export default function Line(props) {
  return (
    <svg
      data-snapline-type="connector-line"
      width="4"
      height="4"
      style={{
        position: "absolute",
        overflow: "visible",
        pointerEvents: "none",
        willChange: "transform",
        transform: `translate3d(${props.line.x_start}px, ${props.line.y_start}px, 0)`,
      }}
    >
      <line
        className="sl-connector-line"
        x1="0"
        y1="0"
        x2={props.line.x_end - props.line.x_start}
        y2={props.line.y_end - props.line.y_start}
      />
    </svg>
  );
}
