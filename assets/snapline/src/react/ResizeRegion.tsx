import {
  forwardRef,
  useContext,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { ResizeRegionMirror, type ResizeHandle } from "@snap-engine/snapline";
import { NodeMirrorContext } from "./Node";

export interface ResizeRegionProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  handle: ResizeHandle;
  children?: ReactNode;
}

export const ResizeRegion = forwardRef<ResizeRegionMirror, ResizeRegionProps>(
  function ResizeRegion({ handle, children, style, ...elementProps }, ref) {
    const node = useContext(NodeMirrorContext);
    if (!node) {
      throw new Error("ResizeRegion must be rendered inside a Node or Group.");
    }

    const elementRef = useRef<HTMLDivElement>(null);
    const [region] = useState(
      () => new ResizeRegionMirror(node.engine, node, handle),
    );
    if (region.node !== node || region.handle !== handle) {
      throw new Error(
        "ResizeRegion owner and handle cannot change after mounting; remount it with a new key.",
      );
    }

    useImperativeHandle(ref, () => region, [region]);

    useLayoutEffect(() => {
      if (elementRef.current) region.element = elementRef.current;
      const boundElement = elementRef.current;
      return () => {
        if (boundElement) region.detachElement(boundElement);
        region.destroy(false);
      };
    }, [region]);

    return (
      <div
        {...elementProps}
        ref={elementRef}
        data-snapline-part="resize-region"
        data-handle={handle}
        style={{
          ...style,
          pointerEvents: "auto",
          touchAction: "none",
        }}
      >
        {children}
      </div>
    );
  },
);
