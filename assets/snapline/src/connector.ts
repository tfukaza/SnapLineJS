import {
  ElementObject,
  BaseObject,
  pointerPositionFromWorld,
  worldRectFromScreenRect,
  type DomElement,
  type WorldToScreenMapper,
} from "@snap-engine/core";
import type {
  dragEndProp,
  dragProp,
  dragStartProp,
  PointerPosition,
  pointerDownProp,
  pointerUpProp,
} from "@snap-engine/core";
import { CircleCollider } from "@snap-engine/core/collision";
import {
  rectCenter,
  type Bounds,
  type Point,
} from "@snap-engine/core/geometry";
import type { NodeMirror } from "./node";
import { LineMirror, cloneAnchor, type LineMirrorPhase } from "./line";
import { getGraphRegistry } from "./internal/shared-data";
import { mintDomainId } from "./internal/graph-registry";
import type { LineChangeRequest } from "./types";

export type SnapLineMetadata = Record<string, unknown>;
export type ConnectionOrigin = "gesture" | "hydration";
export type DisconnectReason =
  | "gesture"
  | "replacement"
  | "programmatic"
  | "teardown";
export type ConnectorRole = "source" | "target";

/**
 * How a line drag ended. "empty-space" and "refused" were previously
 * indistinguishable — both simply reported `connected: false` — but only the
 * first means the user gestured toward a node that does not exist yet.
 */
export type DragEndOutcome =
  /** Settled onto an admitting target. */
  | "connected"
  /** Dropped over a target that declined (capacity, predicate, or roles). */
  | "refused"
  /** Dropped where no connector was resolved at all. */
  | "empty-space"
  /** The gesture was cancelled (pointer cancel, teardown). */
  | "cancelled";

/** A world-space connection point, with an optional outward normal. */
export interface ConnectorAnchor extends Point {
  normal?: Point;
}

/** Cached world-space bounds derived from the parent node's collision box. */
export interface ConnectorGeometrySnapshot extends Bounds {
  connector: ConnectorMirror;
  node: NodeMirror;
  center: ConnectorAnchor;
}

export interface ConnectorHit {
  anchor: ConnectorAnchor;
  distance: number;
  priority?: number;
  payload?: unknown;
}

export interface ConnectorCandidate {
  connector: ConnectorMirror;
  hit: ConnectorHit;
}

export interface ConnectorSurfaceHitTestEvent {
  connector: ConnectorMirror;
  position: PointerPosition;
  geometry: ConnectorGeometrySnapshot;
  phase: LineMirrorPhase;
}

export interface ConnectorAnchorEvent {
  connector: ConnectorMirror;
  peer: ConnectorMirror | null;
  line: LineMirror;
  role: ConnectorRole;
  phase: LineMirrorPhase;
  position: Point;
  geometry: ConnectorGeometrySnapshot;
  peerGeometry: ConnectorGeometrySnapshot | null;
  hit: ConnectorHit | null;
}

export interface ConnectorSurfaceStrategy {
  targetHitTest?: (
    event: ConnectorSurfaceHitTestEvent,
  ) => ConnectorHit | null | false | void;
  resolveAnchor?: (
    event: ConnectorAnchorEvent,
  ) => ConnectorAnchor | null | void;
}

/** `"unlimited"` is the explicit no-limit value (normalized to Infinity
 * internally so capacity checks stay branch-free). */
export type ConnectionLimit = number | "unlimited";

export interface ConnectorRules {
  /** Maximum outgoing lines (previews reserve a slot). 0 makes the connector
   * target-only. Default `"unlimited"`. */
  maxOutgoing: ConnectionLimit;
  /** Maximum settled incoming lines. 0 makes the connector source-only.
   * Default 1. */
  maxIncoming: ConnectionLimit;
  reconnect: boolean;
  /** Both endpoints must allow parallel lines between the same pair. */
  allowParallel: boolean;
  /** Policy when a proposal would exceed `maxIncoming`: reject it (default)
   * or evict the oldest incoming lines to make room. */
  onFull: "reject" | "replace-oldest";
  /** Line-aware admission predicate — synchronous and side-effect free
   * (candidate discovery calls it repeatedly; rechecked on the final drop).
   * Either endpoint's predicate may veto. */
  isValidConnection?: (proposal: ConnectionProposal) => boolean;
}

/** Rules with limits normalized to numbers (Infinity = unlimited). */
export interface ResolvedConnectorRules {
  maxOutgoing: number;
  maxIncoming: number;
  reconnect: boolean;
  allowParallel: boolean;
  onFull: "reject" | "replace-oldest";
  isValidConnection: ((proposal: ConnectionProposal) => boolean) | null;
}

export interface ConnectionProposal {
  line: LineMirror;
  source: ConnectorMirror;
  target: ConnectorMirror;
  phase: "candidate" | "drop";
}

export interface ConnectorPairEvent {
  source: ConnectorMirror;
  target: ConnectorMirror;
}

export interface ConnectorCandidateEvent {
  source: ConnectorMirror;
  /** Legacy convenience reference. */
  candidate: ConnectorMirror | null;
  resolvedCandidate: ConnectorCandidate | null;
  line: LineMirror | null;
}

export interface ConnectorConnectionEvent extends ConnectorPairEvent {
  connector: ConnectorMirror;
  peer: ConnectorMirror;
  line: LineMirror;
  role: ConnectorRole;
  origin: ConnectionOrigin;
}

