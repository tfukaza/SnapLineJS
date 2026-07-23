import { useEffect, useRef, useState, type CSSProperties } from "react";
import { RectSelectComponent, type SelectRect } from "@snap-engine/snapline";
import { useSnapLineEngine } from "./Engine";

export interface SelectProps {
  className?: string;
  id?: string;
  style?: CSSProperties;
}

export function Select({
  className,
  id = "select-container",
  style,
}: SelectProps) {
  const engine = useSnapLineEngine();
  const selectRef = useRef<RectSelectComponent | null>(null);

  if (!selectRef.current) {
    selectRef.current = new RectSelectComponent(engine, null);
  }
  const select = selectRef.current;

  // The selection box is framework-rendered: core reports the world-space rect
  // via onRectChange and this state draws it, so consumers can restyle or
  // replace the box (className/style props).
  const [rect, setRect] = useState<SelectRect>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    visible: false,
  });

  useEffect(() => {
    select.selectCallback.onRectChange = (r: SelectRect) => setRect(r);
    return () => {
      select.destroy();
    };
  }, [select]);

  return (
    <div
      id={id}
      className={className}
      data-snapline-type="selection"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.103)",
        position: "absolute",
        top: 0,
        left: 0,
        transformOrigin: "top left",
        pointerEvents: "none",
        display: rect.visible ? "block" : "none",
        width: `${rect.width}px`,
        height: `${rect.height}px`,
        transform: `translate3d(${rect.x}px, ${rect.y}px, 0)`,
        ...style,
      }}
    />
  );
}
