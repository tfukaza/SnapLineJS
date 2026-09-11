import {
  forwardRef,
  useCallback,
  useContext,
  useRef,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { ItemObjectContext } from "./Item";

export interface HandleProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children: ReactNode;
  className?: string;
}

export const Handle = forwardRef<HTMLDivElement, HandleProps>(function Handle(
  { children, className = "", style, ...divProps },
  ref,
) {
  const item = useContext(ItemObjectContext);
  const handleRef = useRef<HTMLDivElement>(null);
  const setHandleElement = useCallback(
    (handleElement: HTMLDivElement | null) => {
      const previousElement = handleRef.current;
      if (item && previousElement) item.removeInputAlias(previousElement);

      handleRef.current = handleElement;
      if (item && handleElement) item.addInputAlias(handleElement);

      if (typeof ref === "function") ref(handleElement);
      else if (ref) ref.current = handleElement;
    },
    [item, ref],
  );

  return (
    <div
      {...divProps}
      ref={setHandleElement}
      className={`snapsort-handle ${className}`.trim()}
      style={style}
    >
      {children}
    </div>
  );
});