export interface ConnectorDisconnectionEvent
  extends Omit<ConnectorConnectionEvent, "origin"> {
  reason: DisconnectReason;
}

export interface ConnectorDragEvent {
  connector: ConnectorMirror;
  position: PointerPosition;
  pointerId: number;
}

export interface ConnectorPointerEvent extends ConnectorDragEvent {
  originalEvent: PointerEvent;
}

export interface ConnectorCallbacks {
  /** Overrides the parent node's `resolveNewLine` for this connector only. */
  resolveNewLine?: NewLineResolver;
  /** Fires when this connector claims a primary pointer, before drag threshold. */
  onPointerDown?: (event: ConnectorPointerEvent) => void;
  onDragStart?: (event: ConnectorDragEvent) => void;
  onCandidateChange?: (event: ConnectorCandidateEvent) => void;
  onConnect?: (event: ConnectorConnectionEvent) => void;
  onDisconnect?: (event: ConnectorDisconnectionEvent) => void;
  onDragEnd?: (
    event: ConnectorDragEvent & {
      connected: boolean;
      /** Why the drag ended — distinguishes an empty-space drop from a
       * refusal, which `connected` alone cannot. */
      outcome: DragEndOutcome;
    },
  ) => void;
}

enum ConnectorState {
  IDLE,
  ARMED,
  DRAGGING,
}

export interface ConnectorConfig {
  /**
   * Stable application-facing identity (graph-global, one namespace across
   * the whole graph). Minted by SnapLine when omitted; supply one for any
   * graph that outlives this mirror (persistence, remounts, reloads).
   */
  id?: string;
  name?: string;
  rules?: Partial<ConnectorRules>;
  surfaceStrategies?: readonly ConnectorSurfaceStrategy[];
  colliderRadius?: number;
  metadata?: SnapLineMetadata;
  callbacks?: ConnectorCallbacks;
  /** Allows this connector gesture to use the engine's configured edge pan. */
  edgePan?: boolean;
}

/** Context for seeding a brand-new line at drag start. */
export interface NewLineEvent {
  connector: ConnectorMirror;
  node: NodeMirror;
}

/**
 * Seeds application data onto a line the moment a drag creates it.
 *
 * Runs **once per gesture, only for genuinely new lines** — never for a
 * reconnect, whose payload the application already owns. Must be synchronous.
 * Whatever it returns becomes `LineMirror.payload`, so a renderer can style
 * the preview, and it rides into `request.add` at drop, so the settled record
 * carries the same data without the reducer deriving it again.
 *
 * Keep the value **serializable**: it round-trips through your document.
 * Store a discriminator like `{ kind: "data" }` and map that to a component
 * in `resolveLineComponent`, never a component reference itself.
 */
export type NewLineResolver = (event: NewLineEvent) => unknown;

export type ConnectorConfigUpdate = Partial<Omit<ConnectorConfig, "name">>;

export interface ConnectorResolvedHit {
  candidate: ConnectorCandidate;
  strategy: ConnectorSurfaceStrategy | null;
  strategyIndex: number;
}

interface ArmedConnection {
  pointerId: number;
  sourceHit: ConnectorHit | null;
  sourceStrategy: ConnectorSurfaceStrategy | null;
  reconnectLine: LineMirror | null;
}

class ConnectorMirror extends ElementObject<DomElement> {
  /** Stable domain identity — supplied via `ConnectorConfig.id` or minted.
   * Never the engine-internal `BaseObject.id`. */
  readonly connectorId: string;
  #config: ConnectorConfig;
  #rules: Readonly<ResolvedConnectorRules>;
  #name: string;
  #outgoingLines: LineMirror[];
  #incomingLines: LineMirror[];
  #state: ConnectorState = ConnectorState.IDLE;

  #hitCircle: CircleCollider;
  #candidate: ConnectorResolvedHit | null = null;
  #dragLine: LineMirror | null = null;
  #edgePanPointerId: number | null = null;
  #localCenter: Point;
  #hasMeasuredCenter = false;
  #armed: ArmedConnection | null = null;
  #gestureOrigin: "new" | "reconnect" | null = null;
  #cancelledPointers = new Set<number>();
  #dragDelegate: ConnectorMirror | null = null;
  #callbacks: ConnectorCallbacks;

  get parent(): NodeMirror {
    return super.parent as NodeMirror;
  }

  set parent(parent: BaseObject | null) {
    super.parent = parent;
  }

  constructor(engine: any, parent: NodeMirror, config: ConnectorConfig = {}) {
    super(engine, parent as unknown as BaseObject);

    this.#outgoingLines = [];
    this.#incomingLines = [];
    this.#config = { ...config };
    this.#rules = Object.freeze(resolveRules(this.#config));
    this.#name = config.name || this.id || "";
    this.connectorId = config.id ?? mintDomainId("connector", this.global);
    this.#callbacks = config.callbacks ?? {};
    this.#localCenter = { x: 0, y: 0 };
    this.transformMode = "none";
    this.event.input.pointerDown = this.onCursorDown;
    this.event.input.pointerUp = this.#onPointerUp;
    this.event.input.dragStart = this.#onDragStart;
    this.event.input.drag = this.runDragOutLine;
    this.event.input.dragEnd = this.endDragOutLine;
    this.globalInput.pointerUp = this.#onPointerUp;

    this.#hitCircle = new CircleCollider(
      engine,
      this,
      0,
      0,
      this.#config.colliderRadius ?? 30,
    );
    this.addCollider(this.#hitCircle);
    getGraphRegistry(this.engine).registerConnector(this);

    this.event.dom.onAssignDom = () => {
      this.schedule(
        () => {
          this.measureLocalCenter("READ_1");
        },
        { stage: "READ_1" },
      );
      this.scheduleAllLineWrites();
    };
  }

