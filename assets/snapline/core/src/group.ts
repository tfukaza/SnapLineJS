import type {
  BaseObject,
  Engine,
  eventPosition,
} from "@snap-engine/core";
import { NodeMirror, mergeConfig, type NodeConfig } from "./node";
import { getGraphMirror } from "./snapline-globals";

export interface GroupConfig extends NodeConfig {
  width?: number;
  height?: number;
  /** Additional eligibility filter applied after geometric containment. */
  canContain?: (event: GroupContainEvent) => boolean;
  groupCallbacks?: GroupCallbacks;
}

export interface GroupContainEvent {
  group: GroupNodeMirror;
  node: NodeMirror;
  centerContained: boolean;
  boundsContained: boolean;
}

export interface GroupMembershipEvent {
  group: GroupNodeMirror;
  added: readonly NodeMirror[];
  removed: readonly NodeMirror[];
  /** Direct members only. Use `group.descendants` for the complete subtree. */
  members: readonly NodeMirror[];
}

export interface GroupCallbacks {
  onMembershipChange?: (event: GroupMembershipEvent) => void;
}

export interface GroupMembershipResolutionEvent {
  node: NodeMirror;
  /** Safe eligible candidates, ordered from innermost to outermost. */
  candidates: readonly GroupNodeMirror[];
  defaultParent: GroupNodeMirror | null;
}

export type GroupMembershipResolver = (
  event: GroupMembershipResolutionEvent,
) => GroupNodeMirror | null;

const DEFAULT_GROUP_CONFIG = {
  width: 400,
  height: 300,
  minWidth: 160,
  minHeight: 120,
} satisfies GroupConfig;

type Bounds = ReturnType<
  NodeMirror["hitBox"]["getWorldBoundsSnapshot"]
>;

function boundsArea(bounds: Bounds): number {
  return Math.max(0, bounds.right - bounds.left) *
    Math.max(0, bounds.bottom - bounds.top);
}

function containsBounds(container: Bounds, child: Bounds): boolean {
  return (
    child.left >= container.left &&
    child.right <= container.right &&
    child.top >= container.top &&
    child.bottom <= container.bottom
  );
}

function stableGroupOrder(
  left: GroupNodeMirror,
  right: GroupNodeMirror,
): number {
  const areaDelta =
    boundsArea(left.hitBox.getWorldBoundsSnapshot()) -
    boundsArea(right.hitBox.getWorldBoundsSnapshot());
  return areaDelta || String(left.id).localeCompare(String(right.id));
}

function groupsForEngine(group: GroupNodeMirror): GroupNodeMirror[] {
  return [...getGraphMirror(group.engine).groups];
}

function nodesForEngine(group: GroupNodeMirror): NodeMirror[] {
  return [...getGraphMirror(group.engine).nodes];
}

function resolveParent(
  node: NodeMirror,
  candidates: GroupNodeMirror[],
  resolver: GroupMembershipResolver | null,
): GroupNodeMirror | null {
  candidates.sort(stableGroupOrder);
  const defaultParent = candidates[0] ?? null;
  if (!resolver) return defaultParent;

  const resolved = resolver({ node, candidates, defaultParent });
  if (resolved === null || candidates.includes(resolved)) return resolved;

  console.warn(
    "SnapLine group membership resolver returned a group outside its eligible candidates; using the default parent.",
    { node, resolved, candidates },
  );
  return defaultParent;
}

function wouldCreateGroupCycle(
  node: GroupNodeMirror,
  parent: GroupNodeMirror,
  nextParents: Map<NodeMirror, GroupNodeMirror>,
): boolean {
  let ancestor: GroupNodeMirror | undefined = parent;
  const visited = new Set<GroupNodeMirror>();
  while (ancestor && !visited.has(ancestor)) {
    if (ancestor === node) return true;
    visited.add(ancestor);
    ancestor = nextParents.get(ancestor);
  }
  return false;
}

