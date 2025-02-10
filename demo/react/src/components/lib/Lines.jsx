import React from "react";

export default function Lines(props) {
  return (
    <>
      {props.lineList?.map((line, index) => {
        let style = {
          position: "absolute",
          overflow: "visible",
          pointerEvents: "none",
          willChange: "transform",
          transform: `translate3d(${line.x1}px, ${line.y1}px, 0)`,
        };
        return (
          <svg
            className="sl-connector-svg"
            key={index}
            width="4"
            height="4"
            style={style}
          >
            <line
              className="sl-connector-line"
              x1="0"
              y1="0"
              x2={line.x2}
              y2={line.y2}
            />
          </svg>
        );
      })}
    </>
  );
}
