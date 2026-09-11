import { freezePoint } from "@snap-engine/core/geometry";
import type {
  dragEndProp,
  dragProp,
  dragStartProp,
} from "@snap-engine/core";
import type { ResolvedDropTarget } from "../algorithm";
import type { DragSessionController } from "./session";

export class PointerDragController {
  readonly inputType = "pointer" as const;
  readonly pointerId: number;
  readonly start: Readonly<{ x: number; y: number }>;
  readonly #session: DragSessionController;

  #pointer: Readonly<{ x: number; y: number }>;
  #preparedTarget: ResolvedDropTarget | null = null;
  #applyingScheduledMove = false;

  constructor(
    session: DragSessionController,
    prop: dragStartProp,
  ) {
    this.#session = session;
    this.pointerId = prop.pointerId;
    this.start = freezePoint(prop.start);
    this.#pointer = this.start;
    Object.freeze(this);
  }

  get pointer(): Readonly<{ x: number; y: number }> {
    return this.#pointer;
  }

  /** @internal True while the scheduled final pointer move owns placement. */
  get applyingScheduledMove(): boolean {
    return this.#applyingScheduledMove;
  }

  ownsPointer(pointerId: number): boolean {
    return pointerId === this.pointerId;
  }

  updatePointer(prop: dragProp): boolean {
    if (!this.ownsPointer(prop.pointerId)) {
      return false;
    }

    this.#pointer = freezePoint(prop.position);
    return true;
  }

  move(prop: dragProp): void {
    if (!this.ownsPointer(prop.pointerId)) return;

    const session = this.#session;
    const item = session.primaryItem;
    const queueId = `drag-${item.id}`;

    item.schedule(
      () => {
        if (!this.#acceptsScheduledMove) return;
        let completed = false;
        try {
          this.updatePointer(prop);
          session.visualPointer = this.pointer;
          if (session.strategy.lifecycle.placementOccupiesFlowSlots) {
            this.#preparedTarget = session.resolvePointerTarget();
            session.prepareTarget(this.#preparedTarget);
          } else {
            session.stageTargetVisual();
          }
          completed = true;
        } finally {
          if (!completed) session.scheduleErrorFinalizer();
        }
      },
      { stage: "READ_1", queueId: `${queueId}-read` },
    );

    item.schedule(
      async () => {
        if (!this.#acceptsScheduledMove) return;
        let completed = false;
        try {
          this.updatePointer(prop);
          session.visualPointer = this.pointer;
          this.#applyingScheduledMove = true;
          try {
            const target = session.strategy.lifecycle
              .placementOccupiesFlowSlots
              ? this.#preparedTarget
              : session.resolvePointerTarget();
            await session.applyTarget(target, true);
            session.strategy.lifecycle.dragMove(session);
          } finally {
            this.#applyingScheduledMove = false;
          }
          completed = true;
        } finally {
          if (!completed) session.scheduleErrorFinalizer();
        }
      },
      { stage: "WRITE_1", queueId },
    );

    session.root.queueReadTree("READ_2", queueId);
  }

  end(prop: dragEndProp): void {
    if (!this.ownsPointer(prop.pointerId)) return;

    const session = this.#session;
    if (prop.cancelled || session.phase === "pending") {
      session.cancel();
      return;
    }
    if (session.phase !== "active") return;

    session.beginDrop();
  }

  get #acceptsScheduledMove(): boolean {
    const session = this.#session;
    return (
      session.phase === "active" ||
      (session.phase === "dropping" && !session.cancelled)
    );
  }
}