  get name(): string {
    return this.#name;
  }

  get config(): ConnectorConfig {
    return this.#config;
  }

  get rules(): Readonly<ResolvedConnectorRules> {
    return this.#rules;
  }

  /** Derived role: this connector may originate lines. */
  get isSource(): boolean {
    return this.#rules.maxOutgoing !== 0;
  }

  /** Derived role: this connector may receive lines. */
  get isTarget(): boolean {
    return this.#rules.maxIncoming !== 0;
  }

  get surfaceStrategies(): readonly ConnectorSurfaceStrategy[] {
    return this.#config.surfaceStrategies ?? [];
  }

  get metadata(): SnapLineMetadata {
    return this.#config.metadata ?? {};
  }

  get callbacks(): ConnectorCallbacks {
    return this.#callbacks;
  }

  // Snapshots, never the internal arrays — topology mutation goes through
  // the reconciler-only lifecycle operations, never these accessors.
  get outgoingLines(): readonly LineMirror[] {
    return [...this.#outgoingLines];
  }

  get incomingLines(): readonly LineMirror[] {
    return [...this.#incomingLines];
  }

  /**
   * Updates runtime connector policy without replacing the connector or its
   * existing topology. `name` remains construction-only because it keys the
   * connector in its parent node.
   */
  updateConfig(config: ConnectorConfigUpdate): void {
    this.#config = { ...this.#config, ...config };
    this.#callbacks = this.#config.callbacks ?? {};
    this.#rules = Object.freeze(resolveRules(this.#config));
    this.#hitCircle.radius = this.#config.colliderRadius ?? 30;
    this.scheduleAllLineWrites();
  }

  /**
   * Attaches or detaches the developer-rendered HTML or SVG input root without
   * destroying the logical connector.
   */
  bindElement(element: DomElement | null): void {
    if (this.element === element) return;
    if (this.element) {
      this.destroyDom(false);
      this.#hasMeasuredCenter = false;
    }
    if (element) {
      this.element = element;
    } else {
      this.#hasMeasuredCenter = false;
      this.scheduleAllLineWrites();
    }
  }

  get geometry(): ConnectorGeometrySnapshot {
    const bounds = this.parent.hitBox.getWorldBoundsSnapshot();
    return {
      connector: this,
      node: this.parent,
      x: bounds.x,
      y: bounds.y,
      width: bounds.width,
      height: bounds.height,
      left: bounds.left,
      right: bounds.right,
      top: bounds.top,
      bottom: bounds.bottom,
      center: { x: bounds.center.x, y: bounds.center.y },
    };
  }

  get center(): ConnectorAnchor {
    if (this.#hasMeasuredCenter && this.parent) {
      const parentTransform = this.parent.worldTransform;
      return {
        x: parentTransform.x + this.#localCenter.x * parentTransform.scaleX,
        y: parentTransform.y + this.#localCenter.y * parentTransform.scaleY,
      };
    }
    if (this.element) return this.measureDomCenter();
    return this.geometry.center;
  }

  measureDomCenter(): ConnectorAnchor {
    if (!this.element) return this.geometry.center;

    const rect = this.element.getBoundingClientRect();
    return rectCenter(
      worldRectFromScreenRect(this.engine?.camera ?? null, rect),
    );
  }

  measureLocalCenter(
    stage: "READ_1" | "READ_2" | "READ_3" | null = null,
  ): void {
    if (!this.element || !this.parent) return;

    const prop = this.readDom({ unapplyTransform: false }, stage);
    const parentTransform = this.parent.worldTransform;
    const scaleX = parentTransform.scaleX === 0 ? 1 : parentTransform.scaleX;
    const scaleY = parentTransform.scaleY === 0 ? 1 : parentTransform.scaleY;
    const localLeft = (prop.x - parentTransform.x) / scaleX;
    const localTop = (prop.y - parentTransform.y) / scaleY;
    const center = rectCenter(prop);
    const localCenterX = (center.x - parentTransform.x) / scaleX;
    const localCenterY = (center.y - parentTransform.y) / scaleY;

    this.localTransform = { x: localLeft, y: localTop };
    this.#localCenter = { x: localCenterX, y: localCenterY };
    this.#hasMeasuredCenter = true;
    this.#hitCircle.localTransform = {
      x: localCenterX - localLeft,
      y: localCenterY - localTop,
    };
  }

  onCursorDown(prop: pointerDownProp): void {
    if (prop.event.button !== 0) return;
    this.armSurfaceGesture(prop, null);
  }

  armSurfaceGesture(
    prop: pointerDownProp,
    sourceHit: ConnectorResolvedHit | null,
  ): void {
    if (prop.event.button !== 0) return;
    const currentIncomingLines = this.#liveIncomingLines();
    if (this.#rules.reconnect && currentIncomingLines.length > 0) {
      const line = currentIncomingLines[0];
      const source = line.start;
      this.#dragDelegate = source;
      source.#arm(prop, {
        sourceHit: null,
        sourceStrategy: null,
        reconnectLine: line,
      });
      return;
    }

