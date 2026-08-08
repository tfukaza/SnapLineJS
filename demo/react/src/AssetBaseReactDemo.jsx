import { StrictMode, useEffect, useRef, useState } from "react";
import {
  Background,
  Camera,
  Engine,
  useCameraControl,
  useSnapEngine,
} from "@snap-engine/asset-base/react";

function ContextStatus() {
  const engine = useSnapEngine();
  const cameraControl = useCameraControl();

  return (
    <output
      data-testid="asset-base-context-ready"
      data-engine-ready={String(Boolean(engine.containerElement))}
      data-camera-ready={String(Boolean(cameraControl.camera))}
    >
      ready
    </output>
  );
}

function MountedScene({ debug, onBackground, onCamera, onEngine }) {
  const tiles = Array.from({ length: 36 }, (_, index) => {
    const column = index % 6;
    const row = Math.floor(index / 6);
    return {
      id: `tile-${index}`,
      label: `${column},${row}`,
      x: column * 240 - 600,
      y: row * 180 - 450,
    };
  });

  return (
    <Engine
      ref={onEngine}
      debug={debug}
      className="asset-base-react-canvas"
      data-testid="camera-engine"
      style={{ width: "100%" }}
    >
      <Camera ref={onCamera} className="asset-base-react-camera">
        <Background ref={onBackground} />
        <ContextStatus />
        <div className="asset-base-react-world">
          {tiles.map((tile) => (
            <div
              className="asset-base-react-tile"
              key={tile.id}
              style={{ transform: `translate(${tile.x}px, ${tile.y}px)` }}
            >
              {tile.label}
            </div>
          ))}
        </div>
      </Camera>
    </Engine>
  );
}

export default function AssetBaseReactDemo() {
  const initializedCameras = useRef(new WeakSet());
  const [background, setBackground] = useState(null);
  const [cameraControl, setCameraControl] = useState(null);
  const [debug, setDebug] = useState(false);
  const [engine, setEngine] = useState(null);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    if (!cameraControl || initializedCameras.current.has(cameraControl)) {
      return;
    }
    initializedCameras.current.add(cameraControl);
    cameraControl.zoomBy(-0.35);
    cameraControl.setCameraPosition(-200, -120);
  }, [cameraControl]);

  return (
    <main className="asset-base-react-demo">
      <div className="asset-base-react-toolbar">
        <button
          data-testid="toggle-engine"
          onClick={() => setMounted((value) => !value)}
          type="button"
        >
          {mounted ? "Unmount" : "Mount"}
        </button>
        <button
          data-testid="toggle-debug"
          onClick={() => setDebug((value) => !value)}
          type="button"
        >
          Debug
        </button>
        <output
          data-testid="asset-base-ref-status"
          data-background-ref={String(Boolean(background))}
          data-camera-ref={String(Boolean(cameraControl))}
          data-engine-ref={String(Boolean(engine))}
        >
          refs
        </output>
      </div>
      {mounted ? (
        <StrictMode>
          <MountedScene
            debug={debug}
            onBackground={setBackground}
            onCamera={setCameraControl}
            onEngine={setEngine}
          />
        </StrictMode>
      ) : null}
    </main>
  );
}
