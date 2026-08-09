<script lang="ts">
  import { selectedFramework } from "$lib/stores/frameworkState.svelte";

  type Lane = "item" | "ghost" | "root" | "source" | "target" | "app" | "dom";
  type MessageKind = "sync" | "async" | "return";
  type RowKind = "standard" | "short" | "loop";

  interface DiagramMessage {
    step: string;
    title: string;
    code?: string;
    from: Lane;
    to: Lane;
    kind: MessageKind;
    rowKind?: RowKind;
    detail: string;
    branch?: string;
  }

  interface DiagramPhase {
    id: string;
    title: string;
    note?: string;
    messages: DiagramMessage[];
  }

  const laneOrder: Lane[] = [
    "item",
    "ghost",
    "root",
    "source",
    "target",
    "app",
    "dom",
  ];

  const isVanilla = $derived($selectedFramework === "vanilla");

  function message(
    step: string,
    title: string,
    code: string | undefined,
    from: Lane,
    to: Lane,
    detail: string,
    options: {
      kind?: MessageKind;
      rowKind?: RowKind;
      branch?: string;
    } = {},
  ): DiagramMessage {
    return {
      step,
      title,
      code,
      from,
      to,
      detail,
      kind: options.kind ?? "sync",
      rowKind: options.rowKind,
      branch: options.branch,
    };
  }

  function frameworkPhases(): DiagramPhase[] {
    return [
      {
        id: "start",
        title: "1 · Start",
        note: "Source ghost path: flow move/none. Insertion and flow copy begin at a valid destination; swap uses the root.",
        messages: [
          message(
            "1.1",
            "Begin session",
            "onDragStart",
            "item",
            "root",
            "The dragged item asks the root-owned DragSession to begin. The session invokes the root's onDragStart callback synchronously and directly; returning false vetoes activation.",
          ),
          message(
            "1.2",
            "Add source ghost",
            "onGhostInsert",
            "root",
            "source",
            "The root-owned lifecycle asks the source container to attach the passive ghost. The source is the callback receiver.",
            { rowKind: "short" },
          ),
          message(
            "1.3",
            "Update ghost state",
            "inside flushMutation",
            "source",
            "app",
            "The source's onGhostInsert callback synchronously updates framework-owned ghost state inside the transaction.",
          ),
          message(
            "1.4",
            "Commit ghost DOM",
            "framework commit",
            "app",
            "dom",
            "The framework synchronously commits the Ghost component to the DOM.",
            { rowKind: "short" },
          ),
          message(
            "1.5",
            "Bind ghost element",
            "ghostItem.element",
            "dom",
            "ghost",
            "Rendering binds the new DOM element to the passive Ghost item.",
          ),
          message(
            "1.6",
            "DOM commit complete",
            "pre-paint",
            "dom",
            "app",
            "The DOM mutation and ghost binding are complete. Layout and paint have not necessarily occurred.",
            { kind: "return" },
          ),
          message(
            "1.7",
            "Transaction complete",
            "flushMutation returns",
            "app",
            "root",
            "The synchronous framework transaction returns only after the DOM commit and binding are complete, so SnapSort may continue.",
            { kind: "return" },
          ),
        ],
      },
      {
        id: "move",
        title: "2 · Move + preview",
        note: "An ownership change uses two ordered receiver-local flushes: remove first, then insert. Either half may occur alone.",
        messages: [
          message(
            "2.1",
            "Resolve target",
            "pointer + layout snapshots",
            "root",
            "root",
            "The root-owned session synchronously resolves the prospective target from the pointer and captured layout.",
            { rowKind: "loop" },
          ),
          message(
            "2.2",
            "Policy + hover",
            "canDrop · getDropPriority · onDragItem*",
            "root",
            "target",
            "The session directly invokes policy callbacks on candidate owners and hover callbacks on the hovered item's direct owner. These callbacks are not wrapped by flushMutation.",
          ),
          message(
            "2.3a",
            "Remove ghost",
            "onGhostRemove",
            "root",
            "source",
            "The session asks the previous ghost owner to remove the ghost. The previous owner is shown in the Source/current owner lane.",
            { rowKind: "short", branch: "If leaving an owner · first" },
          ),
          message(
            "2.3b",
            "Remove ghost state",
            "inside flushMutation",
            "source",
            "app",
            "The previous owner's callback removes the ghost from framework state.",
          ),
          message(
            "2.3c",
            "Commit ghost removal",
            "framework commit",
            "app",
            "dom",
            "The framework synchronously removes the old ghost rendering from the DOM.",
            { rowKind: "short" },
          ),
          message(
            "2.3d",
            "DOM commit complete",
            "pre-paint",
            "dom",
            "app",
            "The old ghost DOM is gone before the framework transaction returns; layout and paint are still pending.",
            { kind: "return" },
          ),
          message(
            "2.3e",
            "Transaction complete",
            "flushMutation returns",
            "app",
            "root",
            "Control returns to the session after the old ghost DOM has been removed.",
            { kind: "return" },
          ),
          message(
            "2.4a",
            "Add ghost",
            "onGhostInsert",
            "root",
            "target",
            "The session asks the new target container to insert the same passive ghost at the prospective index.",
            { branch: "If entering a new target · then" },
          ),
          message(
            "2.4b",
            "Add ghost state",
            "inside flushMutation",
            "target",
            "app",
            "The target's callback adds the ghost to its framework-owned state.",
            { rowKind: "short" },
          ),
          message(
            "2.4c",
            "Commit ghost DOM",
            "framework commit",
            "app",
            "dom",
            "The framework synchronously renders the ghost in the new target.",
            { rowKind: "short" },
          ),
          message(
            "2.4d",
            "Rebind ghost element",
            "ghostItem.element",
            "dom",
            "ghost",
            "The target rendering binds its DOM element to the existing Ghost item.",
          ),
          message(
            "2.4e",
            "DOM commit complete",
            "pre-paint",
            "dom",
            "app",
            "The new target DOM and ghost binding are ready before the framework transaction returns.",
            { kind: "return" },
          ),
          message(
            "2.4f",
            "Transaction complete",
            "flushMutation returns",
            "app",
            "root",
            "Control returns to the session after the target ghost DOM is ready.",
            { kind: "return" },
          ),
          message(
            "2.5",
            "Report target change",
            "root.flushMutation(onDropTargetChange)",
            "root",
            "root",
            "After ghost relocation, the session dispatches onDropTargetChange on the tree root inside the root's synchronous transaction boundary. The notification does not itself imply a DOM write.",
            { rowKind: "loop" },
          ),
          message(
            "2.5r",
            "Notification complete",
            "flushMutation returns",
            "root",
            "root",
            "The root transaction returns before the next pointer update proceeds. No DOM route is shown because the notification need not mutate rendered state.",
            { kind: "return", rowKind: "loop" },
          ),
        ],
      },
      {
        id: "drop",
        title: "3 · Drop",
        note: "Current code uses two ordered flushes: remove the preview first, then commit the move or swap.",
        messages: [
          message(
            "3.1a",
            "Remove preview ghost",
            "onGhostRemove",
            "root",
            "target",
            "The session asks the current target ghost owner to remove the preview before committing the item mutation.",
            { branch: "First transaction · remove preview" },
          ),
          message(
            "3.1b",
            "Remove preview state",
            "inside flushMutation",
            "target",
            "app",
            "The target removes the preview ghost from framework state.",
            { rowKind: "short" },
          ),
          message(
            "3.1c",
            "Commit preview removal",
            "framework commit",
            "app",
            "dom",
            "The framework synchronously removes the preview ghost DOM.",
            { rowKind: "short" },
          ),
          message(
            "3.1d",
            "DOM commit complete",
            "pre-paint",
            "dom",
            "app",
            "The preview DOM removal is committed before the persistent item transaction begins.",
            { kind: "return" },
          ),
          message(
            "3.1e",
            "Transaction complete",
            "flushMutation returns",
            "app",
            "root",
            "The preview removal transaction returns before the persistent item commit begins.",
            { kind: "return" },
          ),
          message(
            "3.2a",
            "Commit move",
            "onItemMove · fallback onItemInsert",
            "root",
            "target",
            "The direct destination receives one semantic onItemMove callback. If it has no onItemMove, SnapSort invokes that destination's onItemInsert fallback instead.",
            { branch: "Second transaction · normal commit" },
          ),
          message(
            "3.2b",
            "Update both collections",
            "inside flushMutation",
            "target",
            "app",
            "The destination callback updates the source and destination framework collections as one move. The source receives no onItemRemove callback.",
            { rowKind: "short" },
          ),
          message(
            "3.2c",
            "Commit moved item DOM",
            "framework commit",
            "app",
            "dom",
            "The framework synchronously reconciles the moved item into its final DOM position.",
            { rowKind: "short" },
          ),
          message(
            "3.2d",
            "DOM commit complete",
            "pre-paint",
            "dom",
            "app",
            "The moved item is in its final DOM position before the transaction returns.",
            { kind: "return" },
          ),
          message(
            "3.2e",
            "Transaction complete",
            "flushMutation returns",
            "app",
            "root",
            "SnapSort resumes only after the moved item DOM has committed.",
            { kind: "return" },
          ),
          message(
            "3.3a",
            "Commit swap",
            "onItemSwap",
            "root",
            "source",
            "The dragged item's pre-swap direct source receives one atomic onItemSwap callback describing both participants.",
            { rowKind: "short", branch: "Second transaction · swap commit" },
          ),
          message(
            "3.3b",
            "Update both participants",
            "inside flushMutation",
            "source",
            "app",
            "The source-owned callback updates both swap participants in framework state.",
          ),
          message(
            "3.3c",
            "Commit swapped DOM",
            "framework commit",
            "app",
            "dom",
            "The framework synchronously renders both participants in their new slots.",
            { rowKind: "short" },
          ),
          message(
            "3.3d",
            "DOM commit complete",
            "pre-paint",
            "dom",
            "app",
            "Both swapped DOM positions are committed before the transaction returns.",
            { kind: "return" },
          ),
          message(
            "3.3e",
            "Transaction complete",
            "flushMutation returns",
            "app",
            "root",
            "SnapSort resumes after the swapped DOM has committed.",
            { kind: "return" },
          ),
        ],
      },
      {
        id: "finish",
        title: "4 · Finish",
        messages: [
          message(
            "4.1",
            "Clear final hover",
            "onDragItemLeave",
            "root",
            "target",
            "If an item remains hovered, the session directly invokes onDragItemLeave on that item's direct owner. This is not wrapped by flushMutation.",
          ),
          message(
            "4.2",
            "End session",
            "root.flushMutation(onDragEnd)",
            "root",
            "root",
            "After ghost cleanup and the chosen commit path, the session invokes onDragEnd on the root inside the root's transaction boundary. The notification does not itself imply a DOM write.",
            { rowKind: "loop" },
          ),
          message(
            "4.2r",
            "End callback complete",
            "flushMutation returns",
            "root",
            "root",
            "The onDragEnd transaction returns before final layout measurement. No DOM route is shown because the notification need not mutate rendered state.",
            { kind: "return", rowKind: "loop" },
          ),
          message(
            "4.3",
            "Read final layout",
            "getBoundingClientRect()",
            "root",
            "dom",
            "SnapSort synchronously requests final DOM geometry. If earlier writes invalidated style or layout, the browser resolves what this read needs before returning.",
          ),
          message(
            "4.4",
            "Return geometry",
            "DOMRect",
            "dom",
            "root",
            "The DOM measurement returns the final rectangle to SnapSort.",
            { kind: "return" },
          ),
          message(
            "4.5",
            "Start FLIP animation",
            "animate final transform",
            "root",
            "dom",
            "SnapSort hands the final visual transition to the browser without waiting for its playback duration.",
            { kind: "async" },
          ),
        ],
      },
      {
        id: "remove",
        title: "5 · Actual item removal",
        note: "Separate paths—not the source half of an ordinary move.",
        messages: [
          message(
            "5.1a",
            "Request programmatic removal",
            "container.removeItem(id)",
            "app",
            "source",
            "Application code asks the item's current direct owner to remove it. This path has session: null.",
            { branch: "Programmatic · session: null" },
          ),
          message(
            "5.1b",
            "Remove owned item",
            "onItemRemove",
            "source",
            "source",
            "The current owner detaches the item from SnapSort bookkeeping and invokes its own onItemRemove callback inside flushMutation.",
            { rowKind: "loop" },
          ),
          message(
            "5.1c",
            "Remove item state",
            "inside flushMutation",
            "source",
            "app",
            "The callback deletes the item from framework state.",
          ),
          message(
            "5.1d",
            "Commit item removal",
            "framework commit",
            "app",
            "dom",
            "The framework synchronously removes the item's DOM.",
            { rowKind: "short" },
          ),
          message(
            "5.1e",
            "DOM commit complete",
            "pre-paint",
            "dom",
            "app",
            "The item DOM is removed before the receiver's framework transaction returns.",
            { kind: "return" },
          ),
          message(
            "5.1f",
            "Transaction complete",
            "flushMutation returns",
            "app",
            "source",
            "The owner regains control after framework state and DOM are committed.",
            { kind: "return" },
          ),
          message(
            "5.1g",
            "Report success",
            "true",
            "source",
            "app",
            "container.removeItem returns true to its caller after finding and removing the item.",
            { kind: "return" },
          ),
          message(
            "5.2a",
            "Discard transient clone",
            "onItemRemove",
            "root",
            "source",
            "When a flow-copy clone must be discarded, the session invokes onItemRemove on the container currently rendering that clone.",
            { rowKind: "short", branch: "Flow-copy cleanup · active session" },
          ),
          message(
            "5.2b",
            "Delete clone state",
            "inside flushMutation",
            "source",
            "app",
            "The current owner removes the transient clone from framework state.",
          ),
          message(
            "5.2c",
            "Commit clone removal",
            "framework commit",
            "app",
            "dom",
            "The framework synchronously removes the transient clone DOM.",
            { rowKind: "short" },
          ),
          message(
            "5.2d",
            "DOM commit complete",
            "pre-paint",
            "dom",
            "app",
            "The transient clone DOM is removed before the framework transaction returns.",
            { kind: "return" },
          ),
          message(
            "5.2e",
            "Transaction complete",
            "flushMutation returns",
            "app",
            "root",
            "The cleanup transaction returns to the active session after DOM removal.",
            { kind: "return" },
          ),
        ],
      },
    ];
  }

  function vanillaPhases(): DiagramPhase[] {
    return [
      {
        id: "start",
        title: "1 · Start",
        note: "Source ghost path: flow move/none. Insertion and flow copy begin at a valid destination; swap uses the root.",
        messages: [
          message(
            "1.1",
            "Begin session",
            "onDragStart",
            "item",
            "root",
            "The dragged item asks the root-owned DragSession to begin. The session directly invokes the root's onDragStart callback.",
          ),
          message(
            "1.2",
            "Create flow ghost",
            "createGhost",
            "root",
            "source",
            "The root-owned lifecycle invokes the source container's Vanilla createGhost callback.",
            { rowKind: "short" },
          ),
          message(
            "1.3",
            "Return ghost element",
            "HTMLElement",
            "source",
            "root",
            "The createGhost callback returns the new DOM element.",
            { kind: "return", rowKind: "short" },
          ),
          message(
            "1.4",
            "Bind ghost element",
            "ghostItem.element",
            "root",
            "ghost",
            "SnapSort binds the returned HTMLElement to the passive Ghost item.",
            { rowKind: "short" },
          ),
          message(
            "1.5",
            "Add source ghost",
            "onGhostInsert",
            "root",
            "source",
            "The lifecycle asks the source container to insert the ghost and directly invokes onGhostInsert there.",
            { rowKind: "short" },
          ),
          message(
            "1.6",
            "Add ghost DOM",
            "insertBefore",
            "source",
            "dom",
            "The default Vanilla callback inserts the ghost element directly into the DOM.",
          ),
          message(
            "1.7",
            "DOM call complete",
            "insertBefore returned",
            "dom",
            "source",
            "The synchronous DOM API has returned. This does not mean layout or paint has completed.",
            { kind: "return" },
          ),
        ],
      },
      {
        id: "move",
        title: "2 · Move + preview",
        note: "When ownership changes, removal completes before insertion; either half may occur alone.",
        messages: [
          message(
            "2.1",
            "Resolve target",
            "pointer + layout snapshots",
            "root",
            "root",
            "The root-owned session synchronously resolves the prospective target.",
            { rowKind: "loop" },
          ),
          message(
            "2.2",
            "Policy + hover",
            "canDrop · getDropPriority · onDragItem*",
            "root",
            "target",
            "The session directly invokes policy callbacks on candidates and hover callbacks on the hovered item's direct owner.",
          ),
          message(
            "2.3a",
            "Remove ghost",
            "onGhostRemove",
            "root",
            "source",
            "The session directly invokes onGhostRemove on the previous ghost owner.",
            { rowKind: "short", branch: "If leaving an owner · first" },
          ),
          message(
            "2.3b",
            "Remove ghost DOM",
            "element.remove()",
            "source",
            "dom",
            "The default Vanilla callback removes the old ghost element from the DOM.",
          ),
          message(
            "2.3c",
            "DOM call complete",
            "remove() returned",
            "dom",
            "source",
            "The synchronous DOM removal call has returned. Layout and paint may still be pending.",
            { kind: "return" },
          ),
          message(
            "2.4a",
            "Add ghost",
            "onGhostInsert",
            "root",
            "target",
            "The session directly invokes onGhostInsert on the new target.",
            { branch: "If entering a new target · then" },
          ),
          message(
            "2.4b",
            "Add ghost DOM",
            "insertBefore",
            "target",
            "dom",
            "The default Vanilla callback inserts the ghost element into the new target's DOM.",
          ),
          message(
            "2.4c",
            "DOM call complete",
            "insertBefore returned",
            "dom",
            "target",
            "The synchronous DOM insertion call has returned. The existing passive Ghost remains bound to the moved element.",
            { kind: "return" },
          ),
          message(
            "2.5",
            "Report target change",
            "onDropTargetChange",
            "root",
            "root",
            "After relocation, the session directly invokes onDropTargetChange on the root. The notification does not itself imply a DOM write.",
            { rowKind: "loop" },
          ),
        ],
      },
      {
        id: "drop",
        title: "3 · Drop",
        note: "First remove the preview; then choose the normal commit or swap branch.",
        messages: [
          message(
            "3.1a",
            "Remove preview ghost",
            "onGhostRemove",
            "root",
            "target",
            "The session directly invokes onGhostRemove on the current preview owner.",
            { branch: "First · remove preview" },
          ),
          message(
            "3.1b",
            "Remove preview DOM",
            "element.remove()",
            "target",
            "dom",
            "The default Vanilla callback removes the preview ghost DOM.",
          ),
          message(
            "3.1c",
            "DOM call complete",
            "remove() returned",
            "dom",
            "target",
            "The synchronous DOM removal call has returned; layout and paint are not part of this return.",
            { kind: "return" },
          ),
          message(
            "3.2a",
            "Commit move",
            "onItemMove · fallback onItemInsert",
            "root",
            "target",
            "The destination receives onItemMove, or its onItemInsert fallback. The source receives no onItemRemove callback.",
            { branch: "Then · normal commit" },
          ),
          message(
            "3.2b",
            "Move item DOM",
            "insertBefore",
            "target",
            "dom",
            "The Vanilla callback moves the existing item DOM into its final position.",
          ),
          message(
            "3.2c",
            "DOM call complete",
            "insertBefore returned",
            "dom",
            "target",
            "The synchronous DOM move has returned with the node in its final tree position.",
            { kind: "return" },
          ),
          message(
            "3.3a",
            "Commit swap",
            "onItemSwap",
            "root",
            "source",
            "The pre-swap source receives onItemSwap when that atomic callback is present. Core's destination-owned move fallback is a separate path and is not shown here.",
            { rowKind: "short", branch: "Or · swap commit" },
          ),
          message(
            "3.3b",
            "Swap item DOM",
            "consumer callback",
            "source",
            "dom",
            "The Vanilla consumer applies the atomic swap. Without onItemSwap, core instead takes two destination-owned move paths.",
          ),
          message(
            "3.3c",
            "DOM callback complete",
            "consumer callback returned",
            "dom",
            "source",
            "Control returns after the consumer's synchronous DOM work. This return does not represent layout or paint completion.",
            { kind: "return" },
          ),
        ],
      },
      {
        id: "finish",
        title: "4 · Finish",
        messages: [
          message(
            "4.1",
            "Clear final hover",
            "onDragItemLeave",
            "root",
            "target",
            "If a hover remains active, the session directly invokes onDragItemLeave on the hovered item's owner.",
          ),
          message(
            "4.2",
            "End session",
            "onDragEnd",
            "root",
            "root",
            "After cleanup and commit, the session directly invokes onDragEnd on the root. The notification does not itself imply a DOM write.",
            { rowKind: "loop" },
          ),
          message(
            "4.3",
            "Read final layout",
            "getBoundingClientRect()",
            "root",
            "dom",
            "SnapSort synchronously requests final DOM geometry. If earlier writes invalidated style or layout, the browser resolves what this read needs before returning.",
          ),
          message(
            "4.4",
            "Return geometry",
            "DOMRect",
            "dom",
            "root",
            "The DOM measurement returns the final rectangle to SnapSort.",
            { kind: "return" },
          ),
          message(
            "4.5",
            "Start FLIP animation",
            "animate final transform",
            "root",
            "dom",
            "SnapSort hands the final visual transition to the browser without waiting for its playback duration.",
            { kind: "async" },
          ),
        ],
      },
      {
        id: "remove",
        title: "5 · Actual item removal",
        note: "Separate paths—not the source half of an ordinary move.",
        messages: [
          message(
            "5.1a",
            "Request programmatic removal",
            "container.removeItem(id)",
            "app",
            "source",
            "Application code asks the item's current direct owner to remove it with session: null.",
            { branch: "Programmatic · session: null" },
          ),
          message(
            "5.1b",
            "Remove owned item",
            "onItemRemove",
            "source",
            "source",
            "The current owner detaches the item and directly invokes its own onItemRemove callback.",
            { rowKind: "loop" },
          ),
          message(
            "5.1c",
            "Remove item DOM",
            "element.remove()",
            "source",
            "dom",
            "The default Vanilla callback removes the item DOM.",
          ),
          message(
            "5.1d",
            "DOM call complete",
            "remove() returned",
            "dom",
            "source",
            "The synchronous DOM removal call has returned. Layout and paint may still be pending.",
            { kind: "return" },
          ),
          message(
            "5.1e",
            "Report success",
            "true",
            "source",
            "app",
            "container.removeItem returns true after finding and removing the item.",
            { kind: "return" },
          ),
          message(
            "5.2a",
            "Discard transient clone",
            "onItemRemove",
            "root",
            "source",
            "Flow-copy cleanup invokes onItemRemove on the container currently rendering the transient clone.",
            { rowKind: "short", branch: "Flow-copy cleanup · active session" },
          ),
          message(
            "5.2b",
            "Remove clone DOM",
            "element.remove()",
            "source",
            "dom",
            "The default Vanilla callback removes the transient clone DOM.",
          ),
          message(
            "5.2c",
            "DOM call complete",
            "remove() returned",
            "dom",
            "source",
            "The synchronous DOM removal call has returned. Layout and paint may still be pending.",
            { kind: "return" },
          ),
        ],
      },
    ];
  }

  const phases = $derived(isVanilla ? vanillaPhases() : frameworkPhases());

  function focusable(node: HTMLElement): void {
    node.tabIndex = 0;
  }

  function laneIndex(lane: Lane): number {
    return laneOrder.indexOf(lane);
  }

  function routeStyle(route: DiagramMessage): string {
    const from = laneIndex(route.from);
    const to = laneIndex(route.to);
    const left = ((Math.min(from, to) + 0.5) / laneOrder.length) * 100;
    const width = (Math.abs(to - from) / laneOrder.length) * 100;
    return `--route-left:${left}%;--route-width:${width}%`;
  }

  function selfStyle(route: DiagramMessage): string {
    const left = ((laneIndex(route.from) + 0.5) / laneOrder.length) * 100;
    return `--route-left:${left}%`;
  }

  function routeDescription(route: DiagramMessage): string {
    const kind =
      route.kind === "sync"
        ? "Synchronous call"
        : route.kind === "async"
          ? "Asynchronous operation"
          : "Return";
    return `${route.step}, ${route.title}. ${kind} from ${route.from} to ${route.to}. ${route.detail}`;
  }
