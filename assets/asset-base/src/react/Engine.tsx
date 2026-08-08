import {
  createContext,
  forwardRef,
  useContext,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
  type ReactNode,
} from "react";
import { Engine as CoreEngine } from "@snap-engine/core";
import { CollisionEngine } from "@snap-engine/core/collision";
import { DebugRenderer } from "@snap-engine/core/debug";

const useClientLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export const EngineContext = createContext<CoreEngine | null>(null);

export function useSnapEngine(): CoreEngine {
  const engine = useContext(EngineContext);
  if (!engine) {
    throw new Error(
      "SnapEngine React components must be rendered inside <Engine>.",
    );
  }
  return engine;
}

export interface EngineProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  children: ReactNode;
  debug?: boolean;
  engine?: CoreEngine | null;
}

type PendingEngineDestroy = {
  element: HTMLDivElement;
  engine: CoreEngine;
  timer: number;
};

const pendingEngineDestroyByElement = new WeakMap<
  HTMLDivElement,
  PendingEngineDestroy
>();

export const Engine = forwardRef<CoreEngine, EngineProps>(function Engine(
  {
    children,
    className,
    debug = false,
    engine: providedEngine = null,
    id = "snap-canvas",
    style,
    ...divProps
  },
  ref,
) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const ownedEngineRef = useRef<CoreEngine | null>(null);
  const [activeEngine, setActiveEngine] = useState<CoreEngine | null>(null);

  useClientLayoutEffect(() => {
    const element = canvasRef.current;
    if (!element) {
      return;
    }
    const pendingDestroy = pendingEngineDestroyByElement.get(element);
    let resolvedEngine =
      providedEngine ?? ownedEngineRef.current ?? pendingDestroy?.engine;
    const ownsEngine = providedEngine == null;

    if (!resolvedEngine) {
      resolvedEngine = new CoreEngine();
      ownedEngineRef.current = resolvedEngine;
    }

    if (pendingDestroy?.engine === resolvedEngine) {
      window.clearTimeout(pendingDestroy.timer);
      pendingEngineDestroyByElement.delete(element);
      ownedEngineRef.current = resolvedEngine;
    }

    if (!resolvedEngine.collisionEngine) {
      resolvedEngine.setCollisionEngine(new CollisionEngine());
    }
    if (
      resolvedEngine.containerElement !== element
    ) {
      resolvedEngine.assignDom(element);
      resolvedEngine.camera?.setCameraPosition(0, 0);
    }
    setActiveEngine(resolvedEngine);

    return () => {
      resolvedEngine.disableDebug();

      if (!ownsEngine) {
        return;
      }

      const pending: PendingEngineDestroy = {
        element,
        engine: resolvedEngine,
        timer: 0,
      };
      pending.timer = window.setTimeout(() => {
        if (pendingEngineDestroyByElement.get(element) !== pending) {
          return;
        }
        resolvedEngine.destroy();
        if (ownedEngineRef.current === resolvedEngine) {
          ownedEngineRef.current = null;
        }
        pendingEngineDestroyByElement.delete(element);
      }, 10);
      pendingEngineDestroyByElement.set(element, pending);
    };
  }, [providedEngine]);

  useEffect(() => {
    if (!activeEngine) {
      return;
    }
    if (debug) {
      activeEngine.setDebugRenderer(new DebugRenderer());
    } else {
      activeEngine.disableDebug();
    }
  }, [activeEngine, debug]);

  useImperativeHandle(ref, () => activeEngine as CoreEngine, [activeEngine]);

  return (
    <div
      {...divProps}
      id={id}
      className={className}
      ref={canvasRef}
      style={{
        height: "100%",
        overflow: "visible",
        position: "relative",
        ...style,
      }}
    >
      {activeEngine ? (
        <EngineContext.Provider value={activeEngine}>
          {children}
        </EngineContext.Provider>
      ) : null}
    </div>
  );
});