    if (!this.isSource) return;
    // A new preview reserves an outgoing slot; a full source cannot start one.
    if (this.#liveOutgoingLines().length >= this.#rules.maxOutgoing) return;
    this.#arm(prop, {
      sourceHit: sourceHit?.candidate.hit ?? null,
      sourceStrategy: sourceHit?.strategy ?? this.#defaultAnchorStrategy(),
      reconnectLine: null,
    });
  }

  #arm(
    prop: pointerDownProp,
    options: Omit<ArmedConnection, "pointerId">,
  ): void {
    if (this.#state !== ConnectorState.IDLE) return;
    this.#state = ConnectorState.ARMED;
    this.#armed = {
      pointerId: prop.event.pointerId,
      ...options,
    };
    this.#cancelledPointers.delete(prop.event.pointerId);
    this.engine.input.claimPointer(prop.event.pointerId);
    this.#callbacks.onPointerDown?.({
      connector: this,
      position: prop.position,
      pointerId: prop.event.pointerId,
      originalEvent: prop.event,
    });
  }

  #onPointerUp(prop: pointerUpProp): void {
    const pointerId = prop.event.pointerId;
    const delegate = this.#dragDelegate;
    this.#dragDelegate = null;
    if (
      delegate &&
      delegate.#armed?.pointerId === pointerId &&
      delegate.#state === ConnectorState.ARMED
    ) {
      delegate.#resetGesture();
    }
    if (this.#armed?.pointerId !== pointerId) return;
    if (prop.cancelled) {
      this.#cancelledPointers.add(pointerId);
    }
    if (this.#state === ConnectorState.ARMED) {
      this.#resetGesture();
    }
  }

  #onDragStart(prop: dragStartProp): void {
    const delegate = this.#dragDelegate;
    if (delegate && delegate.#armed?.pointerId === prop.pointerId) {
      this.#dragDelegate = null;
      prop.handoffTo(delegate);
      delegate.#onDragStart(prop);
      return;
    }
    if (
      this.#state !== ConnectorState.ARMED ||
      this.#armed?.pointerId !== prop.pointerId
    ) {
      return;
    }

    const armed = this.#armed;
    let line = armed.reconnectLine;
    this.#gestureOrigin = line ? "reconnect" : "new";
    if (line) {
      this.#detachLineForReconnect(line);
      line.clearTarget();
    } else {
      line = this.#createLine();
      line.setSourceSurfaceContext(armed.sourceStrategy, armed.sourceHit);
      // Seed app data onto a genuinely new line. This branch structurally
      // cannot run for a reconnect, so it can never clobber payload the
      // application already owns. The payload rides into request.add at drop,
      // so preview and settled line agree without deriving it twice.
      const seed = this.#resolveNewLine();
      if (seed) line.setPayload(seed({ connector: this, node: this.parent }));
      this.#outgoingLines.unshift(line);
    }

    this.#dragLine = line;
    this.#state = ConnectorState.DRAGGING;
    this.#setCandidate(null);
    line.setPhase("source-start");
    line.setPreviewPosition(prop.start);
    this.parent.updateNodeLineList();
    this.parent.scheduleLineWrites();
    this.#callbacks.onDragStart?.({
      connector: this,
      position: prop.start,
      pointerId: prop.pointerId,
    });
    line.setPhase("preview-free");
  }

  /** @internal Reconciler/teardown-only: topology is always controlled —
   * applications remove lines by removing their canonical records. */
  deleteLine(
    line: LineMirror,
    reason: DisconnectReason = "programmatic",
  ): LineMirror | null {
    const index = this.#outgoingLines.indexOf(line);
    if (index === -1) return null;

    const target = line.target;
    if (target) {
      target.#incomingLines = target.#incomingLines.filter(
        (incomingLine) => incomingLine !== line,
      );
      this.#emitDisconnect(target, line, reason);
    }
    line.destroy(false);
    this.#outgoingLines.splice(index, 1);
    this.parent?.updateNodeLineList();
    return line;
  }

  /** @internal Teardown-only. */
  deleteAllLines(reason: DisconnectReason = "programmatic"): void {
    for (const line of [...this.#outgoingLines]) {
      this.deleteLine(line, reason);
    }
    for (const line of [...this.#incomingLines]) {
      line.start.deleteLine(line, reason);
    }
    this.#incomingLines = [];
  }

  scheduleAllLineWrites(): void {
    for (const line of [...this.#outgoingLines, ...this.#incomingLines]) {
      line.invalidateGeometry();
    }
  }

  assignToNode(parent: NodeMirror): void {
    this.parent = parent;
    const parentRef = this.parent;
    parentRef.attachConnector(this);
    this.#outgoingLines = [];
    this.#incomingLines = [];
    if (parentRef.global && this.global == null) {
      this.global = parentRef.global;
    }
  }

  /** Gesture/reconciler-only: lines exist because canonical
   * records (or in-flight gestures) say so. */
  #createLine(config: { id?: string } = {}): LineMirror {
    const line = new LineMirror(this.engine, this, config);
    line.setSourceSurfaceContext(this.#defaultAnchorStrategy(), null);
    return line;
  }

  findCandidateAtPoint(
    position: Point,
    phase: "preview-target" | "drop" = "preview-target",
  ): ConnectorCandidate | null {
    return (
      this.#resolveTargetAtPoint(
        asPointerPosition(this.engine?.camera ?? null, position),
        phase,
      )?.candidate ?? null
    );
  }

  /**
   * Imperative admission query. Structural rules always apply; the
   * line-aware isValidConnection predicates run only when a line is given.
   */
  canConnect(target: ConnectorMirror, line: LineMirror | null = null): boolean {
    return this.#admitsConnection(target, line, "drop");
  }

  #admitsConnection(
    target: ConnectorMirror,
    line: LineMirror | null,
    phase: "candidate" | "drop",
  ): boolean {
    // Gestures admit an over-capacity target when its policy replaces
    // (the evictions ride the atomic proposal); records never do.
    if (this.#admitsEndpoints(target, line, true) !== true) return false;
    return line ? this.#predicatesAdmit(target, line, phase) : true;
  }

  /**
   * The one structural admission check: roles, capacity (the in-flight
   * line never counts against itself), and the parallel rule.
   */
  #admitsEndpoints(
    target: ConnectorMirror,
    line: LineMirror | null,
    allowReplacement: boolean,
  ): true | "capacity-exceeded" | "connection-rejected" {
    if (target.id === this.id || !this.isSource || !target.isTarget) {
      return "connection-rejected";
    }
    const incoming = target
      .#liveIncomingLines()
      .filter((incomingLine) => incomingLine !== line);
    const outgoing = this.#liveOutgoingLines().filter(
      (outgoingLine) => outgoingLine !== line,
    );
    if (
      (incoming.length >= target.#rules.maxIncoming &&
        !(allowReplacement && target.#rules.onFull === "replace-oldest")) ||
      outgoing.length >= this.#rules.maxOutgoing
    ) {
      return "capacity-exceeded";
    }
    const hasParallel = incoming.some(
      (incomingLine) => incomingLine.start === this,
    );
    if (
      hasParallel &&
      !(this.#rules.allowParallel && target.#rules.allowParallel)
    ) {
      return "connection-rejected";
    }
    return true;
  }

  /** Both endpoints' line-aware predicates may veto. */
  #predicatesAdmit(
    target: ConnectorMirror,
    line: LineMirror,
    phase: "candidate" | "drop",
  ): boolean {
    const proposal: ConnectionProposal = { line, source: this, target, phase };
    return (
      this.#rules.isValidConnection?.(proposal) !== false &&
      target.#rules.isValidConnection?.(proposal) !== false
    );
  }

  runDragOutLine(prop: dragProp): void {
    if (
      this.#state !== ConnectorState.DRAGGING ||
      this.#armed?.pointerId !== prop.pointerId
    ) {
      return;
    }

    if (this.#config.edgePan !== false) {
      const controller = this.engine.edgePanController;
      if (this.#edgePanPointerId == null) {
        this.#edgePanPointerId = prop.pointerId;
        controller?.startEdgePan(prop.pointerId, prop.position, (position) =>
          this.#moveDraggedLine(position),
        );
      } else {
        controller?.updateEdgePan(prop.pointerId, prop.position);
      }
    }

    this.#moveDraggedLine(prop.position);
  }

  #moveDraggedLine(position: PointerPosition): void {
    if (this.#state !== ConnectorState.DRAGGING || !this.#dragLine) return;

    const candidate = this.#resolveTargetAtPoint(position, "preview-target");
    this.#setCandidate(candidate);
    this.#dragLine.setPhase(candidate ? "preview-target" : "preview-free");
    this.#dragLine.setPreviewPosition(position);
    this.#dragLine.schedule(() => this.#dragLine?.writeTransform(), {
      stage: "WRITE_2",
      queueId: `${this.#dragLine.id}-transform`,
    });
  }

  endDragOutLine(prop: dragEndProp): void {
    if (
      this.#state !== ConnectorState.DRAGGING ||
      this.#armed?.pointerId !== prop.pointerId
    ) {
      return;
    }
    const line = this.#dragLine;
    if (!line) {
      this.#resetGesture();
      return;
    }

    if (prop.cancelled || this.#cancelledPointers.has(prop.pointerId)) {
      this.#discardDraggedLine(line, prop, false, "cancelled");
      return;
    }

    const candidate = this.#resolveTargetAtPoint(prop.end, "drop");
    this.#setCandidate(candidate);
    line.setPhase("drop");
    line.setPreviewPosition(prop.end);

    const mirror = getGraphRegistry(this.engine);
    if (typeof mirror.reconciler?.dispatchLineChangeRequest === "function") {
      this.#endControlledDrop(line, candidate, prop);
      return;
    }
    // Topology is always controlled: without a graph owner attached there
    // is no document to propose to, so the gesture cannot produce a line.
    console.warn(
      "SnapLine: gesture on an engine with no ControlledGraph attached — mount <ControlledGraph> (or call attachControlledGraph) so gestures have a document to propose to.",
    );
    this.#discardDraggedLine(line, prop, false, "cancelled");
  }

  /**
   * Controlled-mode drop: nothing mutates settled topology locally. The
   * gesture stages its outcome on the line mirror and proposes one atomic
   * LineChangeRequest; the post-request reconciliation pass settles or
   * discards the staged state against the canonical decision.
   */
  #endControlledDrop(
    line: LineMirror,
    candidate: ConnectorResolvedHit | null,
    prop: dragEndProp,
  ): void {
    const target = candidate?.candidate.connector ?? null;
    // "Nothing under the pointer" and "something under the pointer that said
    // no" are different answers, and only the first one means the user asked
    // for a node that does not exist yet.
    const outcome: DragEndOutcome =
      !candidate || !target
        ? "empty-space"
        : this.#admitsConnection(target, line, "drop")
          ? "connected"
          : "refused";

    // The candidate/target checks are redundant with `outcome` but keep the
    // non-null narrowing for everything below.
    if (outcome !== "connected" || !candidate || !target) {
      if (this.#gestureOrigin === "reconnect") {
        // Gesture disconnect: propose the removal; the line stays visibly
        // detached until the decision. A rejected removal re-glues it from
        // the unchanged document.
        line.stageForRemoval();
        this.parent.updateNodeLineList();
        this.#dispatchRequest({
          intent: "disconnect",
          add: [],
          remove: [line.lineId],
          update: [],
        });
        this.parent.scheduleLineWrites();
        this.#callbacks.onDragEnd?.({
          connector: this,
          position: prop.end,
          pointerId: prop.pointerId,
          connected: false,
          outcome,
        });
        this.#resetGesture();
        return;
      }
      this.#discardDraggedLine(line, prop, false, outcome);
      return;
    }

    // Evictions ride the atomic proposal ("replace") — never local deletes.
    const evictions: string[] = [];
    const incoming = target
      .#liveIncomingLines()
      .filter((incomingLine) => incomingLine !== line);
    const overflow = incoming.length - target.#rules.maxIncoming + 1;
    if (overflow > 0) {
      for (const evicted of incoming.slice(0, overflow)) {
        evictions.push(evicted.lineId);
      }
    }

    line.stageTarget(target, candidate.candidate, candidate.strategy);
    this.parent.updateNodeLineList();

    const request: LineChangeRequest =
      this.#gestureOrigin === "reconnect"
        ? {
            intent: evictions.length > 0 ? "replace" : "reconnect",
            add: [],
            remove: evictions,
            update: [{ id: line.lineId, toConnectorId: target.connectorId }],
          }
        : {
            intent: evictions.length > 0 ? "replace" : "connect",
            add: [
              {
                id: line.lineId,
                fromConnectorId: this.connectorId,
                toConnectorId: target.connectorId,
                ...(line.payload !== undefined
                  ? { payload: line.payload }
                  : {}),
              },
            ],
            remove: evictions,
            update: [],
          };
    this.#dispatchRequest(request);
    this.parent.scheduleLineWrites();
    this.#callbacks.onDragEnd?.({
      connector: this,
      position: prop.end,
      pointerId: prop.pointerId,
      connected: true,
      outcome: "connected",
    });
    this.#resetGesture();
  }

  /** Connector-level override, else the parent node's resolver. */
  #resolveNewLine(): NewLineResolver | null {
    return (
      this.#callbacks.resolveNewLine ??
      this.parent?.callbacks.resolveNewLine ??
      null
    );
  }

  #dispatchRequest(request: LineChangeRequest): void {
    // The dispatch itself adopts the application's returned line list, so the
    // decisive pass this schedules always sees the app's answer — including
    // rejection, which returns the list unchanged.
    const registry = getGraphRegistry(this.engine);
    registry.reconciler?.dispatchLineChangeRequest?.(request);
    registry.scheduleReconciliation();
  }

  /** @internal Reconciler-only: settle a staged gesture line onto its
   * accepted target. Capacity and both predicates recheck strictly. */
  settleStagedLineFromRecord(
    line: LineMirror,
    target: ConnectorMirror,
  ): true | "capacity-exceeded" | "connection-rejected" {
    const structural = this.#admitsEndpoints(target, line, false);
    if (structural !== true) return structural;
    if (!this.#predicatesAdmit(target, line, "drop")) {
      return "connection-rejected";
    }
    this.#settlePreviewLine(line, target, null, "gesture", null);
    return true;
  }

  /** @internal Reconciler-only: drop a staged line the canonical owner
   * declined. No disconnect observation — no connect was ever observed. */
  discardStagedLine(line: LineMirror): void {
    const index = this.#outgoingLines.indexOf(line);
    if (index === -1) return;
    this.#outgoingLines.splice(index, 1);
    line.destroy(false);
    this.parent?.updateNodeLineList();
  }

  /**
   * Settle a line that already sits in this connector's outgoing list onto
   * its target: run the explicit replacement policy, detach any previous
   * target, glue anchors, and emit. Validation happened before this point.
   */
  #settlePreviewLine(
    line: LineMirror,
    target: ConnectorMirror,
    candidate: ConnectorResolvedHit | null,
    origin: ConnectionOrigin,
    payload: { value: unknown } | null,
  ): void {
    // No local eviction here: replace-oldest evictions ride the atomic
    // request, and the reconciler prunes accepted removals before settling —
    // by the time a line settles, its target has room by construction.
    const previousTarget = line.target;
    if (previousTarget) {
      previousTarget.#incomingLines = previousTarget.#incomingLines.filter(
        (incomingLine) => incomingLine !== line,
      );
      line.clearTarget();
      this.#emitDisconnect(previousTarget, line, "programmatic");
    }

    // Payload and anchors are authoritative before render/connect callbacks.
    if (payload) line.setPayload(payload.value);
    line.connectTarget(
      target,
      candidate?.candidate ?? null,
      candidate?.strategy ?? target.#defaultAnchorStrategy(),
    );
    if (!target.#incomingLines.includes(line)) {
      target.#incomingLines.push(line);
    }
    line.writeTransform();

    this.parent.updateNodeLineList();
    this.#emitConnect(target, line, origin);
  }

  resolveAnchor({
    line,
    role,
    phase,
    peer,
    position,
    hit,
    strategy,
  }: {
    line: LineMirror;
    role: ConnectorRole;
    phase: LineMirrorPhase;
    peer: ConnectorMirror | null;
    position: Point;
    hit: ConnectorHit | null;
    strategy: ConnectorSurfaceStrategy | null;
  }): ConnectorAnchor {
    const currentStrategy =
      strategy && this.surfaceStrategies.includes(strategy)
        ? strategy
        : this.#defaultAnchorStrategy();
    const resolved = currentStrategy?.resolveAnchor?.({
      connector: this,
      peer,
      line,
      role,
      phase,
      position,
      geometry: this.geometry,
      peerGeometry: peer?.geometry ?? null,
      hit,
    });
    if (resolved && isFinitePoint(resolved)) return cloneAnchor(resolved);
    if (
      hit &&
      (currentStrategy != null || phase !== "connected") &&
      isFinitePoint(hit.anchor)
    ) {
      return cloneAnchor(hit.anchor);
    }
    return cloneAnchor(this.center);
  }

  destroy(removeElement: boolean = true): void {
    if (this.#edgePanPointerId != null) {
      this.engine.edgePanController?.stopEdgePan(this.#edgePanPointerId);
      this.#edgePanPointerId = null;
    }
    this.#resetGesture();
    this.deleteAllLines("teardown");
    getGraphRegistry(this.engine).unregisterConnector(this);
    this.parent?.detachConnector(this);
    this.globalInput.pointerUp = null;
    super.destroy(removeElement);
  }

  #resolveTargetAtPoint(
    position: PointerPosition,
    phase: "preview-target" | "drop",
  ): ConnectorResolvedHit | null {
    const hits: ConnectorResolvedHit[] = [];
    for (const collider of this.engine.collisionEngine?.queryPoint(position) ??
      []) {
      const connector = collider.parent;
      if (
        !(connector instanceof ConnectorMirror) ||
        collider !== connector.#hitCircle ||
        connector.engine !== this.engine ||
        connector.isDeleteRequested ||
        !this.#admitsConnection(connector, this.#dragLine, "candidate")
      ) {
        continue;
      }

      const targetStrategies = connector.surfaceStrategies
        .map((strategy, strategyIndex) => ({ strategy, strategyIndex }))
        .filter(({ strategy }) => strategy.targetHitTest != null);
      for (const { strategyIndex, strategy } of targetStrategies) {
        const hit = normalizeHit(
          strategy.targetHitTest?.({
            connector,
            position,
            geometry: connector.geometry,
            phase,
          }),
        );
        if (hit) {
          hits.push({
            candidate: { connector, hit },
            strategy,
            strategyIndex,
          });
        }
      }

      if (
        targetStrategies.length === 0 &&
        connector.#hasOrdinaryPortGeometry()
      ) {
        const center = connector.center;
        hits.push({
          candidate: {
            connector,
            hit: {
              anchor: center,
              distance: Math.hypot(
                center.x - position.x,
                center.y - position.y,
              ),
            },
          },
          strategy: connector.#defaultAnchorStrategy(),
          strategyIndex: Number.MAX_SAFE_INTEGER,
        });
      }
    }
    return pickResolvedHit(hits);
  }

  #setCandidate(candidate: ConnectorResolvedHit | null): void {
    const previous = this.#candidate;
    if (
      previous?.candidate.connector === candidate?.candidate.connector &&
      previous?.strategy === candidate?.strategy &&
      previous?.candidate.hit.anchor.x === candidate?.candidate.hit.anchor.x &&
      previous?.candidate.hit.anchor.y === candidate?.candidate.hit.anchor.y &&
      previous?.candidate.hit.payload === candidate?.candidate.hit.payload &&
      previous?.candidate.hit.distance === candidate?.candidate.hit.distance &&
      previous?.candidate.hit.priority === candidate?.candidate.hit.priority
    ) {
      return;
    }
    this.#candidate = candidate;
    this.#dragLine?.setCandidate(
      candidate?.candidate ?? null,
      candidate?.strategy ?? null,
    );
    this.#callbacks.onCandidateChange?.({
      source: this,
      candidate: candidate?.candidate.connector ?? null,
      resolvedCandidate: candidate?.candidate ?? null,
      line: this.#dragLine,
    });
  }

  #detachLineForReconnect(line: LineMirror): void {
    const target = line.target;
    if (!target) return;
    target.#incomingLines = target.#incomingLines.filter(
      (incomingLine) => incomingLine !== line,
    );
    line.detachTarget();
    this.#emitDisconnect(target, line, "gesture");
  }

  #discardDraggedLine(
    line: LineMirror,
    prop: dragEndProp,
    connected: boolean,
    outcome: DragEndOutcome,
  ): void {
    if (this.#outgoingLines.includes(line)) this.deleteLine(line, "gesture");
    this.#callbacks.onDragEnd?.({
      connector: this,
      position: prop.end,
      pointerId: prop.pointerId,
      connected,
      outcome,
    });
    this.#resetGesture();
  }

  #resetGesture(): void {
    if (this.#edgePanPointerId != null) {
      this.engine.edgePanController?.stopEdgePan(this.#edgePanPointerId);
      this.#edgePanPointerId = null;
    }
    if (this.#armed) {
      this.#cancelledPointers.delete(this.#armed.pointerId);
    }
    this.#state = ConnectorState.IDLE;
    this.#armed = null;
    this.#dragLine = null;
    this.#gestureOrigin = null;
    this.#setCandidate(null);
  }

  #defaultAnchorStrategy(): ConnectorSurfaceStrategy | null {
    return (
      this.surfaceStrategies.find(
        (strategy) => strategy.resolveAnchor != null,
      ) ?? null
    );
  }

  #hasOrdinaryPortGeometry(): boolean {
    return this.element != null || this.#hasMeasuredCenter;
  }

  /**
   * @internal Reconciler-only: create a settled mirror for a canonical line
   * record. No gesture policy — capacity is strict (never evicts, regardless
   * of onFull) and refusal reports a diagnostic code instead of throwing.
   */
  createSettledLineFromRecord(
    target: ConnectorMirror,
    record: { id: string; payload?: unknown },
  ): LineMirror | "capacity-exceeded" | "connection-rejected" {
    const structural = this.#admitsEndpoints(target, null, false);
    if (structural !== true) return structural;

    const line = this.#createLine({ id: record.id });
    if (!this.#predicatesAdmit(target, line, "drop")) {
      line.destroy(false);
      return "connection-rejected";
    }
    this.#outgoingLines.unshift(line);
    this.#settlePreviewLine(line, target, null, "hydration", {
      value: record.payload,
    });
    return line;
  }

  /**
   * @internal Reconciler-only: move an existing settled line to a new
   * canonical target, preserving the mirror. Strict capacity; never evicts.
   */
  retargetSettledLineFromRecord(
    line: LineMirror,
    target: ConnectorMirror,
  ): true | "capacity-exceeded" | "connection-rejected" {
    const structural = this.#admitsEndpoints(target, line, false);
    if (structural !== true) return structural;
    if (!this.#predicatesAdmit(target, line, "drop")) {
      return "connection-rejected";
    }
    this.#settlePreviewLine(line, target, null, "hydration", null);
    return true;
  }

  #liveIncomingLines(): LineMirror[] {
    return this.#incomingLines.filter((line) => !line.isDeleteRequested);
  }

  #liveOutgoingLines(): LineMirror[] {
    return this.#outgoingLines.filter((line) => !line.isDeleteRequested);
  }

  #emitConnect(
    target: ConnectorMirror,
    line: LineMirror,
    origin: ConnectionOrigin,
  ): void {
    this.#callbacks.onConnect?.({
      source: this,
      target,
      connector: this,
      peer: target,
      line,
      role: "source",
      origin,
    });
    target.#callbacks.onConnect?.({
      source: this,
      target,
      connector: target,
      peer: this,
      line,
      role: "target",
      origin,
    });
  }

  #emitDisconnect(
    target: ConnectorMirror,
    line: LineMirror,
    reason: DisconnectReason,
  ): void {
    this.#callbacks.onDisconnect?.({
      source: this,
      target,
      connector: this,
      peer: target,
      line,
      role: "source",
      reason,
    });
    target.#callbacks.onDisconnect?.({
      source: this,
      target,
      connector: target,
      peer: this,
      line,
      role: "target",
      reason,
    });
  }
}