</script>

<figure class="lifecycle-diagram">
  <div
    class="scroll-region"
    role="region"
    use:focusable
    aria-label="Scrollable SnapSort session lifecycle UML sequence diagram"
  >
    <div
      class="sequence"
      role="group"
      aria-label="SnapSort lifecycle routing. The root-owned DragSession initiates target resolution, ghost relocation, commits, and cleanup. Callbacks execute on the receiver shown by each arrow. Ghosts are passive data."
    >
      <div class="participants" aria-hidden="true">
        <div class="participant card shallow">Dragged item</div>
        <div class="participant card shallow">Ghost</div>
        <div class="participant card shallow">Root / DragSession</div>
        <div class="participant card shallow">Source / current owner</div>
        <div class="participant card shallow">
          Candidate / target / destination
        </div>
        <div class="participant card shallow">
          {isVanilla ? "Application / callbacks" : "Framework state"}
        </div>
        <div class="participant card shallow">DOM</div>
      </div>

      <div class="diagram-body">
        {#each laneOrder as lane, index}
          <div
            class="lifeline"
            style={`left:${((index + 0.5) / laneOrder.length) * 100}%`}
            aria-hidden="true"
          ></div>
        {/each}

        {#each phases as phase}
          <section class="phase" data-phase={phase.id} aria-label={phase.title}>
            <div class="phase-heading">
              <span>{phase.title}</span>
              {#if phase.note}<small>{phase.note}</small>{/if}
            </div>

            {#each phase.messages as route}
              <div
                class:has-branch={route.branch}
                class:is-short={route.rowKind === "short"}
                class:is-loop={route.rowKind === "loop" || route.from === route.to}
                class="message-row"
                data-step={route.step}
                data-from={route.from}
                data-to={route.to}
                data-kind={route.kind}
              >
                {#if route.branch}
                  <span class="branch-label" aria-hidden="true">{route.branch}</span>
                {/if}

                {#if route.from === route.to}
                  <div
                    class="self-message"
                    class:is-return={route.kind === "return"}
                    style={selfStyle(route)}
                    role="img"
                    use:focusable
                    aria-label={routeDescription(route)}
                  >
                    <div class="message-label">
                      <strong><span class="step-number">{route.step}</span>{route.title}</strong>
                      {#if route.code}<code>{route.code}</code>{/if}
                      <span class="detail">{route.detail}</span>
                    </div>
                    <svg class="self-route" viewBox="0 0 120 44" preserveAspectRatio="none" aria-hidden="true">
                      <path
                        d="M 0 5 H 92 Q 108 5 108 15 V 20 Q 108 30 92 30 H 0"
                        class:return-line={route.kind === "return"}
                        class="uml-line"
                      ></path>
                    </svg>
                    <svg class="self-head-svg" viewBox="0 0 12 12" aria-hidden="true">
                      {#if route.kind === "sync"}
                        <path d="M 11 1 L 1 6 L 11 11 Z" class="filled-head"></path>
                      {:else if route.kind === "async"}
                        <path d="M 11 1 L 1 6 L 11 11 Z" class="open-head"></path>
                      {:else}
                        <path d="M 11 1 L 1 6 L 11 11" class="return-head"></path>
                      {/if}
                    </svg>
                  </div>
                {:else}
                  {@const reverse = laneIndex(route.from) > laneIndex(route.to)}
                  <div
                    class="message"
                    class:is-reverse={reverse}
                    style={routeStyle(route)}
                    role="img"
                    use:focusable
                    aria-label={routeDescription(route)}
                  >
                    <div class="message-label">
                      <strong><span class="step-number">{route.step}</span>{route.title}</strong>
                      {#if route.code}<code>{route.code}</code>{/if}
                      <span class="detail">{route.detail}</span>
                    </div>
                    <svg class="route-svg" viewBox="0 0 100 20" preserveAspectRatio="none" aria-hidden="true">
                      <line
                        x1={reverse ? "100" : "0"}
                        y1="10"
                        x2={reverse ? "0" : "100"}
                        y2="10"
                        class:return-line={route.kind === "return"}
                        class="uml-line"
                      ></line>
                    </svg>
                    <svg
                      class:is-at-start={reverse}
                      class="route-head-svg"
                      viewBox="0 0 12 12"
                      aria-hidden="true"
                    >
                      {#if route.kind === "sync"}
                        <path
                          d={reverse ? "M 11 1 L 1 6 L 11 11 Z" : "M 1 1 L 11 6 L 1 11 Z"}
                          class="filled-head"
                        ></path>
                      {:else if route.kind === "async"}
                        <path
                          d={reverse ? "M 11 1 L 1 6 L 11 11 Z" : "M 1 1 L 11 6 L 1 11 Z"}
                          class="open-head"
                        ></path>
                      {:else}
                        <path
                          d={reverse ? "M 11 1 L 1 6 L 11 11" : "M 1 1 L 11 6 L 1 11"}
                          class="return-head"
                        ></path>
                      {/if}
                    </svg>
                  </div>
                {/if}
              </div>
            {/each}
          </section>
        {/each}
      </div>
    </div>
  </div>

  <figcaption>
    {#if isVanilla}
      DOM call returns mean the synchronous DOM API completed; they do not mean
      layout or paint has completed.
    {:else}
      DOM commit returns mean the DOM tree and framework bindings are ready
      before paint; they do not mean layout or paint has completed.
    {/if}
    Dotted boxes group the five phases. Hover or focus a step for details.
  </figcaption>
</figure>

<style>
  .lifecycle-diagram {
    --diagram-ink: var(--color-background-dark);
    width: 100%;
    margin: var(--size-24) auto var(--size-32);
    border-radius: var(--ui-radius);
    background: var(--color-background-tint);
    box-sizing: border-box;
    user-select: none;
  }

  .scroll-region {
    width: 100%;
    padding: var(--size-16) var(--size-24) var(--size-24);
    overflow-x: auto;
    border-radius: inherit;
    box-sizing: border-box;
    overscroll-behavior-inline: contain;
    scrollbar-gutter: stable;
    scrollbar-color: var(--diagram-ink)
      color-mix(in srgb, var(--color-background-dark) 10%, transparent);
    touch-action: pan-x pan-y;
  }

  .scroll-region:focus-visible,
  .message:focus-visible,
  .self-message:focus-visible {
    outline: 2px solid var(--diagram-ink);
    outline-offset: 2px;
  }

  .sequence {
    width: max(70rem, 100%);
    min-width: 70rem;
    margin: 0 auto;
  }

  .participants {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
  }

  .participant {
    position: relative;
    z-index: 4;
    display: flex;
    align-items: center;
    justify-content: center;
    min-width: 0;
    height: 3.5rem;
    margin: 0 var(--size-4);
    padding: var(--size-8);
    color: var(--diagram-ink);
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.82rem;
    font-weight: 400;
    line-height: 1.12;
    text-align: center;
    box-sizing: border-box;
  }

  .diagram-body {
    position: relative;
    padding-top: var(--size-8);
  }

  .lifeline {
    position: absolute;
    top: 0;
    bottom: 0;
    z-index: 0;
    width: 1px;
    background: repeating-linear-gradient(
      to bottom,
      color-mix(in srgb, var(--color-background-dark) 30%, transparent) 0 5px,
      transparent 5px 10px
    );
    transform: translateX(-50%);
  }

  .phase {
    position: relative;
    z-index: 1;
    width: 100%;
    margin: 0 0 var(--size-8);
    padding: 2rem 0 0.4rem;
    border: 1px dotted
      color-mix(in srgb, var(--color-background-dark) 45%, transparent);
    border-radius: var(--size-12);
    box-sizing: border-box;
  }

  .phase-heading {
    position: absolute;
    top: 0.35rem;
    left: 0.45rem;
    z-index: 5;
    display: flex;
    align-items: center;
    gap: var(--size-8);
    color: var(--diagram-ink);
    font-family: "Geist Mono", monospace;
  }

  .phase-heading span,
  .branch-label {
    padding: 0.16rem 0.42rem;
    border-radius: 999px;
    background: color-mix(
      in srgb,
      var(--color-background-dark) 9%,
      var(--color-background-tint)
    );
    font-size: 0.66rem;
    font-weight: 650;
    letter-spacing: 0.035em;
    line-height: 1.2;
  }

  .phase-heading small {
    max-width: 38rem;
    color: color-mix(
      in srgb,
      var(--color-background-dark) 72%,
      transparent
    );
    font-size: 0.62rem;
    line-height: 1.3;
  }

  .message-row {
    position: relative;
    min-height: 2.75rem;
  }

  .message-row.is-short {
    min-height: 4.5rem;
  }

  .message-row.is-loop {
    min-height: 5rem;
  }

  .message-row.has-branch {
    min-height: 3.6rem;
    padding-top: 1.15rem;
    box-sizing: border-box;
  }

  .message-row.has-branch.is-short {
    min-height: 5.75rem;
  }

  .message-row.has-branch .message,
  .message-row.has-branch .self-message {
    top: 1.15rem;
    height: calc(100% - 1.15rem);
  }

  .branch-label {
    position: absolute;
    top: 0.1rem;
    left: 0.55rem;
    z-index: 4;
    color: color-mix(
      in srgb,
      var(--color-background-dark) 75%,
      transparent
    );
    font-size: 0.62rem;
  }

  .message {
    position: absolute;
    top: 0;
    left: var(--route-left);
    z-index: 2;
    width: var(--route-width);
    height: 100%;
    outline: none;
  }

  .route-svg {
    position: absolute;
    top: 50%;
    left: 0;
    width: 100%;
    height: 1.25rem;
    color: var(--diagram-ink);
    overflow: visible;
    transform: translateY(-50%);
  }

  .route-head-svg,
  .self-head-svg {
    position: absolute;
    z-index: 2;
    width: 0.75rem;
    height: 0.75rem;
    color: var(--diagram-ink);
    overflow: visible;
  }

  .route-head-svg {
    top: 50%;
    right: -1px;
    transform: translateY(-50%);
  }

  .route-head-svg.is-at-start {
    right: auto;
    left: -1px;
  }

  .message > .message-label {
    top: 0.1rem;
    max-width: calc(100% + 4rem);
    transform: translateX(-50%);
  }

  .message > .route-svg,
  .message > .route-head-svg {
    top: calc(100% - 0.45rem);
  }

  .message-row:not(.is-short) .message-label strong,
  .message-row:not(.is-short) .message-label code {
    white-space: nowrap;
  }

  .uml-line {
    fill: none;
    stroke: currentColor;
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }

  .return-line {
    stroke-dasharray: 2 3;
    stroke-linecap: round;
  }

  .filled-head {
    fill: currentColor;
    stroke: currentColor;
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }

  .open-head {
    fill: var(--color-background-tint);
    stroke: currentColor;
    stroke-linejoin: round;
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }

  .return-head {
    fill: none;
    stroke: currentColor;
    stroke-linecap: round;
    stroke-linejoin: round;
    stroke-width: 1.5;
    vector-effect: non-scaling-stroke;
  }

  .message-label,
  .self-message .message-label {
    position: absolute;
    top: 50%;
    left: 50%;
    z-index: 3;
    display: flex;
    align-items: center;
    gap: var(--size-4);
    width: max-content;
    max-width: calc(100% - 2rem);
    padding: 0.1rem var(--size-4);
    border-radius: var(--size-4);
    background: var(--color-background-tint);
    color: var(--diagram-ink);
    text-align: center;
    transform: translate(-50%, -50%);
  }

  .message-label strong {
    display: inline-flex;
    align-items: center;
    gap: 0.2rem;
    color: var(--diagram-ink);
    font-family: "Bitcount Grid Single", monospace;
    font-size: 0.78rem;
    font-weight: 500;
    line-height: 1.2;
  }

  .message-label code {
    color: color-mix(
      in srgb,
      var(--color-background-dark) 82%,
      transparent
    );
    font-family: "Geist Mono", monospace;
    font-size: 0.64rem;
    line-height: 1.25;
    white-space: normal;
  }

  .step-number {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    justify-content: center;
    min-width: 1.85rem;
    height: 1.25rem;
    padding: 0 0.28rem;
    border-radius: 999px;
    background: var(--color-primary);
    color: var(--color-background);
    font-family: "Geist Mono", monospace;
    font-size: 0.62rem;
    line-height: 1;
    box-sizing: border-box;
  }

  .detail {
    position: absolute;
    top: calc(100% + 0.25rem);
    left: 50%;
    display: none;
    width: min(22rem, calc(100% + 10rem));
    padding: var(--size-8) var(--size-12);
    border: 1px solid
      color-mix(in srgb, var(--color-background-dark) 30%, transparent);
    border-radius: var(--size-8);
    background: var(--color-background);
    box-shadow: 0 10px 30px
      color-mix(in srgb, var(--color-background-dark) 16%, transparent);
    color: var(--diagram-ink);
    font-family: "Geist Mono", monospace;
    font-size: 0.68rem;
    line-height: 1.45;
    text-align: left;
    transform: translateX(-50%);
  }

  .message:hover,
  .message:focus-visible,
  .self-message:hover,
  .self-message:focus-visible {
    z-index: 20;
  }

  .message:hover .detail,
  .message:focus-visible .detail,
  .self-message:hover .detail,
  .self-message:focus-visible .detail {
    display: block;
  }

  .message-row.is-short .message-label {
    top: 0.1rem;
    flex-direction: column;
    gap: 0.05rem;
    width: min(11rem, calc(100% + 2rem));
    transform: translateX(-50%);
  }

  .message-row.is-short .route-svg {
    top: calc(100% - 0.45rem);
  }

  .message-row.is-short .detail {
    top: calc(100% + 0.35rem);
  }

  .self-message {
    position: absolute;
    top: 0;
    left: var(--route-left);
    z-index: 2;
    width: calc(100% / 7);
    height: 100%;
    outline: none;
  }

  .self-route {
    position: absolute;
    top: 1.8rem;
    right: 0;
    left: 0;
    width: 100%;
    height: 2.5rem;
    color: var(--diagram-ink);
    overflow: visible;
  }

  .self-message .message-label {
    top: 0;
    left: 50%;
    flex-direction: column;
    gap: 0;
    width: min(9rem, calc(100% - 0.5rem));
    transform: translateX(-50%);
  }

  .self-message .detail {
    top: calc(100% + 0.35rem);
  }

  .self-head-svg {
    top: 3.15rem;
    left: -0.1rem;
  }

  figcaption {
    max-width: 38rem;
    margin: 0 auto;
    padding: 0 var(--size-24) var(--size-24);
    color: color-mix(
      in srgb,
      var(--color-background-dark) 72%,
      transparent
    );
    font-size: 0.8rem;
    line-height: 1.5;
    user-select: text;
  }

  @media (max-width: 480px) {
    .scroll-region {
      padding-inline: var(--size-8);
    }

    figcaption {
      padding-inline: var(--size-16);
    }
  }
</style>
