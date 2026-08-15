import { useCallback, useReducer } from "react";
import { flushSync } from "react-dom";

/** Force newly rendered SnapSort adapters to run their attachment effects. */
export function useFlushSnapSortAttachments(): () => void {
  const [, forceFlush] = useReducer((version: number) => version + 1, 0);

  return useCallback(() => {
    flushSync(() => {
      forceFlush();
    });
  }, []);
}
