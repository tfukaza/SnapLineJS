import { useLayoutEffect, useRef, type CSSProperties } from "react";
import type {
  LineComponent,
  LineGeometrySnapshot,
} from "@snap-engine/snapline";

export interface LineProps {
  line: LineComponent;
  className?: string;
  pathClassName?: string;
  pathStyle?: CSSProperties;
  showArrow?: boolean;
  data?: Record<string, string>;
}

function pathForGeometry(geometry: LineGeometrySnapshot): string {
  const { x: dx, y: dy } = geometry.delta;
  const x1 = Math.abs(dx / 2);
  return `M 0,0 C ${x1}, 0 ${dx - x1}, ${dy} ${dx}, ${dy}`;
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
  const pathRef = useRef<SVGPathElement>(null);
  const initialGeometry = line.geometrySnapshot();

  useLayoutEffect(() => {
    return line.bindGeometryWriter((geometry) => {
      const svg = lineDomRef.current;
      const path = pathRef.current;
      if (!svg || !path) return;
      svg.style.transform =
        `translate3d(${geometry.start.x}px, ${geometry.start.y}px, 0)`;
      path.setAttribute("d", pathForGeometry(geometry));
    });
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
      style={{
        overflow: "visible",
        pointerEvents: "none",
        position: "absolute",
        transform: `translate3d(${initialGeometry.start.x}px, ${initialGeometry.start.y}px, 0)`,
        willChange: "transform",
        zIndex: 1000,
      }}
      width="4"
    >
      <path
        ref={pathRef}
        className={pathClassName}
        d={pathForGeometry(initialGeometry)}
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
