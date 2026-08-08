import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState,
  type HTMLAttributes,
} from "react";
import { Background as BackgroundObject } from "@snap-engine/asset-base";
import { useSnapEngine } from "./Engine";

const useClientLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export interface BackgroundProps extends HTMLAttributes<HTMLDivElement> {
  backgroundObject?: BackgroundObject | null;
}

type PendingBackgroundDestroy = {
  background: BackgroundObject;
  element: HTMLDivElement;
  timer: number;
};

const pendingBackgroundDestroyByElement = new WeakMap<
  HTMLDivElement,
  PendingBackgroundDestroy
>();

export const Background = forwardRef<BackgroundObject, BackgroundProps>(
  function Background(
    {
      backgroundObject: providedBackground = null,
      className,
      id = "sl-background",
      style,
      ...divProps
    },
    ref,
  ) {
    const engine = useSnapEngine();
    const elementRef = useRef<HTMLDivElement>(null);
    const ownedBackgroundRef = useRef<BackgroundObject | null>(null);
    const [activeBackground, setActiveBackground] =
      useState<BackgroundObject | null>(null);

    useClientLayoutEffect(() => {
      const element = elementRef.current;
      if (!element) {
        return;
      }
      const pendingDestroy = pendingBackgroundDestroyByElement.get(element);
      let background =
        providedBackground ??
        ownedBackgroundRef.current ??
        pendingDestroy?.background;
      const ownsBackground = providedBackground == null;

      if (!background) {
        background = new BackgroundObject(engine, null);
        ownedBackgroundRef.current = background;
      }

      if (pendingDestroy?.background === background) {
        window.clearTimeout(pendingDestroy.timer);
        pendingBackgroundDestroyByElement.delete(element);
        ownedBackgroundRef.current = background;
      }

      if (background.engine !== engine) {
        throw new Error("The injected Background belongs to another Engine.");
      }
      if (background.element !== element) {
        background.element = element;
      }
      setActiveBackground(background);

      return () => {
        if (!ownsBackground) {
          return;
        }

        const pending: PendingBackgroundDestroy = {
          background,
          element,
          timer: 0,
        };
        pending.timer = window.setTimeout(() => {
          if (pendingBackgroundDestroyByElement.get(element) !== pending) {
            return;
          }
          background.destroy(false);
          if (ownedBackgroundRef.current === background) {
            ownedBackgroundRef.current = null;
          }
          pendingBackgroundDestroyByElement.delete(element);
        }, 0);
        pendingBackgroundDestroyByElement.set(element, pending);
      };
    }, [engine, providedBackground]);

    useImperativeHandle(
      ref,
      () => activeBackground as BackgroundObject,
      [activeBackground],
    );

    return (
      <div
        {...divProps}
        id={id}
        className={className}
        ref={elementRef}
        style={{
          backgroundColor: "#fff",
          backgroundImage:
            "radial-gradient(circle, #cccccc 2px, transparent 1px)",
          userSelect: "none",
          ...style,
        }}
      />
    );
  },
);
