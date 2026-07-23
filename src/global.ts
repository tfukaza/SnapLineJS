import { BaseObject, FrameTask } from "./object";
import type { Engine } from "./engine";

type renderEntry = Map<string, Map<string, FrameTask>>;

interface RenderQueue {
  READ_1: renderEntry;
  WRITE_1: renderEntry;
  READ_2: renderEntry;
  WRITE_2: renderEntry;
  READ_3: renderEntry;
  WRITE_3: renderEntry;
}

/**
 * Central state manager shared across all engine instances.
 *
 * Manages global state including:
 * - Unique object ID generation
 * - Shared render queues for synchronized rendering across all engines
 * - Shared data storage
 * - Engine instance registry
 *
 * This is a singleton - only one instance exists per application.
 * Multiple Engine instances share the same GlobalManager and render pipeline.
 */
class GlobalManager {
  static #instance: GlobalManager | null = null;

  #engineObjectTables: Map<Engine, Record<string, BaseObject>>;
  #data: any;
  #id: number;
  #suspenders: Map<string, Set<string>>;

  currentStage:
    | "IDLE"
    | "READ_1"
    | "WRITE_1"
    | "READ_2"
    | "WRITE_2"
    | "READ_3"
    | "WRITE_3";
  queue: RenderQueue;

  private constructor() {
    this.#engineObjectTables = new Map();
    this.#data = {};
    this.#id = 0;
    this.#suspenders = new Map();
    this.currentStage = "IDLE";
    this.queue = {
      READ_1: new Map(),
      WRITE_1: new Map(),
      READ_2: new Map(),
      WRITE_2: new Map(),
      READ_3: new Map(),
      WRITE_3: new Map(),
    };
  }

  /**
   * Gets the singleton instance of GlobalManager.
   * Creates it if it doesn't exist yet.
   *
   * @returns The GlobalManager singleton instance
   */
  static getInstance(): GlobalManager {
    if (!GlobalManager.#instance) {
      GlobalManager.#instance = new GlobalManager();
    }
    return GlobalManager.#instance;
  }

  /**
   * Resets the singleton instance. Useful for testing.
   * WARNING: This will affect all Engine instances using this GlobalManager.
   */
  static resetInstance(): void {
    GlobalManager.#instance = null;
  }

  /**
   * Registers an Engine instance.
   * Called automatically by Engine constructor.
   *
   * @param engine - The Engine instance to register
   * @internal
   */
  registerEngine(engine: Engine): void {
    const shouldStartRenderLoop = this.#engineObjectTables.size === 0;

    if (!this.#engineObjectTables.has(engine)) {
      this.#engineObjectTables.set(engine, {});
    }

    // Start the global render loop if this is the first engine
    if (shouldStartRenderLoop) {
      this.#startRenderLoop();
    }
  }

  /**
   * Unregisters an Engine instance from the global render pipeline.
   * Should be called when an Engine is destroyed.
   *
   * @param engine - The Engine instance to unregister
   * @internal
   */
  unregisterEngine(engine: Engine): void {
    this.#engineObjectTables.delete(engine);

    // Stop the global render loop if no engines remain
    if (this.#engineObjectTables.size === 0) {
      this.#stopRenderLoop();
    }
  }

  #animationFrameId: number | null = null;

  /**
   * Starts the global render loop.
   * Batches render stages across all engines to prevent layout thrashing.
   * @internal
   */
  #startRenderLoop(): void {
    if (this.#animationFrameId !== null) {
      return; // Already running
    }