function resolveRules(config: ConnectorConfig): ResolvedConnectorRules {
  const rules = config.rules ?? {};
  const toCount = (
    limit: ConnectionLimit | undefined,
    fallback: number,
  ): number =>
    limit === undefined ? fallback : limit === "unlimited" ? Infinity : limit;
  return {
    maxOutgoing: toCount(rules.maxOutgoing, Infinity),
    maxIncoming: toCount(rules.maxIncoming, 1),
    reconnect: rules.reconnect ?? true,
    allowParallel: rules.allowParallel ?? false,
    onFull: rules.onFull ?? "reject",
    isValidConnection: rules.isValidConnection ?? null,
  };
}

function normalizeHit(
  hit: ConnectorHit | null | false | void,
): ConnectorHit | null {
  if (!hit || !isFinitePoint(hit.anchor) || !Number.isFinite(hit.distance)) {
    return null;
  }
  return {
    ...hit,
    anchor: cloneAnchor(hit.anchor),
  };
}

function isFinitePoint(point: Point): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

/** A full pointer position for a world point, resolving camera and screen. */
function asPointerPosition(
  camera: WorldToScreenMapper | null,
  position: Point,
): PointerPosition {
  const value = position as Partial<PointerPosition>;
  if (value.camera && value.screen) return value as PointerPosition;
  return pointerPositionFromWorld(camera, position.x, position.y);
}

function compareResolvedHits(
  a: ConnectorResolvedHit,
  b: ConnectorResolvedHit,
): number {
  const priority =
    (b.candidate.hit.priority ?? 0) - (a.candidate.hit.priority ?? 0);
  if (priority !== 0) return priority;
  const distance = a.candidate.hit.distance - b.candidate.hit.distance;
  if (distance !== 0) return distance;
  const connectorOrder = a.candidate.connector.id.localeCompare(
    b.candidate.connector.id,
  );
  if (connectorOrder !== 0) return connectorOrder;
  return a.strategyIndex - b.strategyIndex;
}

function pickResolvedHit(
  hits: ConnectorResolvedHit[],
): ConnectorResolvedHit | null {
  hits.sort(compareResolvedHits);
  return hits[0] ?? null;
}

export { ConnectorMirror };
