import { AnimationObject } from "@snap-engine/core/animation";
import type { Rect } from "@snap-engine/core/geometry";
import { evaluateDropTargetPriority } from "../algorithm";
import { animationConfigFor } from "../internal/flip-animation";
import { DROP_REJECT_PRIORITY, type DragLocation } from "../events";
import type { ItemId } from "../snapshot";
import {
  createDirectCandidates,
  directCandidateGeometry,
  directCandidateLocations,
  type DirectCandidate,
  type DirectCandidateGeometry,
} from "./direct-candidates";
import type { DragSessionController } from "./session";
import type { Container } from "../container";
import { settleMutation } from "../mutation";
import { getDragSessionController } from "./session-store";

let directDragGeneration = 0;
const directAnimationCancellation = new WeakMap<
  DirectDragController,
  () => void
>();

/** @internal Stop direct-input motion while preserving its last rendered rect. */
export function cancelDirectMoveAnimation(
  controller: DirectDragController,
): void {
  directAnimationCancellation.get(controller)?.();
}

const DIRECT_MOVE_DEFAULT_DURATION = 160;
const DIRECT_MOVE_DEFAULT_EASING = "ease-out";

function freezeRect(rect: Readonly<Rect>): Readonly<Rect> {
  return Object.freeze({
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  });
}

function freezeRects(
  rects: readonly Readonly<Rect>[],
): readonly Readonly<Rect>[] {
  return Object.freeze(rects.map(freezeRect));
}

function interpolateRect(
  from: Readonly<Rect>,
  to: Readonly<Rect>,
  progress: number,
): Rect {
  return {
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    width: from.width + (to.width - from.width) * progress,
    height: from.height + (to.height - from.height) * progress,
  };
}

function boundingRect(
  rects: readonly Readonly<Rect>[],
): Readonly<Rect> {
  const first = rects[0];
  if (!first) {
    throw new Error("DirectDragController: visual geometry cannot be empty.");
  }

  let left = first.x;
  let top = first.y;
  let right = first.x + first.width;
  let bottom = first.y + first.height;

  for (const rect of rects.slice(1)) {
    left = Math.min(left, rect.x);
    top = Math.min(top, rect.y);
    right = Math.max(right, rect.x + rect.width);
    bottom = Math.max(bottom, rect.y + rect.height);
  }

  return freezeRect({
    x: left,
    y: top,
    width: right - left,
    height: bottom - top,
  });
}

export class DirectDragController {
  readonly inputType = "direct" as const;
  readonly initiatingItemId: ItemId;
  readonly #session: DragSessionController;
  readonly #participantIndexById: ReadonlyMap<ItemId, number>;
  readonly #queueIdPrefix = `direct-drag-${++directDragGeneration}`;

  #candidates: readonly DirectCandidate[] = Object.freeze([]);
  #candidateLocations: readonly DragLocation[] = Object.freeze([]);
  #activated = false;
  #moveSettling = false;
  #dropRequested = false;
  #restoreFocus = true;
  #visualRects: readonly Readonly<Rect>[] = Object.freeze([]);
  #moveAnimation: AnimationObject | null = null;

  #currentCandidateIndex: number | null = null;
  #homeCandidateIndex: number | null = null;

  constructor(session: DragSessionController, initiatingItemId: ItemId) {
    this.#session = session;
    this.initiatingItemId = initiatingItemId;
    this.#participantIndexById = new Map(
      session.items.map((item, index) => [item.itemId, index]),
    );
    directAnimationCancellation.set(this, () => this.#cancelMoveAnimation());
    Object.freeze(this);
  }

