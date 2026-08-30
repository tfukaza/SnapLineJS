import type { Engine, FrameInfo } from "@snap-engine/core";

export interface VirtualPointerPoint {
  // Coordinates are CSS pixels relative to the controller's coordinate root.
  readonly x: number;
  readonly y: number;
}

export type VirtualPointerTarget =
  | Element
  | VirtualPointerPoint
  | (() => Element | VirtualPointerPoint | null);

export type VirtualPointerElementTarget = Element | (() => Element | null);

export interface VirtualPointerMoveOptions {
  readonly duration?: number;
  readonly arc?: number;
  readonly dispatchEvent?: boolean;
  readonly trackTarget?: boolean;
  readonly stopWhen?: () => boolean;
}

export interface VirtualPointerWaitUntilOptions {
  readonly timeout?: number;
}

export interface VirtualPointerClickOptions {
  readonly holdDuration?: number;
}

export interface VirtualPointerDragOptions {
  readonly sourceMove?: VirtualPointerMoveOptions;
  readonly dragMove?: VirtualPointerMoveOptions;
  readonly pressDuration?: number;
}

type FrameOperation = {
  readonly name: string;
  readonly advance: (
    frame: FrameInfo,
    coordinateRootOrigin: VirtualPointerPoint,
  ) => boolean;
  readonly resolve: () => void;
  readonly reject: (reason: unknown) => void;
};

interface VirtualPointerControllerOptions {
  readonly coordinateRoot: HTMLElement;
  readonly signal: AbortSignal;
  readonly pointerId?: number;
}

const DEFAULT_VIRTUAL_MOUSE_POINTER_ID = 2_000_000_001;
const DEFAULT_MOVE_DURATION = 420;
const DEFAULT_CLICK_HOLD_DURATION = 90;
const DEFAULT_WAIT_UNTIL_TIMEOUT = 5_000;
const DEFAULT_DRAG_ACTIVATION_DISTANCE = 4;

function isPoint(
  value: Element | VirtualPointerPoint,
): value is VirtualPointerPoint {
  return !(value instanceof Element);
}

function centerOf(
  element: Element,
  coordinateRootOrigin: VirtualPointerPoint,
): VirtualPointerPoint {
  const rect = element.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 - coordinateRootOrigin.x,
    y: rect.top + rect.height / 2 - coordinateRootOrigin.y,
  };
}

function easeInOutCubic(progress: number): number {
  return progress < 0.5
    ? 4 * progress * progress * progress
    : 1 - Math.pow(-2 * progress + 2, 3) / 2;
}

function abortReason(signal: AbortSignal): unknown {
  return (
    signal.reason ??
    new DOMException("Virtual pointer run aborted.", "AbortError")
  );
}

function assertDuration(value: number, name: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new RangeError(`${name} must be a finite non-negative number.`);
  }
}

function resolveTarget(
  target: VirtualPointerTarget,
): Element | VirtualPointerPoint {
  const resolved = typeof target === "function" ? target() : target;
  if (!resolved) {
    throw new Error("Virtual pointer target is not available.");
  }
  if (resolved instanceof Element && !resolved.isConnected) {
    throw new Error("Virtual pointer target is not connected.");
  }
  return resolved;
}

function resolveElementTarget(target: VirtualPointerElementTarget): Element {
  const resolved = typeof target === "function" ? target() : target;
  if (!resolved?.isConnected) {
    throw new Error("Virtual pointer event target is not connected.");
  }
  return resolved;
}

/**
 * Drives one synthetic mouse pointer from SnapEngine's shared frame clock.
 * All motion and waits advance before READ_1, so dispatched input and the
 * engine work it schedules are painted from the same frame coordinates.
 */
export class VirtualPointerController {
  readonly #engine: Engine;
  readonly #cursor: HTMLElement;
  readonly #coordinateRoot: HTMLElement;
  readonly #lifetime = new AbortController();
  #activeOperation: FrameOperation | null = null;
  #position: VirtualPointerPoint | null = null;
  #lastClientPosition: VirtualPointerPoint | null = null;
  #pressedTarget: Element | null = null;
  #buttons = 0;
  #visible = false;

  readonly pointerId: number;

