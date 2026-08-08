import { useCallback, useReducer } from "react";
import { flushSync } from "react-dom";

/**
 * @deprecated The React Container now commits SnapSort mutations inside an
 * adapter-owned flushSync transaction. No callback wiring is required.
 */
export function useSnapSortAwaitMutation(): () => void {
  const [, forceFlush] = useReducer((version: number) => version + 1, 0);

  return useCallback(() => {
    flushSync(() => {
      forceFlush();
    });
  }, []);
}