    const step = () => {
      void (async () => {
        const timestamp = Date.now();

        // Process each stage for ALL engines before moving to the next stage.
        // Stages are awaited so framework adapters can flush DOM work from
        // queued callbacks before the next layout read.

        // READ_1 stage for all engines
        this.currentStage = "READ_1";
        for (const engine of this.#engineObjectTables.keys()) {
          await engine.processStage("READ_1", this.queue.READ_1);
        }
        this.queue.READ_1 = new Map();

        // Collision detection after READ_1 so colliders have up-to-date positions
        for (const engine of this.#engineObjectTables.keys()) {
          engine.processCollisions();
        }

        // WRITE_1 stage for all engines
        this.currentStage = "WRITE_1";
        for (const engine of this.#engineObjectTables.keys()) {
          await engine.processStage("WRITE_1", this.queue.WRITE_1);
        }
        this.queue.WRITE_1 = new Map();

        // READ_2 stage for all engines
        this.currentStage = "READ_2";
        for (const engine of this.#engineObjectTables.keys()) {
          await engine.processStage("READ_2", this.queue.READ_2);
        }
        this.queue.READ_2 = new Map();

        // WRITE_2 stage for all engines
        this.currentStage = "WRITE_2";
        for (const engine of this.#engineObjectTables.keys()) {
          await engine.processStage("WRITE_2", this.queue.WRITE_2);
        }
        this.queue.WRITE_2 = new Map();

        // Animation processing for all engines
        for (const engine of this.#engineObjectTables.keys()) {
          engine.processAnimations(timestamp);
        }

        // READ_3 stage for all engines
        this.currentStage = "READ_3";
        for (const engine of this.#engineObjectTables.keys()) {
          await engine.processStage("READ_3", this.queue.READ_3);
        }
        this.queue.READ_3 = new Map();

        // WRITE_3 stage for all engines
        this.currentStage = "WRITE_3";
        for (const engine of this.#engineObjectTables.keys()) {
          await engine.processStage("WRITE_3", this.queue.WRITE_3);
        }
        this.queue.WRITE_3 = new Map();

        this.currentStage = "IDLE";

        // Post-render processing (collisions, debug) for all engines
        for (const engine of this.#engineObjectTables.keys()) {
          engine.processPostRender(timestamp);
        }

        if (this.#engineObjectTables.size > 0) {
          this.#animationFrameId = window.requestAnimationFrame(step);
        } else {
          this.#animationFrameId = null;
        }

        // When rAF callback ends, and if there are no more Event callbacks,
        // the browser can begin painting.
      })();
    };

    this.#animationFrameId = window.requestAnimationFrame(step);
  }

  /**
   * Stops the global render loop.
   * @internal
   */
  #stopRenderLoop(): void {
    if (this.#animationFrameId !== null) {
      window.cancelAnimationFrame(this.#animationFrameId);
      this.#animationFrameId = null;
    }
  }

  /**
   * Generates a unique identifier for objects.
   *
   * @returns A unique string ID that increments with each call.
   */
  createId() {
    this.#id++;
    return this.#id.toString();
  }

  get data(): any {
    return this.#data;
  }

  /**
   * Owned suspension channels. Unlike a shared boolean on `data` (last writer
   * wins — an unrelated gesture ending could re-enable a channel another
   * gesture still holds suspended), each suspender registers a token and the
   * channel stays suspended until every token resumes. Tokens are idempotent:
   * suspending twice with the same token holds one slot, and resuming a token
   * that never suspended is a no-op — so dual release paths are safe.
   */
  suspend(channel: string, token: string): void {
    let tokens = this.#suspenders.get(channel);
    if (!tokens) {
      tokens = new Set();
      this.#suspenders.set(channel, tokens);
    }
    tokens.add(token);
  }

  resume(channel: string, token: string): void {
    const tokens = this.#suspenders.get(channel);
    if (!tokens) return;
    tokens.delete(token);
    if (tokens.size === 0) this.#suspenders.delete(channel);
  }

  isSuspended(channel: string): boolean {
    return (this.#suspenders.get(channel)?.size ?? 0) > 0;
  }

  getEngineObjectTable(engine: Engine): Record<string, BaseObject> {
    const table = this.#engineObjectTables.get(engine);
    if (!table) {
      throw new Error("Cannot get an object table for an unregistered engine.");
    }

    return table;
  }

  registerObject(object: BaseObject): void {
    if (!object.engine) {
      throw new Error("Cannot register an object without an engine.");
    }

    const table = this.getEngineObjectTable(object.engine);
    table[object.id] = object;
  }

  unregisterObject(object: BaseObject): void {
    const table = this.getEngineObjectTable(object.engine);
    delete table[object.id];
  }
}

export { GlobalManager };
