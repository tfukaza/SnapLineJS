import { reportConsumerError } from "./errors";

export interface FrameInfo {
  /** The timestamp supplied by the shared requestAnimationFrame callback. */
  readonly timestamp: number;
}

export type FrameCallback = (frame: FrameInfo) => void;

export interface FrameSubscribeOptions {
  /** Removes the subscription synchronously when aborted. */
  readonly signal?: AbortSignal;
}

type FrameSubscription = {
  callback: FrameCallback;
  signal: AbortSignal | null;
  unsubscribe: () => void;
};

function isPromiseLike(value: unknown): value is PromiseLike<unknown> {
  return (
    ((typeof value === "object" && value !== null) ||
      typeof value === "function") &&
    "then" in value &&
    typeof value.then === "function"
  );
}

/**
 * Engine-owned subscription point for work that must run at the beginning of
 * SnapEngine's shared animation frame, before any render-stage queue is read.
 */
export interface FrameController {
  /** Aborts before this Engine tears down its input listeners. */
  readonly signal: AbortSignal;

  /**
   * Adds a synchronous beginning-of-frame callback in subscription order.
   * Returns an idempotent unsubscribe function.
   */
  subscribe(
    callback: FrameCallback,
    options?: FrameSubscribeOptions,
  ): () => void;
}

/** @internal Engine owns this concrete implementation and its lifecycle. */
export class EngineFrameController implements FrameController {
  #controller = new AbortController();
  #subscriptions = new Set<FrameSubscription>();

  get signal(): AbortSignal {
    return this.#controller.signal;
  }

  subscribe(
    callback: FrameCallback,
    { signal = undefined }: FrameSubscribeOptions = {},
  ): () => void {
    if (this.#controller.signal.aborted || signal?.aborted) {
      return () => {};
    }

    let active = true;
    const subscription: FrameSubscription = {
      callback,
      signal: signal ?? null,
      unsubscribe: () => {
        if (!active) return;
        active = false;
        this.#subscriptions.delete(subscription);
        signal?.removeEventListener("abort", subscription.unsubscribe);
      },
    };
    this.#subscriptions.add(subscription);
    signal?.addEventListener("abort", subscription.unsubscribe, { once: true });
    return subscription.unsubscribe;
  }

  processFrame(frame: FrameInfo): void {
    if (this.#controller.signal.aborted) return;

    for (const subscription of [...this.#subscriptions]) {
      if (
        !this.#subscriptions.has(subscription) ||
        subscription.signal?.aborted
      ) {
        continue;
      }
      try {
        const result: unknown = subscription.callback(frame);
        if (isPromiseLike(result)) {
          void Promise.resolve(result).catch(reportConsumerError);
        }
      } catch (error) {
        reportConsumerError(error);
      }
      if (this.#controller.signal.aborted) break;
    }
  }

  destroy(): void {
    if (this.#controller.signal.aborted) return;

    this.#controller.abort();
    for (const subscription of [...this.#subscriptions]) {
      subscription.unsubscribe();
    }
    this.#subscriptions.clear();
  }
}
