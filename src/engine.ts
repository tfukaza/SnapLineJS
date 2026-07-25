import { StationaryCamera } from "./camera";
import type { Camera } from "./camera";
import { GlobalManager } from "./global";
import { InputControl } from "./input";
import type { eventPosition } from "./input";
import { BaseObject, FrameTask, detachAnimationFromOwner } from "./object";
import type { CollisionEngine } from "./collision";
import type { AnimationInterface } from "./animation";
import type { DebugRenderer } from "./debug";
import type { FrameStats } from "./object";

export interface EngineConfig {}

export interface EdgePanController {
  startEdgePan(
    pointerId: number,
    position: eventPosition,
    onFrame: (position: eventPosition) => void,
  ): void;
  updateEdgePan(pointerId: number, position: eventPosition): void;
  stopEdgePan(pointerId: number): void;
}

const DEFAULT_ENGINE_CONFIG: EngineConfig = {};

function reportFrameTaskError(error: unknown): void {
  const reportedError =
    error instanceof Error ? error : new Error(String(error));
  if (typeof globalThis.reportError === "function") {
    globalThis.reportError(reportedError);
    return;
  }
  console.error(reportedError);
}

/**
 * Available engine event types that can be subscribed to.
 */
export type EngineEventType =
  | "containerAssigned"
  | "containerResized"
  | "containerMoved";

/**
 * Container bounds data passed to engine event callbacks.
 */
export interface ContainerBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
}

/**
 * Props passed to engine event callbacks.
 */
export interface EngineEventProps {
  element: HTMLElement;
  bounds: ContainerBounds;
}

type AnimationProcessor = (timestamp: number) => void;
type DebugMarker = {
  type: "point" | "rect" | "circle" | "text" | "line";
  objectId: string;
  id: string;
  persistent: boolean;
  color: string;
  tag?: string;
  x: number;
  y: number;
  x2?: number;
  y2?: number;
  width?: number;
  height?: number;
  radius?: number;
  text?: string;
  filled?: boolean;
  lineWidth?: number;
  arrowEnd?: boolean;
  arrowStart?: boolean;
  arrowSize?: number;
};

/**
 * The main engine class that manages the rendering loop, object updates,
 * and optional features like animations, collisions, camera controls, and debugging.
 *
 * Multiple Engine instances can coexist, each managing their own canvas and render pipeline
 * while sharing a GlobalManager singleton for ID generation and render scheduling.
 *
 * Features can be enabled on-demand to keep bundle sizes small:
 * - Animation engine via `enableAnimationEngine()`
 * - Collision detection via `enableCollisionEngine()`
 * - Camera controls via `enableCameraControl()`
 * - Debug visualization via `enableDebug()`
 */
class Engine {
  #engineConfig: EngineConfig; // Engine configuration options
  #global: GlobalManager | null = null; // Reference to the global manager
  #input: InputControl;

  #containerElement: HTMLElement | null = null; // The DOM element for the engine's container.
  #containerBounds: ContainerBounds | null = null; // Cached bounding rect of the container
  #camera: Camera | null = null; // Optional camera instance
  #edgePanController: EdgePanController | null = null;
  #collisionEngine: CollisionEngine | null = null; // Optional collision engine instance
  #animationList: AnimationInterface[] = []; // List of active animations, if animation engine is enabled
  #animationProcessor: AnimationProcessor | null = null;
  #debugMarkerList: Record<string, DebugMarker> = {}; // Debug markers by ID
  #debugEnabledTags: Set<string> | null = null; // null = show all, Set = filter to these tags
  #debugRenderer: DebugRenderer | null = null;

  // Event subscribers - allows multiple listeners per event type
  #eventSubscribers: Record<
    EngineEventType,
    Record<string, (props: EngineEventProps) => void>
  > = {
    containerAssigned: {},
    containerResized: {},
    containerMoved: {},
  };

