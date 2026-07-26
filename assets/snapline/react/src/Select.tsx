import { useLayoutEffect, useRef, type CSSProperties } from "react";
import { RectSelectController, type SelectCallbacks } from "@snap-engine/snapline";
import { useSnapLineEngine } from "./Engine";

export interface SelectProps {
  className?: string;
  id?: string;
  style?: CSSProperties;
  callbacks?: SelectCallbacks;
}

export function Select({
  className,
  id = "select-container",
  style,
  callbacks = {},
}: SelectProps) {
  const engine = useSnapLineEngine();
  const selectRef = useRef<RectSelectController | null>(null);
  const selectDomRef = useRef<HTMLDivElement>(null);

  if (!selectRef.current) {
    selectRef.current = new RectSelectController(engine, null, { callbacks });
  }
  const select = selectRef.current;

  useLayoutEffect(() => {
    const unbind = select.bindGeometryWriter((rect) => {
      const element = selectDomRef.current;
      if (!element) return;
      element.style.display = rect.visible ? "block" : "none";
      element.style.width = `${rect.width}px`;
      element.style.height = `${rect.height}px`;
      element.style.transform = `translate3d(${rect.x}px, ${rect.y}px, 0)`;
    });
    return () => {
      unbind();
      select.destroy(false);
    };
  }, [select]);

  return (
    <div
      id={id}
      ref={selectDomRef}
      className={className}
      data-snapline-type="selection"
      style={{
        backgroundColor: "rgba(0, 0, 0, 0.103)",
        position: "absolute",
        top: 0,
        left: 0,
        transformOrigin: "top left",
        pointerEvents: "none",
        display: "none",
        width: 0,
        height: 0,
        transform: "translate3d(0px, 0px, 0)",
        ...style,
      }}
    />
  );
}