function reconcileMembership(
  source: GroupNodeMirror,
  fireDelta: boolean,
): void {
  const mirror = getGraphMirror(source.engine);
  if (mirror.reconcilingMembership) return;
  mirror.reconcilingMembership = true;

  try {
    const groups = groupsForEngine(source);
    const nextMembers = new Map<
      GroupNodeMirror,
      Set<NodeMirror>
    >(groups.map((group) => [group, new Set()]));
    const nextParents = new Map<NodeMirror, GroupNodeMirror>();

    const nodes = nodesForEngine(source);
    const groupNodes = [...groups].sort(stableGroupOrder);
    const ordinaryNodes = nodes.filter(
      (node) => !(node instanceof GroupNodeMirror),
    );

    // Resolve the group forest first. A proposed edge can point at a group that
    // has already chosen another parent, so walking the partial parent map is
    // enough to reject the edge that would close any cycle.
    for (const node of groupNodes) {
      const candidates = groups.filter(
        (group) =>
          group !== node &&
          group.allowsMembership(node) &&
          !wouldCreateGroupCycle(node, group, nextParents),
      );
      const parent = resolveParent(node, candidates, mirror.membershipResolver);
      if (!parent) continue;
      nextMembers.get(parent)?.add(node);
      nextParents.set(node, parent);
    }

    // Ordinary nodes cannot form membership cycles. They choose the innermost
    // eligible group after the group hierarchy is settled.
    for (const node of ordinaryNodes) {
      const candidates = groups.filter((group) =>
        group.allowsMembership(node)
      );
      const parent = resolveParent(node, candidates, mirror.membershipResolver);
      if (!parent) continue;
      nextMembers.get(parent)?.add(node);
      nextParents.set(node, parent);
    }

    const deltas = groups.map((group) => {
      const previous = group.members;
      const next = nextMembers.get(group) ?? new Set<NodeMirror>();
      return {
        group,
        next,
        added: [...next].filter((node) => !previous.has(node)),
        removed: [...previous].filter((node) => !next.has(node)),
      };
    });

    for (const node of nodes) {
      const parent = nextParents.get(node);
      if (parent) mirror.parentGroups.set(node, parent);
      else mirror.parentGroups.delete(node);
    }
    for (const { group, next } of deltas) group.setResolvedMembers(next);

    if (fireDelta) {
      for (const { group, next, added, removed } of deltas) {
        if (!added.length && !removed.length) continue;
        group.groupCallbacks.onMembershipChange?.({
          group,
          added,
          removed,
          members: [...next],
        });
      }
    }
  } finally {
    mirror.reconcilingMembership = false;
  }
}

/** Return the node's settled, exclusive direct parent group. */
export function getParentGroup(
  node: NodeMirror,
): GroupNodeMirror | null {
  return getGraphMirror(node.engine).parentGroups.get(node) ?? null;
}

/**
 * Override automatic innermost-group selection for one engine.
 * The resolver may return one of `event.candidates` or `null`.
 */
export function setGroupMembershipResolver(
  engine: Engine,
  resolver: GroupMembershipResolver,
): () => void {
  const mirror = getGraphMirror(engine);
  mirror.membershipResolver = resolver;
  const refresh = () => {
    // Any live group re-derives the whole engine's membership forest.
    mirror.groups[0]?.refreshMembership(true);
  };
  refresh();

  return () => {
    if (mirror.membershipResolver !== resolver) return;
    mirror.membershipResolver = null;
    refresh();
  };
}

// A resizable box with settled geometric membership. Membership is exclusive:
// each node has one direct parent, while nested groups form a recursive tree.
class GroupNodeMirror extends NodeMirror {
  #members: Set<NodeMirror> = new Set();
  #carry: NodeMirror[] = [];
  #carryOrigins = new Map<NodeMirror, { x: number; y: number }>();
  #carryGroupOrigin = { x: 0, y: 0 };
  #groupCallbacks: GroupCallbacks;
  #groupConfig: GroupConfig;

  constructor(engine: any, parent: BaseObject | null, config: GroupConfig = {}) {
    const merged = mergeConfig<GroupConfig>(
      { ...DEFAULT_GROUP_CONFIG },
      config,
    );
    super(engine, parent, { ...merged, resizable: true });
    this.#groupConfig = merged;
    this.#groupCallbacks = merged.groupCallbacks ?? {};
    getGraphMirror(this.engine).groups.push(this);
  }