  /** @internal Capture this session's direct candidates after drag geometry exists. */
  activate(): void {
    if (this.#activated) {
      throw new Error("DirectDragController: input is already active.");
    }

    const candidates = createDirectCandidates(
      this.#session,
      this.initiatingItemId,
    );
    this.#candidates = candidates;
    this.#candidateLocations = directCandidateLocations(candidates);
    const homeCandidateIndex = this.#resolveSourceCandidateIndex();

    this.#homeCandidateIndex = homeCandidateIndex;
    this.#currentCandidateIndex = homeCandidateIndex;
    this.#visualRects = freezeRects(
      this.#session.items.map((item) => {
        const start = this.#session.dragVisualStart.get(item);
        if (!start) {
          throw new Error(
            "DirectDragController: participant visual geometry is missing.",
          );
        }
        const box = this.#session.dragBoxFor(item);
        return {
          x: start.x,
          y: start.y,
          width: box.width,
          height: box.height,
        };
      }),
    );
    this.#activated = true;
  }

  /** @internal Restore focus after terminal callbacks and framework reconciliation. */
  scheduleFocusRestoration(): void {
    if (!this.#restoreFocus) return;

    const root = this.#session.root;
    const initiatingItemId = this.initiatingItemId;

    root.schedule(
      async () => {
        await settleMutation();

        if (root.isDeleteRequested || getDragSessionController(root)) return;
        const item = root.findItemById(initiatingItemId);
        const inputElement = item?.inputElement;

        if (!item || item.isDeleteRequested || !inputElement?.isConnected) {
          return;
        }

        inputElement.focus({ preventScroll: true });
      },
      {
        stage: "WRITE_3",
        queueId: `${this.#queueIdPrefix}-focus`,
      },
    );
  }

  /** @internal Let native focus navigation proceed after cancelling this drag. */
  suppressFocusRestoration(): void {
    this.#restoreFocus = false;
  }

  /** @internal Exact candidates used for placement and visuals. */
  get directCandidates(): readonly DirectCandidate[] {
    return this.#candidates;
  }

  /** Public logical destinations available to direct input. */
  get candidates(): readonly DragLocation[] {
    return this.#candidateLocations;
  }

  get currentCandidate(): DirectCandidate | null {
    if (this.#currentCandidateIndex === null) {
      return null;
    }

    return this.#candidates[this.#currentCandidateIndex] ?? null;
  }

  get currentTarget(): DragLocation | null {
    if (this.#currentCandidateIndex === null) {
      return null;
    }

    return this.#candidateLocations[this.#currentCandidateIndex] ?? null;
  }

  /** @internal Current animated world-space border box for one participant. */
  visualRectFor(itemId: ItemId): Readonly<Rect> | null {
    const index = this.#participantIndexById.get(itemId);
    return index === undefined ? null : this.#visualRects[index] ?? null;
  }

  /** @internal Current animated bounding box for the complete drag visual. */
  get visualGroupRect(): Readonly<Rect> | null {
    return this.#visualRects.length > 0
      ? boundingRect(this.#visualRects)
      : null;
  }

  get #canMove(): boolean {
    return (
      this.#activated && !this.#moveSettling && this.#session.phase === "active"
    );
  }

  #writeVisualGeometry(
    rects: readonly Readonly<Rect>[],
    pointer: Readonly<{ x: number; y: number }>,
  ): void {
    if (rects.length !== this.#session.items.length) {
      throw new Error(
        "DirectDragController: visual geometry must parallel the dragged participants.",
      );
    }

    this.#visualRects = freezeRects(rects);
    this.#session.visualPointer = pointer;
    this.#session.strategy.lifecycle.dragMove(this.#session);
  }

  #completeMove(): void {
    this.#moveAnimation = null;
    this.#moveSettling = false;

    if (this.#dropRequested && this.#session.phase === "active") {
      this.#session.beginDrop();
    }
  }

  #cancelMoveAnimation(): void {
    const animation = this.#moveAnimation;
    this.#moveAnimation = null;
    animation?.cancel();
    this.#moveSettling = false;
  }

  #startMoveAnimation(
    candidate: DirectCandidate,
    geometry: DirectCandidateGeometry,
  ): void {
    const session = this.#session;
    const targetRects = freezeRects(geometry.memberRects);
    const targetPointer = geometry.pointer;
    const config = animationConfigFor(candidate.target.container, "reorder");
    const duration = config?.duration ?? DIRECT_MOVE_DEFAULT_DURATION;

    if (!config || duration <= 0 || session.dragVisual === "none") {
      this.#writeVisualGeometry(targetRects, targetPointer);
      this.#completeMove();
      return;
    }

    const sourceRects = this.#visualRects;
    const sourcePointer = session.visualPointer;
    let animation: AnimationObject;

    const fail = () => {
      if (this.#moveAnimation !== animation) return;
      this.#cancelMoveAnimation();
      session.scheduleErrorFinalizer();
    };

    animation = new AnimationObject(
      null,
      { $progress: [0, 1] },
      {
        duration,
        easing: config.timing_function ?? DIRECT_MOVE_DEFAULT_EASING,
        tick: ({ $progress }) => {
          if (this.#moveAnimation !== animation || session.phase !== "active") {
            return;
          }

          try {
            this.#writeVisualGeometry(
              sourceRects.map((source, index) => {
                const target = targetRects[index];
                if (!target) {
                  throw new Error(
                    "DirectDragController: target visual geometry is missing.",
                  );
                }
                return interpolateRect(source, target, $progress);
              }),
              {
                x:
                  sourcePointer.x +
                  (targetPointer.x - sourcePointer.x) * $progress,
                y:
                  sourcePointer.y +
                  (targetPointer.y - sourcePointer.y) * $progress,
              },
            );
          } catch {
            fail();
          }
        },
        finish: () => {
          if (this.#moveAnimation !== animation) return;

          try {
            this.#writeVisualGeometry(targetRects, targetPointer);
          } catch {
            fail();
            return;
          }

          this.#completeMove();
        },
      },
    );

    this.#moveAnimation = animation;
    session.root.addAnimation(animation, { replaceExisting: false });
    animation.play();
  }

  #scheduleMove(
    candidateIndex: number,
    candidate: DirectCandidate,
    geometry: DirectCandidateGeometry,
  ): void {
    const session = this.#session;
    const item = session.primaryItem;
    const queueId = `${this.#queueIdPrefix}-move-${item.id}`;

    const placementTarget =
      candidate.kind === "swap" && candidateIndex === this.#homeCandidateIndex
        ? null
        : candidate.target;

    this.#moveSettling = true;

    item.schedule(
      () => {
        if (session.phase !== "active") {
          return;
        }

        let completed = false;

        try {
          session.prepareTarget(placementTarget);
          completed = true;
        } finally {
          if (!completed) {
            this.#moveSettling = false;
            session.scheduleErrorFinalizer();
          }
        }
      },
      {
        stage: "READ_1",
        queueId: `${queueId}-read`,
      },
    );

    item.schedule(
      async () => {
        if (session.phase !== "active") {
          this.#moveSettling = false;
          return;
        }

        let completed = false;

        try {
          await session.applyTarget(placementTarget, false);
          if (session.phase !== "active") {
            this.#moveSettling = false;
            completed = true;
            return;
          }
          this.#startMoveAnimation(candidate, geometry);
          completed = true;
        } finally {
          if (!completed) {
            this.#cancelMoveAnimation();
            session.scheduleErrorFinalizer();
          }
        }
      },
      {
        stage: "WRITE_1",
        queueId,
      },
    );

    session.root.queueReadTree("READ_2", queueId);
  }

  #acceptCandidate(
    candidateIndex: number,
    candidate: DirectCandidate,
    geometry: DirectCandidateGeometry,
  ): boolean {
    this.#currentCandidateIndex = candidateIndex;
    this.#scheduleMove(candidateIndex, candidate, geometry);
    return true;
  }

  moveTo(container: Container, index: number): boolean {
    if (!this.#canMove) {
      return false;
    }

    const candidateIndex = this.#candidateIndexFor(container, index);

    if (candidateIndex === this.#currentCandidateIndex) {
      return false;
    }

    const candidate = this.#candidates[candidateIndex];

    if (!candidate) {
      throw new Error("DirectDragController: resolved candidate is missing.");
    }

    const geometry = directCandidateGeometry(this.#session, candidate);

    const priority = evaluateDropTargetPriority(
      this.#session.primaryItem,
      this.#session,
      candidate.target,
      geometry,
    );

    if (priority === DROP_REJECT_PRIORITY) {
      return false;
    }

    return this.#acceptCandidate(candidateIndex, candidate, geometry);
  }

  moveNext(): boolean {
    return this.#moveBy(1);
  }

  movePrevious(): boolean {
    return this.#moveBy(-1);
  }

  drop(): boolean {
    if (
      !this.#activated ||
      this.#dropRequested ||
      this.#session.phase !== "active"
    ) {
      return false;
    }

    this.#dropRequested = true;

    if (!this.#moveSettling) {
      this.#session.beginDrop();
    }

    return true;
  }

  cancel(): boolean {
    if (!this.#activated || this.#session.phase !== "active") {
      return false;
    }

    this.#dropRequested = false;
    this.#cancelMoveAnimation();
    this.#session.cancel();
    return true;
  }

  #moveBy(direction: 1 | -1): boolean {
    if (!this.#canMove || this.#currentCandidateIndex === null) {
      return false;
    }

    const rejectedContainers = new Set<Container>();

    for (
      let candidateIndex = this.#currentCandidateIndex + direction;
      candidateIndex >= 0 && candidateIndex < this.#candidates.length;
      candidateIndex += direction
    ) {
      const candidate = this.#candidates[candidateIndex];

      if (!candidate) {
        continue;
      }

      const container = candidate.target.container;

      if (rejectedContainers.has(container)) {
        continue;
      }

      const geometry = directCandidateGeometry(this.#session, candidate);

      const priority = evaluateDropTargetPriority(
        this.#session.primaryItem,
        this.#session,
        candidate.target,
        geometry,
      );

      if (priority === DROP_REJECT_PRIORITY) {
        rejectedContainers.add(container);
        continue;
      }

      return this.#acceptCandidate(candidateIndex, candidate, geometry);
    }

    return false;
  }

  #candidateIndexFor(container: Container, index: number): number {
    if (!Number.isInteger(index) || index < 0) {
      throw new RangeError(
        "DirectDragController: candidate index must be a nonnegative integer.",
      );
    }

    if (
      container.isDeleteRequested ||
      container.rootContainer !== this.#session.root
    ) {
      throw new Error(
        "DirectDragController: candidate container must be live and belong to the session root.",
      );
    }

    const candidateIndex = this.#candidateLocations.findIndex(
      (location) =>
        location.container === container && location.index === index,
    );

    if (candidateIndex === -1) {
      throw new RangeError(
        "DirectDragController: the requested location is not a direct-drag candidate.",
      );
    }

    return candidateIndex;
  }

  #resolveSourceCandidateIndex(): number {
    let participantIndex = this.#session.items.findIndex(
      (item) => item.itemId === this.initiatingItemId,
    );

    // A selected ancestor may be the actual dragged participant.
    if (participantIndex === -1) {
      participantIndex = this.#session.items.indexOf(this.#session.pressedItem);
    }

    if (participantIndex === -1) {
      throw new Error(
        "DirectDragController: initiating participant is missing from the session.",
      );
    }

    const source = this.#session.sources[participantIndex];

    const removedBefore = this.#session.sources.reduce(
      (count, candidateSource, sourceIndex) =>
        sourceIndex !== participantIndex &&
        candidateSource.container === source.container &&
        candidateSource.index < source.index
          ? count + 1
          : count,
      0,
    );

    const homeIndex =
      this.#session.strategy.mode === "swap"
        ? source.index
        : source.index - removedBefore;

    return this.#candidateIndexFor(source.container, homeIndex);
  }
}