  constructor(
    engine: Engine,
    cursor: HTMLElement,
    options: VirtualPointerControllerOptions,
  ) {
    if (
      options.coordinateRoot === cursor ||
      !options.coordinateRoot.contains(cursor)
    ) {
      throw new Error(
        "Virtual pointer cursor must be a descendant of its coordinate root.",
      );
    }

    this.#engine = engine;
    this.#cursor = cursor;
    this.#coordinateRoot = options.coordinateRoot;
    const pointerId = options.pointerId ?? DEFAULT_VIRTUAL_MOUSE_POINTER_ID;
    if (!Number.isSafeInteger(pointerId) || pointerId <= 0) {
      throw new RangeError(
        "Virtual pointer ID must be a positive safe integer.",
      );
    }
    this.pointerId = pointerId;

    this.#forwardAbort(options.signal);
    this.#forwardAbort(engine.frameController.signal);
    this.#lifetime.signal.addEventListener("abort", this.#handleAbort, {
      once: true,
    });

    if (!this.#lifetime.signal.aborted) {
      engine.frameController.subscribe(this.#advance, {
        signal: this.#lifetime.signal,
      });
    }
  }

  get position(): Readonly<VirtualPointerPoint> | null {
    return this.#position;
  }

  get pressed(): boolean {
    return this.#buttons !== 0;
  }

  show(): void {
    this.#assertActive();
    this.#visible = true;
    this.#syncCursorState();
  }

  hide(): void {
    this.#visible = false;
    this.#syncCursorState();
  }

  wait(duration: number): Promise<void> {
    assertDuration(duration, "Virtual pointer wait duration");
    let startedAt: number | null = null;
    return this.#runOperation("wait", ({ timestamp }) => {
      startedAt ??= timestamp;
      return timestamp - startedAt >= duration;
    });
  }

  waitUntil(
    predicate: () => boolean,
    options: VirtualPointerWaitUntilOptions = {},
  ): Promise<void> {
    const timeout = options.timeout ?? DEFAULT_WAIT_UNTIL_TIMEOUT;
    assertDuration(timeout, "Virtual pointer waitUntil timeout");
    let startedAt: number | null = null;
    return this.#runOperation("waitUntil", ({ timestamp }) => {
      startedAt ??= timestamp;
      if (predicate()) return true;
      if (timestamp - startedAt >= timeout) {
        throw new Error(
          `Virtual pointer waitUntil timed out after ${timeout}ms.`,
        );
      }
      return false;
    });
  }

  moveTo(
    target: VirtualPointerTarget,
    options: VirtualPointerMoveOptions = {},
  ): Promise<void> {
    const duration = options.duration ?? DEFAULT_MOVE_DURATION;
    const arc = options.arc ?? 0;
    const shouldDispatch = options.dispatchEvent ?? true;
    const trackTarget = options.trackTarget ?? false;
    const stopWhen = options.stopWhen;
    assertDuration(duration, "Virtual pointer move duration");
    if (!Number.isFinite(arc)) {
      throw new RangeError("Virtual pointer move arc must be finite.");
    }

    let startedAt: number | null = null;
    let start: VirtualPointerPoint | null = null;
    let sampledDestination: VirtualPointerPoint | null = null;
    return this.#runOperation(
      "moveTo",
      ({ timestamp }, coordinateRootOrigin) => {
        if (trackTarget || !sampledDestination) {
          const destinationTarget = resolveTarget(target);
          sampledDestination = isPoint(destinationTarget)
            ? destinationTarget
            : centerOf(destinationTarget, coordinateRootOrigin);
        }
        const destination = sampledDestination;

        if (!start) {
          start = this.#position ?? destination;
          startedAt = timestamp;
        }

        const elapsed = timestamp - startedAt!;
        const progress = duration === 0 ? 1 : Math.min(1, elapsed / duration);
        const eased = easeInOutCubic(progress);
        const dx = destination.x - start.x;
        const dy = destination.y - start.y;
        const distance = Math.hypot(dx, dy);
        const normalX = distance === 0 ? 0 : -dy / distance;
        const normalY = distance === 0 ? 0 : dx / distance;
        const control = {
          x: start.x + dx / 2 + normalX * arc,
          y: start.y + dy / 2 + normalY * arc,
        };
        const inverse = 1 - eased;
        const next = {
          x:
            inverse * inverse * start.x +
            2 * inverse * eased * control.x +
            eased * eased * destination.x,
          y:
            inverse * inverse * start.y +
            2 * inverse * eased * control.y +
            eased * eased * destination.y,
        };

        this.#setPosition(next, coordinateRootOrigin);
        if (shouldDispatch) {
          this.#dispatchPointerEvent(
            "pointermove",
            this.#eventTarget(),
            -1,
            coordinateRootOrigin,
          );
        }
        return stopWhen?.() === true || progress === 1;
      },
    );
  }

  press(target?: VirtualPointerElementTarget): Promise<void> {
    return this.#runOperation("press", (_frame, coordinateRootOrigin) => {
      if (this.#buttons !== 0) {
        throw new Error("Virtual pointer is already pressed.");
      }
      if (!this.#position) {
        throw new Error("Virtual pointer must be positioned before pressing.");
      }

      this.#pressedTarget = target
        ? resolveElementTarget(target)
        : this.#elementAtPosition(coordinateRootOrigin);
      this.#buttons = 1;
      this.#syncCursorState();
      this.#dispatchPointerEvent(
        "pointerdown",
        this.#pressedTarget,
        0,
        coordinateRootOrigin,
      );
      this.#dispatchMouseButtonEvent(
        "mousedown",
        this.#pressedTarget,
        1,
        coordinateRootOrigin,
      );
      return true;
    });
  }

  release(options: { click?: boolean } = {}): Promise<void> {
    return this.#runOperation("release", (_frame, coordinateRootOrigin) => {
      if (this.#buttons === 0 || !this.#pressedTarget) {
        throw new Error("Virtual pointer is not pressed.");
      }

      const target = this.#pressedTarget;
      this.#buttons = 0;
      this.#syncCursorState();
      this.#dispatchPointerEvent("pointerup", target, 0, coordinateRootOrigin);
      this.#dispatchMouseButtonEvent(
        "mouseup",
        target,
        0,
        coordinateRootOrigin,
      );
      this.#pressedTarget = null;
      if (options.click) this.#dispatchClick(target, coordinateRootOrigin);
      return true;
    });
  }

  async click(
    target: VirtualPointerElementTarget,
    options: VirtualPointerClickOptions = {},
  ): Promise<void> {
    const holdDuration = options.holdDuration ?? DEFAULT_CLICK_HOLD_DURATION;
    assertDuration(holdDuration, "Virtual pointer click hold duration");
    await this.press(target);
    await this.wait(holdDuration);
    await this.release({ click: true });
  }

  /** Moves a pressed pointer beyond SnapEngine's drag-start jitter threshold. */
  activateDrag(): Promise<void> {
    if (this.#buttons === 0) {
      throw new Error(
        "Virtual pointer must be pressed before activating a drag.",
      );
    }
    if (!this.#position) {
      throw new Error(
        "Virtual pointer must be positioned before activating a drag.",
      );
    }
    return this.moveTo(
      {
        x: this.#position.x + DEFAULT_DRAG_ACTIVATION_DISTANCE,
        y: this.#position.y,
      },
      { duration: 0 },
    );
  }

  async drag(
    source: VirtualPointerElementTarget,
    destination: VirtualPointerTarget,
    options: VirtualPointerDragOptions = {},
  ): Promise<void> {
    const pressDuration = options.pressDuration ?? 0;
    assertDuration(pressDuration, "Virtual pointer drag press duration");
    await this.moveTo(source, options.sourceMove);
    await this.press(source);
    if (pressDuration > 0) await this.wait(pressDuration);
    await this.activateDrag();
    await this.moveTo(destination, options.dragMove);
    await this.release();
  }

  destroy(): void {
    if (!this.#lifetime.signal.aborted) {
      this.#lifetime.abort(
        new DOMException("Virtual pointer controller destroyed.", "AbortError"),
      );
    }
  }

  #forwardAbort(signal: AbortSignal): void {
    if (signal.aborted) {
      this.#lifetime.abort(abortReason(signal));
      return;
    }
    signal.addEventListener(
      "abort",
      () => this.#lifetime.abort(abortReason(signal)),
      { once: true, signal: this.#lifetime.signal },
    );
  }

  #assertActive(): void {
    if (this.#lifetime.signal.aborted) {
      throw abortReason(this.#lifetime.signal);
    }
  }

  #runOperation(
    name: string,
    advance: (
      frame: FrameInfo,
      coordinateRootOrigin: VirtualPointerPoint,
    ) => boolean,
  ): Promise<void> {
    this.#assertActive();
    if (this.#activeOperation) {
      throw new Error(
        `Virtual pointer cannot start ${name} while ${this.#activeOperation.name} is active.`,
      );
    }

    return new Promise<void>((resolve, reject) => {
      this.#activeOperation = { name, advance, resolve, reject };
    });
  }

  #advance = (frame: FrameInfo): void => {
    const operation = this.#activeOperation;
    if (!operation) return;

    try {
      const coordinateRootOrigin = this.#readCoordinateRootOrigin();
      const complete = operation.advance(frame, coordinateRootOrigin);
      this.#syncClientPosition(coordinateRootOrigin);
      if (!complete) return;
      if (this.#activeOperation === operation) this.#activeOperation = null;
      window.setTimeout(operation.resolve, 0);
    } catch (error) {
      if (this.#activeOperation === operation) this.#activeOperation = null;
      window.setTimeout(() => operation.reject(error), 0);
    }
  };

  #handleAbort = (): void => {
    if (this.#buttons !== 0) {
      const target = this.#pressedTarget?.isConnected
        ? this.#pressedTarget
        : document;
      this.#buttons = 0;
      this.#dispatchPointerEvent("pointercancel", target, -1);
      this.#pressedTarget = null;
    }

    this.hide();
    const operation = this.#activeOperation;
    this.#activeOperation = null;
    operation?.reject(abortReason(this.#lifetime.signal));
  };

  #setPosition(
    position: VirtualPointerPoint,
    coordinateRootOrigin: VirtualPointerPoint,
  ): void {
    this.#position = position;
    this.#cursor.style.transform = `translate3d(${position.x}px, ${position.y}px, 0)`;
    this.#syncClientPosition(coordinateRootOrigin);
  }

  #syncCursorState(): void {
    const state = !this.#visible
      ? "hidden"
      : this.#buttons !== 0
        ? "pressed"
        : "visible";
    this.#cursor.dataset.virtualPointerState = state;
  }

  #elementAtPosition(coordinateRootOrigin: VirtualPointerPoint): Element {
    const position = this.#clientPosition(coordinateRootOrigin);
    if (!position) {
      throw new Error("Virtual pointer has no position.");
    }
    return (
      document.elementFromPoint(position.x, position.y) ??
      this.#engine.containerElement ??
      document.documentElement
    );
  }

  #eventTarget(): EventTarget {
    return this.#pressedTarget?.isConnected
      ? this.#pressedTarget
      : this.#engine.containerElement ?? document.documentElement;
  }

  #dispatchPointerEvent(
    type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
    target: EventTarget,
    button: number,
    coordinateRootOrigin?: VirtualPointerPoint,
  ): void {
    const position = this.#clientPosition(coordinateRootOrigin);
    if (!position) return;
    const { x, y } = position;
    target.dispatchEvent(
      new PointerEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        pointerId: this.pointerId,
        pointerType: "mouse",
        isPrimary: true,
        width: 1,
        height: 1,
        pressure: this.#buttons === 0 ? 0 : 0.5,
        clientX: x,
        clientY: y,
        screenX: window.screenX + x,
        screenY: window.screenY + y,
        button,
        buttons: this.#buttons,
      }),
    );
  }

  #dispatchClick(
    target: EventTarget,
    coordinateRootOrigin: VirtualPointerPoint,
  ): void {
    const position = this.#clientPosition(coordinateRootOrigin);
    if (!position) return;
    const { x, y } = position;
    target.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        detail: 1,
        clientX: x,
        clientY: y,
        screenX: window.screenX + x,
        screenY: window.screenY + y,
        button: 0,
        buttons: 0,
      }),
    );
  }

  #dispatchMouseButtonEvent(
    type: "mousedown" | "mouseup",
    target: EventTarget,
    buttons: number,
    coordinateRootOrigin: VirtualPointerPoint,
  ): void {
    const position = this.#clientPosition(coordinateRootOrigin);
    if (!position) return;
    const { x, y } = position;
    target.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        cancelable: true,
        composed: true,
        view: window,
        detail: 1,
        clientX: x,
        clientY: y,
        screenX: window.screenX + x,
        screenY: window.screenY + y,
        button: 0,
        buttons,
      }),
    );
  }

  #readCoordinateRootOrigin(): VirtualPointerPoint {
    if (!this.#coordinateRoot.isConnected) {
      throw new Error("Virtual pointer coordinate root is not connected.");
    }

    const rect = this.#coordinateRoot.getBoundingClientRect();
    return {
      x:
        rect.left +
        this.#coordinateRoot.clientLeft -
        this.#coordinateRoot.scrollLeft,
      y:
        rect.top +
        this.#coordinateRoot.clientTop -
        this.#coordinateRoot.scrollTop,
    };
  }

  #clientPosition(
    coordinateRootOrigin?: VirtualPointerPoint,
  ): VirtualPointerPoint | null {
    if (!this.#position) return null;

    const origin =
      coordinateRootOrigin ??
      (this.#coordinateRoot.isConnected
        ? this.#readCoordinateRootOrigin()
        : null);
    if (!origin) return this.#lastClientPosition;

    const position = {
      x: origin.x + this.#position.x,
      y: origin.y + this.#position.y,
    };
    const positionChanged =
      position.x !== this.#lastClientPosition?.x ||
      position.y !== this.#lastClientPosition?.y;
    this.#lastClientPosition = position;
    if (positionChanged) {
      this.#cursor.dataset.virtualPointerX = position.x.toFixed(2);
      this.#cursor.dataset.virtualPointerY = position.y.toFixed(2);
    }
    return position;
  }

  #syncClientPosition(coordinateRootOrigin: VirtualPointerPoint): void {
    this.#clientPosition(coordinateRootOrigin);
  }
}