  get groupCallbacks(): GroupCallbacks {
    return this.#groupCallbacks;
  }

  /** Direct settled members. */
  get members(): ReadonlySet<NodeMirror> {
    return this.#members;
  }

  /** Every settled member below this group, recursively and without duplicates. */
  get descendants(): ReadonlySet<NodeMirror> {
    const result = new Set<NodeMirror>();
    const visit = (group: GroupNodeMirror): void => {
      for (const member of group.#members) {
        if (result.has(member)) continue;
        result.add(member);
        if (member instanceof GroupNodeMirror) visit(member);
      }
    };
    visit(this);
    return result;
  }

  get parentGroup(): GroupNodeMirror | null {
    return getParentGroup(this);
  }

  /** @internal Used by the engine-wide exclusive-membership reconciliation. */
  setResolvedMembers(members: Set<NodeMirror>): void {
    this.#members = members;
  }

  writeTransformAndLines(): void {
    super.writeTransformAndLines();
  }

  allowsMembership(node: NodeMirror): boolean {
    const box = this.hitBox.getWorldBoundsSnapshot();
    const nodeBounds = node.hitBox.getWorldBoundsSnapshot();
    const centerContained =
      nodeBounds.centerX >= box.left &&
      nodeBounds.centerX <= box.right &&
      nodeBounds.centerY >= box.top &&
      nodeBounds.centerY <= box.bottom;
    const boundsContained = containsBounds(box, nodeBounds);

    // Ordinary nodes use center containment. A nested group must fit completely
    // so partially overlapping peers cannot become a parent/child pair.
    if (
      node instanceof GroupNodeMirror ? !boundsContained : !centerContained
    ) {
      return false;
    }

    return (
      this.#groupConfig.canContain?.({
        group: this,
        node,
        centerContained,
        boundsContained,
      }) ?? true
    );
  }

  refreshMembership(fireDelta: boolean): void {
    reconcileMembership(this, fireDelta);
  }

  setSizeState(width: number, height: number): void {
    super.setSizeState(width, height);
    this.refreshMembership(true);
  }

  beginSelectionDrag(position: eventPosition): void {
    super.beginSelectionDrag(position);
    this.#carryGroupOrigin = {
      x: this.worldTransform.x,
      y: this.worldTransform.y,
    };
    this.#carry = [...this.descendants];
    this.#carryOrigins.clear();
    for (const member of this.#carry) {
      this.#carryOrigins.set(member, {
        x: member.worldTransform.x,
        y: member.worldTransform.y,
      });
      member.attachTransformToGroup(this);
    }
  }

  containsSelectionDragNode(node: NodeMirror): boolean {
    return this.descendants.has(node);
  }

  selectionDragNodes(): NodeMirror[] {
    return [...new Set([this, ...this.#carry])];
  }

  finishSelectionDrag(): void {
    const dx = this.worldTransform.x - this.#carryGroupOrigin.x;
    const dy = this.worldTransform.y - this.#carryGroupOrigin.y;
    for (const member of this.#carry) {
      member.detachTransformFromGroup();
      const origin = this.#carryOrigins.get(member);
      if (origin) {
        member.worldTransform = {
          x: origin.x + dx,
          y: origin.y + dy,
        };
      }
      member.scheduleTransformAndLines();
    }
    this.#carry = [];
    this.#carryOrigins.clear();
  }

  destroy(removeElement: boolean = true): void {
    const mirror = getGraphMirror(this.engine);
    const index = mirror.groups.indexOf(this);
    if (index >= 0) mirror.groups.splice(index, 1);
    for (const member of this.#carry) member.detachTransformFromGroup();
    this.#carry = [];
    this.#carryOrigins.clear();
    mirror.parentGroups.delete(this);

    mirror.groups[0]?.refreshMembership(true);
    super.destroy(removeElement);
  }
}

export { GroupNodeMirror };
