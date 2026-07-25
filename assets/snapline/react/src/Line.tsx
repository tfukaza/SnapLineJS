import { useEffect, useRef, useState, type CSSProperties } from "react";
import type { LineComponent } from "@snap-engine/snapline";

export interface LineProps {
  line: LineComponent;
  className?: string;
  pathClassName?: string;
  pathStyle?: CSSProperties;
  showArrow?: boolean;
  data?: Record<string, string>;
}

interface LineState {
  style: CSSProperties;
  x1: number;
  x2: number;
  x3: number;
  y1: number;
  y2: number;
  y3: number;
}

function getLineState(line: LineComponent): LineState {
  const dx = line.endWorldX - line.worldTransform.x;
  const dy = line.endWorldY - line.worldTransform.y;
  return {
    style: {
      overflow: "visible",
      pointerEvents: "none",
      position: "absolute",
      transform: `translate3d(${line.worldTransform.x}px, ${line.worldTransform.y}px, 0)`,
      willChange: "transform",
      zIndex: 1000,
    },
    x1: Math.abs(dx / 2),
    y1: 0,
    x2: dx - Math.abs(dx / 2),
    y2: dy,
    x3: dx,
    y3: dy,
  };
}

export function Line({
  line,
  className,
  pathClassName = "sl-connector-line",
  pathStyle,
  showArrow = true,
  data = {},
}: LineProps) {
  const lineDomRef = useRef<SVGSVGElement>(null);
  const [lineState, setLineState] = useState<LineState>(() =>
    getLineState(line),
  );

  useEffect(() => {
    if (lineDomRef.current) {
      line.element = lineDomRef.current as unknown as HTMLElement;
    }
    const renderLine = () => {
      setLineState(getLineState(line));
    };
    const cleanup = line.onRender(renderLine);
    renderLine();
    return cleanup;
  }, [line]);

  return (
    <svg
      data-snapline-type="connector-line"
      className={className}
      {...Object.fromEntries(
        Object.entries(data).map(([key, value]) => [`data-${key}`, value]),
      )}
      height="4"
      ref={lineDomRef}
      style={lineState.style}
      width="4"
    >
      <path
        className={pathClassName}
        d={`M 0,0 C ${lineState.x1}, ${lineState.y1} ${lineState.x2}, ${lineState.y2} ${lineState.x3}, ${lineState.y3}`}
        markerEnd={showArrow ? `url(#arrow-${line.id})` : undefined}
        style={{
          fill: "none",
          stroke: "#545454",
          strokeLinecap: "round",
          strokeLinejoin: "round",
          strokeWidth: 4,
          ...pathStyle,
        }}
      />
      {showArrow ? (
        <marker id={`arrow-${line.id}`} viewBox="0 0 24 24" refX="0" refY="12" orient="auto">
          <polygon points="4,4 20,12 4,22" fill="#545454" />
        </marker>
      ) : null}
    </svg>
  );
}
