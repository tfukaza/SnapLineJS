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
import { CameraControl } from "@snap-engine/asset-base";
import type {
  CameraWheelConfig,
  CameraPointerConfig,
} from "@snap-engine/asset-base";
import type { CameraConfig } from "@snap-engine/core";
import { useSnapEngine } from "./Engine";

const useClientLayoutEffect =
  typeof window === "undefined" ? useEffect : useLayoutEffect;

export const CameraControlContext = createContext<CameraControl | null>(null);

export function useCameraControl(): CameraControl {
  const cameraControl = useContext(CameraControlContext);
  if (!cameraControl) {
    throw new Error(
      "SnapEngine React camera consumers must be rendered inside <Camera>.",
    );
  }
  return cameraControl;
}

export interface CameraProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  cameraControl?: CameraControl | null;
  /** Options forwarded to the underlying Camera, e.g. zoomBounds and panBounds. */
  cameraConfig?: CameraConfig;
  children: ReactNode;
  panLock?: boolean;
  /** Disable single-pointer panning while leaving pinch panning intact. */
  pointerPanLock?: boolean | "touch";
  /** Require ctrl/cmd for wheel zoom so unmodified scrolling pans the page. */
  wheelZoomModifier?: "none" | "ctrlOrMeta";
  /** Pan on unmodified wheel (trackpad two-finger scroll); ctrl/cmd wheel zooms. */
  wheelPan?: boolean;
  /** Multiplies wheel-zoom speed (default 1); trackpad pinch is scaled up further. */
  zoomSensitivity?: number;
  /** Multiplies wheel-pan speed (default 1 = 1:1 screen pixels), independent of zoom. */
  wheelPanSensitivity?: number;
  /** Which mouse button starts a pointer pan (default "left"). */
  panButton?: "left" | "middle" | "both";
  /** Wheel/trackpad behavior, grouped. Wins over the flat deprecated props. */
  wheel?: CameraWheelConfig;
  /** Pointer behavior, grouped. Wins over the flat deprecated props. */
  pointer?: CameraPointerConfig;
  zoomLock?: boolean;
}

type PendingCameraDestroy = {
  cameraControl: CameraControl;
  element: HTMLDivElement;
  timer: number;
};

const pendingCameraDestroyByElement = new WeakMap<
  HTMLDivElement,
  PendingCameraDestroy
>();
const cameraControlElements = new WeakMap<CameraControl, HTMLDivElement>();

export const Camera = forwardRef<CameraControl, CameraProps>(function Camera(
  {
    cameraControl: providedCameraControl = null,
    cameraConfig,
    children,
    className,
    id = "snap-camera-control",
    panLock = false,
    pointerPanLock = false,
    wheelZoomModifier = "none",
    wheelPan = false,
    zoomSensitivity = 1,
    wheelPanSensitivity = 1,
    panButton = "left",
    wheel = undefined,
    pointer = undefined,
    style,
    zoomLock = false,
    ...divProps
  },
  ref,
) {
  const engine = useSnapEngine();
  const elementRef = useRef<HTMLDivElement>(null);
  const ownedCameraControlRef = useRef<CameraControl | null>(null);
  const [activeCameraControl, setActiveCameraControl] =
    useState<CameraControl | null>(null);

  useClientLayoutEffect(() => {
    const element = elementRef.current;
    if (!element) {
      return;
    }
    const pendingDestroy = pendingCameraDestroyByElement.get(element);
    let cameraControl =
      providedCameraControl ??
      ownedCameraControlRef.current ??
      pendingDestroy?.cameraControl;
    const ownsCameraControl = providedCameraControl == null;

    if (!cameraControl) {
      cameraControl = new CameraControl(engine, {
        panLock,
        zoomLock,
        pointerPanLock,
        wheelZoomModifier,
        wheelPan,
        zoomSensitivity,
        wheelPanSensitivity,
        panButton,
        wheel,
        pointer,
        camera: cameraConfig,
      });
      ownedCameraControlRef.current = cameraControl;
    }

    if (pendingDestroy?.cameraControl === cameraControl) {
      window.clearTimeout(pendingDestroy.timer);
      pendingCameraDestroyByElement.delete(element);
      ownedCameraControlRef.current = cameraControl;
    }

    if (cameraControl.engine !== engine) {
      throw new Error("The injected CameraControl belongs to another Engine.");
    }
    cameraControl.config = {
      ...cameraControl.config,
      panLock,
      zoomLock,
    };
    if (cameraControlElements.get(cameraControl) !== element) {
      cameraControl.element = element;
      cameraControlElements.set(cameraControl, element);
    }
    setActiveCameraControl(cameraControl);

    return () => {
      if (!ownsCameraControl) {
        return;
      }

      const pending: PendingCameraDestroy = {
        cameraControl,
        element,
        timer: 0,
      };
      pending.timer = window.setTimeout(() => {
        if (pendingCameraDestroyByElement.get(element) !== pending) {
          return;
        }
        if (engine.camera === cameraControl.camera) {
          engine.unsubscribeEvent("containerResized", "camera");
          engine.unsubscribeEvent("containerMoved", "camera");
          engine.camera = null;
        }
        cameraControl.destroy(false);
        cameraControlElements.delete(cameraControl);
        if (ownedCameraControlRef.current === cameraControl) {
          ownedCameraControlRef.current = null;
        }
        pendingCameraDestroyByElement.delete(element);
      }, 0);
      pendingCameraDestroyByElement.set(element, pending);
    };
  }, [engine, providedCameraControl]);

  useEffect(() => {
    if (!activeCameraControl) {
      return;
    }
    activeCameraControl.config = {
      ...activeCameraControl.config,
      panLock,
      zoomLock,
      pointerPanLock,
      wheelZoomModifier,
      wheelPan,
      zoomSensitivity,
      wheelPanSensitivity,
      panButton,
      wheel,
      pointer,
    };
  }, [
    activeCameraControl,
    panLock,
    zoomLock,
    pointerPanLock,
    wheelZoomModifier,
    wheelPan,
    zoomSensitivity,
    wheelPanSensitivity,
    panButton,
    wheel,
    pointer,
  ]);

  // Bounds often depend on measured layout, so keep applying them as they change.
  useEffect(() => {
    if (!activeCameraControl || !cameraConfig) {
      return;
    }
    activeCameraControl.setCameraConfig(cameraConfig);
  }, [activeCameraControl, cameraConfig]);

  useImperativeHandle(
    ref,
    () => activeCameraControl as CameraControl,
    [activeCameraControl],
  );

  return (
    <div
      {...divProps}
      id={id}
      className={className}
      ref={elementRef}
      style={{
        height: "100%",
        transformOrigin: "0 0",
        userSelect: "none",
        width: "100%",
        ...style,
      }}
    >
      {activeCameraControl ? (
        <CameraControlContext.Provider value={activeCameraControl}>
          {children}
        </CameraControlContext.Provider>
      ) : null}
    </div>
  );
});
