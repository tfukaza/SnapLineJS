import { EventProxyFactory } from "@snap-engine/core";
import type { BaseObject, dragStartProp, dragEndProp } from "@snap-engine/core";
import { NodeComponent, mergeConfig, type NodeConfig } from "./node";
import { getGroups, snapData } from "./snapline-globals";

export interface GroupConfig extends NodeConfig {
  width?: number;
  height?: number;
}

const DEFAULT_GROUP_CONFIG = {
  width: 400,
  height: 300,
  minWidth: 160,
  minHeight: 120,
} satisfies GroupConfig;

interface GroupCallback {
  // Fired when a node enters/leaves the group's live geometric footprint at a
  // settle event (resize, move-settle, or another node's drop) — never for a
  // carried member that merely moved with the group.
  onMemberEnter: null | ((node: NodeComponent) => void);
  onMemberLeave: null | ((node: NodeComponent) => void);
  // Fired at the end of a group drag (after members are detached and their
  // final world positions are settled) so consumers can persist positions.
  onDragCommit: null | (() => void);
}

// A resizable box that carries any node whose center is inside it. Membership is
// live geometric containment, maintained at settle events; moving the group
// transform-parents its known members and rides SnapEngine's writeTransform
// cascade to move them (and their lines) in a single pass.
//
// Design limits (v1, by intent): groups are excluded from membership, so groups
// cannot nest inside groups; and carried members are moved via transform
// parenting only — they are never added to global.data.select, so a group drag
// does not alter the user's selection.
class GroupNodeComponent extends NodeComponent {
  #members: Set<NodeComponent> = new Set();
  #carry: NodeComponent[] = [];
  #groupCallback: GroupCallback;

  constructor(engine: any, parent: BaseObject | null, config: GroupConfig = {}) {
    // A group is resizable via the core BR resize hitbox. Group defaults are
    // merged here (single default site); undefined adapter props never shadow.
    const merged = mergeConfig<GroupConfig>({ ...DEFAULT_GROUP_CONFIG }, config);
    super(engine, parent, { ...merged, resizable: true });

    this.#groupCallback = { onMemberEnter: null, onMemberLeave: null, onDragCommit: null };
    this.#groupCallback = EventProxyFactory(this, this.#groupCallback);

    // Register so any node's drop can notify every group (see NodeComponent.onDragEnd).
    getGroups(this.global).push(this);
  }

  get groupCallback(): GroupCallback {
    return this.#groupCallback;
  }

  /** Snapshot of the current geometric members (settle-maintained). */
  get members(): ReadonlySet<NodeComponent> {
    return this.#members;
  }

  // Route the scheduled drag write through the recursive cascade so the group,
  // its carried members, and their lines all paint in one WRITE_2 pass. The
  // inherited setDragPosition/setUpPosition already schedule this under
  // queueId `${id}-transform`, so no drag-loop change is needed.
  writeTransformAndLines(): void {
    this.writeTransformRecursive();
  }

  #containsCenter(node: NodeComponent): boolean {
    const box = this.hitBox.getWorldBoundsSnapshot();
    const nb = node.hitBox.getWorldBoundsSnapshot();
    return (
      nb.centerX >= box.left &&
      nb.centerX <= box.right &&
      nb.centerY >= box.top &&
      nb.centerY <= box.bottom
    );
  }

  computeMembers(): NodeComponent[] {
    const table = this.global.getEngineObjectTable(this.engine);
    return Object.values(table).filter(
      (obj: any): obj is NodeComponent =>
        obj instanceof NodeComponent &&
        // Groups never join other groups: nested groups are out of scope (v1).
        !(obj instanceof GroupNodeComponent) &&
        obj !== this &&
        this.#containsCenter(obj),
    );
  }

  refreshMembership(fireDelta: boolean): void {
    const newSet = new Set(this.computeMembers());
    if (fireDelta) {
      for (const node of newSet) {
        if (!this.#members.has(node)) this.#groupCallback?.onMemberEnter?.(node);
      }
      for (const node of this.#members) {
        if (!newSet.has(node)) this.#groupCallback?.onMemberLeave?.(node);
      }
    }
    this.#members = newSet;
  }

  // Any size change (drag-driven setSize or an adapter's state seed) also
  // re-evaluates membership: the group's footprint changed. The synchronous
  // hitbox update inside super means this refresh sees the new bounds.
  setSizeState(width: number, height: number): void {
    super.setSizeState(width, height);
    this.refreshMembership(true);
  }

  onDragStart(prop: dragStartProp): void {
    super.onDragStart(prop);
    if (this._resizing) return; // a resize, not a move — don't carry members
    // Carry the ALREADY-KNOWN set (from the last settle) — no geometric scan here.
    this.#carry = [...this.#members];
    for (const member of this.#carry) member.attachTransformToGroup(this);
  }

  onDragEnd(prop: dragEndProp): void {
    const wasResizing = this._resizing;
    // super sets the group's final world synchronously (and notifies other
    // groups); members are still parented, so their world is already final. For a
    // resize, super handles setSize/onResizeCommit and our setSize refreshes
    // membership, so there is no carry to detach.
    super.onDragEnd(prop);
    if (wasResizing) return;
    for (const member of this.#carry) {
      member.detachTransformFromGroup(); // preserveWorld keeps the final position
      member.schedule(() => member.writeTransformAndLines(), {
        stage: "WRITE_2",
        queueId: `${member.id}-transform`,
      });
    }
    this.#carry = [];
    // Re-evaluate at rest: newly-overlapped nodes enter; carried members that
    // merely moved are in both sets → no callback.
    this.refreshMembership(true);
    // Positions (group + members) are now final; let the consumer persist them.
    this.#groupCallback?.onDragCommit?.();
  }

  destroy(): void {
    snapData(this.global).groups = getGroups(this.global).filter(
      (g) => g !== (this as unknown),
    );
    for (const member of this.#carry) member.detachTransformFromGroup();
    this.#carry = [];
    super.destroy();
  }
}

export { GroupNodeComponent };