  #resizeObserver: ResizeObserver | null = null;
  #scrollHandler = () => {
    const element = this.#containerElement;
    if (!element) {
      return;
    }
    this.#updateContainerBounds(element);
    this.#publishEvent("containerMoved", element);
  };

  constructor(config: EngineConfig = {}) {
    this.#global = GlobalManager.getInstance();
    this.#input = new InputControl(this.#global, this);
    this.#global.registerEngine(this);
    this.#engineConfig = {
      ...DEFAULT_ENGINE_CONFIG,
      ...config,
    };
  }

  get engineConfig(): EngineConfig {
    return this.#engineConfig;
  }

  set engineConfig(config: EngineConfig) {
    this.#engineConfig = config;
  }

  get global(): GlobalManager | null {
    return this.#global;
  }

  set global(global: GlobalManager | null) {
    this.#global = global;
  }

  get input(): InputControl {
    return this.#input;
  }

  set input(input: InputControl) {
    this.#input = input;
  }

  get containerElement(): HTMLElement | null {
    return this.#containerElement;
  }

  set containerElement(element: HTMLElement | null) {
    this.#containerElement = element;
  }

  get containerBounds(): ContainerBounds | null {
    return this.#containerBounds;
  }

  set containerBounds(bounds: ContainerBounds | null) {
    this.#containerBounds = bounds;
  }

  get camera(): Camera | null {
    return this.#camera;
  }

  set camera(camera: Camera | null) {
    this.#camera = camera;
  }

  get edgePanController(): EdgePanController | null {
    return this.#edgePanController;
  }

  set edgePanController(controller: EdgePanController | null) {
    this.#edgePanController = controller;
  }

  get collisionEngine(): CollisionEngine | null {
    return this.#collisionEngine;
  }

  set collisionEngine(collisionEngine: CollisionEngine | null) {
    this.#collisionEngine = collisionEngine;
  }

  get animationList(): AnimationInterface[] {
    return this.#animationList;
  }

  set animationList(animationList: AnimationInterface[]) {
    this.#animationList = animationList;
  }

  get debugMarkerList(): Record<string, DebugMarker> {
    return this.#debugMarkerList;
  }

  set debugMarkerList(debugMarkerList: Record<string, DebugMarker>) {
    this.#debugMarkerList = debugMarkerList;
  }

  get debugEnabledTags(): Set<string> | null {
    return this.#debugEnabledTags;
  }

  set debugEnabledTags(tags: Set<string> | null) {
    this.#debugEnabledTags = tags;
  }

  getObject(id: string): BaseObject | null {
    const table = this.#global?.getEngineObjectTable(this);
    if (!table) return null;
    return table[id];
  }

  /**
   * Subscribe to an engine event with a unique identifier.
   * Multiple subscribers can listen to the same event.
   *
   * @param event - The event type to subscribe to
   * @param id - A unique identifier for this subscription (used for unsubscribing)
   * @param callback - The callback function to invoke when the event fires
   */
  subscribeEvent(
    event: EngineEventType,
    id: string,
    callback: (props: EngineEventProps) => void,
  ) {
    this.#eventSubscribers[event][id] = callback;
  }

  /**
   * Unsubscribe from an engine event.
   *
   * @param event - The event type to unsubscribe from
   * @param id - The unique identifier used when subscribing
   */
  unsubscribeEvent(event: EngineEventType, id: string) {
    delete this.#eventSubscribers[event][id];
  }

  /**
   * Update the cached container bounds from an element's bounding rect.
   * @internal
   */
  #updateContainerBounds(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    this.#containerBounds = {
      left: rect.left,
      top: rect.top,
      right: rect.right,
      bottom: rect.bottom,
      width: rect.width,
      height: rect.height,
    };
  }

  /**
   * Publish an event to all subscribers.
   * @internal
   */
  #publishEvent(event: EngineEventType, element: HTMLElement) {
    const callbacks = Object.values(this.#eventSubscribers[event]);
    if (callbacks.length === 0) {
      return;
    }

    // Ensure bounds are up-to-date for subscribers
    this.#updateContainerBounds(element);

    const props: EngineEventProps = {
      element,
      bounds: this.#containerBounds!,
    };

    for (const callback of callbacks) {
      callback(props);
    }
  }

  /**
   * Initialize DOM elements, and event listeners for the library.
   * This must be handled outside the constructor since many frontend frameworks
   * run Component constructors before the DOM element is available.
   *
   * @param element: The element acting as the container.
   */
  assignDom(element: HTMLElement) {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    window.removeEventListener("scroll", this.#scrollHandler);

    this.#containerElement = element;
    // Camera may not be set if cameraControl was not used
    if (!this.#camera) {
      this.#camera = new StationaryCamera(this);
    }
    this.#camera.containerDom = element;

    // Always compute initial container bounds
    this.#updateContainerBounds(element);
    this.#input.bindContainer(element);

    // Set up resize observer
    this.#resizeObserver = new ResizeObserver(() => {
      const containerElement = this.#containerElement;
      if (!containerElement) {
        return;
      }
      this.#updateContainerBounds(containerElement);
      this.#publishEvent("containerResized", containerElement);
    });
    this.#resizeObserver?.observe(element);
    this.#resizeObserver?.observe(window.document.body);
    window.addEventListener("scroll", this.#scrollHandler);

    this.#publishEvent("containerAssigned", element);
  }

  set element(containerDom: HTMLElement) {
    this.assignDom(containerDom);
  }

  /**
   * Sets the debug renderer for visualization overlay.
   *
   * @param renderer - The debug renderer instance to use
   */
  setDebugRenderer(renderer: DebugRenderer) {
    if (this.#containerElement == null) {
      return;
    }
    if (this.#debugRenderer) {
      return; // Already enabled
    }
    this.#debugRenderer = renderer;
    this.#debugRenderer.enable(this);
  }

  get debugRenderer(): DebugRenderer | null {
    return this.#debugRenderer;
  }

  /**
   * Disables and removes the debug visualization overlay.
   */
  disableDebug() {
    if (this.#debugRenderer) {
      this.#debugRenderer.disable();
      this.#debugRenderer = null;
    }
  }

  async #processQueue(
    _stage: string,
    queue: Map<string, Map<string, FrameTask>>,
  ) {
    for (const queueEntry of queue.values()) {
      // Check if the object belongs to this engine
      // All entries in the inner map belong to the same object.
      const firstEntry = queueEntry.values().next().value;
      if (!firstEntry || firstEntry.object.engine !== this) {
        continue;
      }

      for (const objectEntry of queueEntry.values()) {
        if (!objectEntry.callback) {
          continue;
        }
        for (const callback of objectEntry.callback) {
          try {
            await callback();
          } catch (error) {
            // One bad integration callback must not reject the shared frame
            // pipeline and permanently stop every engine's animation loop.
            // Surface the error globally, then continue with queued cleanup.
            reportFrameTaskError(error);
          }
        }
      }
    }
  }

  /**
   * Internal method to process a single render stage.
   * Called by GlobalManager's render loop.
   * @internal
   */
  processStage(
    stage: string,
    queue: Map<string, Map<string, FrameTask>>,
  ): Promise<void> {
    return this.#processQueue(stage, queue);
  }

  /**
   * Internal method to process animations.
   * Called by GlobalManager's render loop between WRITE_2 and READ_3.
   * @internal
   */
  processAnimations(timestamp: number): void {
    this.#animationProcessor?.(timestamp);
  }

  /**
   * Internal method to run collision detection.
   * Called by GlobalManager's render loop before READ_1.
   * @internal
   */
  processCollisions(): void {
    this.#collisionEngine?.detectCollisions();
  }

  /**
   * Internal method to process post-render tasks (debug).
   * Called by GlobalManager's render loop after all stages complete.
   * @internal
   */
  processPostRender(timestamp: number): void {
    const stats: FrameStats = { timestamp };
    const localObjectTable = this.#global!.getEngineObjectTable(this) ?? {};
    this.#debugRenderer?.renderFrame(stats, this, localObjectTable);
  }

  /**
   * Sets a collision engine instance for collision detection.
   *
   * This method allows you to inject a collision engine from a separate import,
   * enabling true tree-shaking when collision detection is not used.
   *
   * @param collisionEngine - The collision engine instance to use`
   */
  setCollisionEngine(collisionEngine: CollisionEngine) {
    if (this.#collisionEngine) {
      return;
    }
    this.#collisionEngine = collisionEngine;
  }

  /**
   * Enables the animation engine for processing Web Animations API animations.
   *
   * The animation engine processes animations each frame. This method only sets up
   * the processing loop - animation classes should be imported separately.
   */
  enableAnimationEngine() {
    if (this.#animationProcessor) {
      return;
    }

    this.#animationProcessor = (timestamp: number) => {
      const newAnimationList: AnimationInterface[] = [];
      for (const animation of this.#animationList) {
        const shouldKeep =
          animation.calculateFrame(timestamp) === false &&
          animation.requestDelete === false;

        if (shouldKeep) {
          newAnimationList.push(animation);
        } else {
          detachAnimationFromOwner(animation);
        }
      }
      this.#animationList = newAnimationList;
    };
  }

  /**
   * Destroys this Engine instance, cleaning up resources and unregistering from GlobalManager.
   *
   * This stops the render loop, removes event listeners, and ensures the engine
   * no longer participates in global rendering.
   */
  destroy() {
    this.#resizeObserver?.disconnect();
    this.#resizeObserver = null;
    window.removeEventListener("scroll", this.#scrollHandler);
    this.#input.destroy();

    // Unregister from global manager
    this.#global!.unregisterEngine(this);

    // Disable debug renderer
    if (this.#debugRenderer) {
      this.disableDebug();
    }

    // Clear references
    this.#containerElement = null;
    this.#camera = null;
    this.#collisionEngine = null;
    this.#animationList = [];
    this.#debugMarkerList = {};
    this.#animationProcessor = null;
  }
}

export { Engine };
