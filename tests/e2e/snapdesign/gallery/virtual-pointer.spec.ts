import { expect, test, type Page } from "@playwright/test";
import { coreImportPath } from "../../shared/servers";

const INITIAL_ORDER = "todo-promo,todo-accessibility,todo-ssr,todo-publish";
const FINAL_ORDER = "todo-accessibility,todo-ssr,todo-publish,todo-promo";
const VIRTUAL_POINTER_ID = 2_000_000_001;
const NESTED_VIRTUAL_POINTER_ID = 2_000_000_002;
const NESTED_INITIAL_ROOT_ORDER = "inbox,planning,archive";
const NESTED_INITIAL_CHILD_ORDER = "research,wireframes,review";
const NESTED_FINAL_ROOT_ORDER = "review,archive,planning";
const NESTED_FINAL_CHILD_ORDER = "inbox,research,wireframes";

type PointerTraceEvent = {
  type: string;
  pointerId: number | null;
  pointerType: string | null;
  isPrimary: boolean | null;
  isTrusted: boolean;
  button: number;
  buttons: number;
  clientX: number;
  clientY: number;
  cursorX: number | null;
  cursorY: number | null;
  cursorLeft: number | null;
  cursorTop: number | null;
  cursorState: string | null;
  targetKind: "toggle" | "grip" | "list" | "other";
  itemId: string | null;
  timestamp: number;
};

type GalleryFrame = {
  timestamp: number;
  phase: string | null;
  active: string | null;
  order: string | null;
  completed: string | null;
  targetIndex: string | null;
  dropIndex: string | null;
  cursorState: string | null;
  ghostCount: number;
  sessionStatus: string | null;
  sessionPointerId: number | null;
};

type ViewportRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type ScrollGeometry = {
  scrollX: number;
  scrollY: number;
  demo: ViewportRect;
  cursor: ViewportRect;
};

type InViewScrollSample = {
  before: ScrollGeometry;
  after: ScrollGeometry;
  eventCount: number;
};

type GalleryTrace = {
  events: PointerTraceEvent[];
  frames: GalleryFrame[];
  ghostObserved: boolean;
  ghostEntryTypes: string[];
  dragSessionObserved: boolean;
  inViewScroll: InViewScrollSample | null;
  moveItemCalls: number;
};

function recordPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  return errors;
}

async function openPausedGallery(page: Page) {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const demo = page.locator(".todo-demo");
  await demo.scrollIntoViewIfNeeded();
  await expect(demo).toHaveAttribute("data-todo-phase", "reduced");
  await expect(demo).toHaveAttribute("data-todo-autoplay-active", "false");
  return demo;
}

async function installGalleryTrace(
  page: Page,
  options: {
    interruptOnActiveDrag?: boolean;
    scrollDuringActiveDrag?: boolean;
  } = {},
): Promise<void> {
  await page.evaluate(
    async ({
      coreImportPath,
      interruptOnActiveDrag,
      scrollDuringActiveDrag,
      virtualPointerId,
    }) => {
      const { GlobalManager } = await import(coreImportPath);
      const demo = document.querySelector<HTMLElement>(".todo-demo");
      const list = demo?.querySelector<HTMLElement>('[data-demo="todo-list"]');
      const cursor = demo?.querySelector<HTMLElement>("[data-virtual-pointer]");
      const promo = demo?.querySelector<HTMLElement>(
        '[data-todo-id="todo-promo"]',
      );
      if (!demo || !list || !cursor || !promo) {
        throw new Error("Todo Gallery trace targets are missing.");
      }

      const containers =
        GlobalManager.getInstance().data.dragAndDropContainers ?? [];
      const container = containers.find(
        (candidate: any) => candidate.element === list,
      );
      if (!container) {
        throw new Error("Todo Gallery SnapSort container is missing.");
      }

      const trace = {
        events: [],
        frames: [],
        ghostObserved: false,
        ghostEntryTypes: [],
        dragSessionObserved: false,
        inViewScroll: null,
        moveItemCalls: 0,
        lastFrameSignature: "",
        interruptionRequested: false,
        inViewScrollRequested: false,
      } as GalleryTrace & {
        interruptionRequested: boolean;
        inViewScrollRequested: boolean;
        lastFrameSignature: string;
      };

      const addUnique = (values: string[], value: string | undefined) => {
        if (value && !values.includes(value)) values.push(value);
      };

      const observeGhosts = (root: ParentNode = demo) => {
        const entries = [
          ...(root instanceof Element &&
          root.matches("[data-snapsort-ghost-entry]")
            ? [root]
            : []),
          ...root.querySelectorAll<HTMLElement>("[data-snapsort-ghost-entry]"),
        ] as HTMLElement[];
        if (entries.length > 0) trace.ghostObserved = true;
        for (const entry of entries) {
          addUnique(trace.ghostEntryTypes, entry.dataset.snapsortGhostEntry);
        }
      };

      const readViewportRect = (element: Element): ViewportRect => {
        const rect = element.getBoundingClientRect();
        return {
          left: rect.left,
          top: rect.top,
          right: rect.right,
          bottom: rect.bottom,
          width: rect.width,
          height: rect.height,
        };
      };

      const readScrollGeometry = (): ScrollGeometry => ({
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        demo: readViewportRect(demo),
        cursor: readViewportRect(cursor),
      });

      const captureInViewScroll = () => {
        trace.inViewScrollRequested = true;
        const before = readScrollGeometry();
        const maxScrollY = Math.max(
          0,
          document.documentElement.scrollHeight - window.innerHeight,
        );
        const forwardTarget = Math.min(before.scrollY + 48, maxScrollY);
        const targetScrollY =
          forwardTarget !== before.scrollY
            ? forwardTarget
            : Math.max(0, before.scrollY - 48);
        const previousScrollBehavior =
          document.documentElement.style.scrollBehavior;
        document.documentElement.style.scrollBehavior = "auto";
        window.scrollTo(before.scrollX, targetScrollY);
        const after = readScrollGeometry();
        document.documentElement.style.scrollBehavior = previousScrollBehavior;
        trace.inViewScroll = {
          before,
          after,
          eventCount: trace.events.length,
        };
      };

      const recordFrame = (timestamp: number) => {
        observeGhosts();
        const session = container.dragSession;
        if (session?.status === "active") trace.dragSessionObserved = true;
        if (
          scrollDuringActiveDrag &&
          session?.status === "active" &&
          !trace.inViewScrollRequested
        ) {
          captureInViewScroll();
        }
        if (
          interruptOnActiveDrag &&
          session?.status === "active" &&
          !trace.interruptionRequested
        ) {
          trace.interruptionRequested = true;
          window.scrollTo(0, document.documentElement.scrollHeight);
        }
        const frame: GalleryFrame = {
          timestamp,
          phase: demo.dataset.todoPhase ?? null,
          active: demo.dataset.todoAutoplayActive ?? null,
          order: list.dataset.todoOrder ?? null,
          completed: promo.dataset.completed ?? null,
          targetIndex: demo.dataset.todoTargetIndex ?? null,
          dropIndex: demo.dataset.todoDropIndex ?? null,
          cursorState: cursor.dataset.virtualPointerState ?? null,
          ghostCount: demo.querySelectorAll("[data-snapsort-ghost-entry]")
            .length,
          sessionStatus: session?.status ?? null,
          sessionPointerId: session?.pointerId ?? null,
        };
        const signature = JSON.stringify({ ...frame, timestamp: 0 });
        if (signature !== trace.lastFrameSignature) {
          trace.lastFrameSignature = signature;
          trace.frames.push(frame);
        }
      };

      const recordEvent = (event: Event) => {
        if (!(event instanceof MouseEvent) || event.isTrusted) return;
        const isPointerEvent = event instanceof PointerEvent;
        if (isPointerEvent && event.pointerId !== virtualPointerId) return;
        if (
          !isPointerEvent &&
          event.type !== "mousedown" &&
          event.type !== "mouseup" &&
          event.type !== "click"
        ) {
          return;
        }

        const target = event.target instanceof Element ? event.target : null;
        if (!isPointerEvent && !target?.closest(".todo-demo")) return;
        const rect = cursor.getBoundingClientRect();
        const cursorX = Number(cursor.dataset.virtualPointerX);
        const cursorY = Number(cursor.dataset.virtualPointerY);
        const targetKind = target?.closest(".todo-toggle")
          ? "toggle"
          : target?.closest(".grip")
            ? "grip"
            : target?.closest('[data-demo="todo-list"]')
              ? "list"
              : "other";

        trace.events.push({
          type: event.type,
          pointerId: isPointerEvent ? event.pointerId : null,
          pointerType: isPointerEvent ? event.pointerType : null,
          isPrimary: isPointerEvent ? event.isPrimary : null,
          isTrusted: event.isTrusted,
          button: event.button,
          buttons: event.buttons,
          clientX: event.clientX,
          clientY: event.clientY,
          cursorX: Number.isFinite(cursorX) ? cursorX : null,
          cursorY: Number.isFinite(cursorY) ? cursorY : null,
          cursorLeft: Number.isFinite(rect.left) ? rect.left : null,
          cursorTop: Number.isFinite(rect.top) ? rect.top : null,
          cursorState: cursor.dataset.virtualPointerState ?? null,
          targetKind,
          itemId:
            target?.closest<HTMLElement>("[data-todo-id]")?.dataset.todoId ??
            null,
          timestamp: event.timeStamp,
        });
      };

      for (const type of [
        "pointerdown",
        "mousedown",
        "pointermove",
        "pointerup",
        "mouseup",
        "pointercancel",
        "click",
      ]) {
        document.addEventListener(type, recordEvent, { capture: true });
      }

      const observer = new MutationObserver((records) => {
        for (const record of records) {
          for (const node of record.addedNodes) {
            if (node instanceof Element) observeGhosts(node);
          }
        }
        recordFrame(performance.now());
      });
      observer.observe(demo, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: [
          "data-completed",
          "data-snapsort-ghost",
          "data-snapsort-ghost-entry",
          "data-todo-autoplay-active",
          "data-todo-drop-index",
          "data-todo-order",
          "data-todo-phase",
          "data-todo-target-index",
          "data-virtual-pointer-state",
        ],
      });

      container.engine.frameController.subscribe(({ timestamp }: any) => {
        recordFrame(timestamp);
      });
      recordFrame(performance.now());

      if (typeof container.moveItem !== "function") {
        throw new Error("Todo Gallery container has no moveItem API.");
      }
      container.moveItem = (..._args: unknown[]) => {
        trace.moveItemCalls += 1;
        throw new Error("Todo Gallery automation called moveItem().");
      };

      (
        globalThis as typeof globalThis & {
          __snapdesignVirtualPointerTrace?: GalleryTrace;
        }
      ).__snapdesignVirtualPointerTrace = trace;
    },
    {
      coreImportPath,
      interruptOnActiveDrag: options.interruptOnActiveDrag ?? false,
      scrollDuringActiveDrag: options.scrollDuringActiveDrag ?? false,
      virtualPointerId: VIRTUAL_POINTER_ID,
    },
  );
}

async function readGalleryTrace(page: Page): Promise<GalleryTrace> {
  return page.evaluate(() => {
    const trace = (
      globalThis as typeof globalThis & {
        __snapdesignVirtualPointerTrace?: GalleryTrace;
      }
    ).__snapdesignVirtualPointerTrace;
    if (!trace) throw new Error("Todo Gallery trace was not installed.");
    return {
      events: trace.events,
      frames: trace.frames,
      ghostObserved: trace.ghostObserved,
      ghostEntryTypes: trace.ghostEntryTypes,
      dragSessionObserved: trace.dragSessionObserved,
      inViewScroll: trace.inViewScroll,
      moveItemCalls: trace.moveItemCalls,
    };
  });
}

function frameAfter(
  frames: GalleryFrame[],
  start: number,
  predicate: (frame: GalleryFrame) => boolean,
): number {
  return frames.findIndex((frame, index) => index > start && predicate(frame));
}

test("drives the Todo reel through synthetic pointer events and a real SnapSort drop", async ({
  page,
}) => {
  const pageErrors = recordPageErrors(page);
  const demo = await openPausedGallery(page);
  await installGalleryTrace(page);

  await page.emulateMedia({ reducedMotion: "no-preference" });

  await expect
    .poll(
      async () => {
        const trace = await readGalleryTrace(page);
        const movedIndex = trace.frames.findIndex(
          (frame) => frame.phase === "moved" && frame.order === FINAL_ORDER,
        );
        const resetIndex = frameAfter(
          trace.frames,
          movedIndex,
          (frame) =>
            frame.order === INITIAL_ORDER &&
            frame.completed === "false" &&
            frame.cursorState === "hidden" &&
            frame.ghostCount === 0 &&
            frame.sessionStatus === null,
        );
        const secondMovedIndex = frameAfter(
          trace.frames,
          resetIndex,
          (frame) =>
            frame.phase === "moved" &&
            frame.order === FINAL_ORDER &&
            frame.dropIndex === "3",
        );
        return (
          movedIndex >= 0 &&
          resetIndex > movedIndex &&
          secondMovedIndex > resetIndex
        );
      },
      { timeout: 15_000 },
    )
    .toBe(true);

  const trace = await readGalleryTrace(page);
  expect(trace.moveItemCalls).toBe(0);
  expect(trace.ghostObserved).toBe(true);
  expect(trace.ghostEntryTypes.length).toBeGreaterThan(0);
  expect(trace.dragSessionObserved).toBe(true);
  expect(
    trace.frames.some(
      (frame) =>
        frame.sessionStatus === "active" &&
        frame.sessionPointerId === VIRTUAL_POINTER_ID,
    ),
  ).toBe(true);
  expect(trace.frames.some((frame) => frame.targetIndex === "3")).toBe(true);
  expect(trace.frames.some((frame) => frame.dropIndex === "3")).toBe(true);

  const toggleDownIndex = trace.events.findIndex(
    (event) => event.type === "pointerdown" && event.targetKind === "toggle",
  );
  const toggleMouseDownIndex = trace.events.findIndex(
    (event, index) =>
      index > toggleDownIndex &&
      event.type === "mousedown" &&
      event.targetKind === "toggle",
  );
  const toggleUpIndex = trace.events.findIndex(
    (event, index) =>
      index > toggleMouseDownIndex &&
      event.type === "pointerup" &&
      event.targetKind === "toggle",
  );
  const toggleMouseUpIndex = trace.events.findIndex(
    (event, index) =>
      index > toggleUpIndex &&
      event.type === "mouseup" &&
      event.targetKind === "toggle",
  );
  const clickIndex = trace.events.findIndex(
    (event, index) =>
      index > toggleMouseUpIndex &&
      event.type === "click" &&
      event.targetKind === "toggle",
  );
  const gripDownIndex = trace.events.findIndex(
    (event, index) =>
      index > clickIndex &&
      event.type === "pointerdown" &&
      event.targetKind === "grip" &&
      event.itemId === "todo-promo",
  );
  const gripUpIndex = trace.events.findIndex(
    (event, index) =>
      index > gripDownIndex &&
      event.type === "pointerup" &&
      event.targetKind === "grip",
  );

  expect(toggleDownIndex).toBeGreaterThanOrEqual(0);
  expect(toggleMouseDownIndex).toBeGreaterThan(toggleDownIndex);
  expect(toggleUpIndex).toBeGreaterThan(toggleMouseDownIndex);
  expect(toggleMouseUpIndex).toBeGreaterThan(toggleUpIndex);
  expect(clickIndex).toBeGreaterThan(toggleMouseUpIndex);
  expect(gripDownIndex).toBeGreaterThan(clickIndex);
  expect(gripUpIndex).toBeGreaterThan(gripDownIndex);
  expect(trace.events[toggleDownIndex]).toMatchObject({
    button: 0,
    buttons: 1,
    cursorState: "pressed",
  });
  expect(trace.events[toggleUpIndex]).toMatchObject({
    button: 0,
    buttons: 0,
  });
  expect(trace.events[toggleMouseDownIndex]).toMatchObject({
    button: 0,
    buttons: 1,
    cursorState: "pressed",
  });
  expect(trace.events[toggleMouseUpIndex]).toMatchObject({
    button: 0,
    buttons: 0,
  });
  expect(trace.events[gripDownIndex]).toMatchObject({
    button: 0,
    buttons: 1,
    cursorState: "pressed",
  });
  expect(trace.events[gripUpIndex]).toMatchObject({
    button: 0,
    buttons: 0,
  });

  const dragMoves = trace.events
    .slice(gripDownIndex + 1, gripUpIndex)
    .filter((event) => event.type === "pointermove" && event.buttons === 1);
  expect(dragMoves.length).toBeGreaterThan(5);
  expect(trace.events.some((event) => event.type === "pointercancel")).toBe(
    false,
  );

  for (const [index, event] of trace.events.entries()) {
    expect(event.isTrusted).toBe(false);
    if (event.type.startsWith("pointer")) {
      expect(event.pointerId).toBe(VIRTUAL_POINTER_ID);
      expect(event.pointerType).toBe("mouse");
      expect(event.isPrimary).toBe(true);
    } else {
      expect(event.pointerId).toBeNull();
      expect(event.pointerType).toBeNull();
      expect(event.isPrimary).toBeNull();
    }
    expect(event.cursorX).not.toBeNull();
    expect(event.cursorY).not.toBeNull();
    expect(event.cursorLeft).not.toBeNull();
    expect(event.cursorTop).not.toBeNull();
    // Chromium exposes constructed MouseEvent coordinates as integer CSS
    // pixels even though the cursor transform retains sub-pixel precision.
    expect(Math.abs(event.clientX - event.cursorX!)).toBeLessThanOrEqual(1.1);
    expect(Math.abs(event.clientY - event.cursorY!)).toBeLessThanOrEqual(1.1);
    expect(Math.abs(event.clientX - event.cursorLeft!)).toBeLessThanOrEqual(
      1.1,
    );
    expect(Math.abs(event.clientY - event.cursorTop!)).toBeLessThanOrEqual(1.1);
    if (index > 0) {
      expect(event.timestamp).toBeGreaterThanOrEqual(
        trace.events[index - 1].timestamp,
      );
    }
  }

  await expect(demo).toHaveAttribute("data-todo-autoplay-active", "true");
  expect(pageErrors).toEqual([]);
});

test("keeps the active virtual drag anchored to the demo during an in-view scroll", async ({
  page,
}) => {
  const pageErrors = recordPageErrors(page);
  const demo = await openPausedGallery(page);
  await installGalleryTrace(page, { scrollDuringActiveDrag: true });
  await page.emulateMedia({ reducedMotion: "no-preference" });

  await expect
    .poll(
      async () => {
        const trace = await readGalleryTrace(page);
        return (
          trace.inViewScroll !== null &&
          trace.frames.some(
            (frame) =>
              frame.phase === "moved" &&
              frame.order === FINAL_ORDER &&
              frame.dropIndex === "3",
          )
        );
      },
      { timeout: 8_000 },
    )
    .toBe(true);

  const trace = await readGalleryTrace(page);
  const sample = trace.inViewScroll;
  expect(sample).not.toBeNull();
  if (!sample) throw new Error("The in-view scroll sample was not recorded.");

  const scrollDeltaX = sample.after.scrollX - sample.before.scrollX;
  const scrollDeltaY = sample.after.scrollY - sample.before.scrollY;
  const demoDeltaX = sample.after.demo.left - sample.before.demo.left;
  const demoDeltaY = sample.after.demo.top - sample.before.demo.top;
  const cursorDeltaX = sample.after.cursor.left - sample.before.cursor.left;
  const cursorDeltaY = sample.after.cursor.top - sample.before.cursor.top;
  const beforeLocalX = sample.before.cursor.left - sample.before.demo.left;
  const beforeLocalY = sample.before.cursor.top - sample.before.demo.top;
  const afterLocalX = sample.after.cursor.left - sample.after.demo.left;
  const afterLocalY = sample.after.cursor.top - sample.after.demo.top;

  expect(Math.abs(scrollDeltaY)).toBeGreaterThanOrEqual(40);
  expect(Math.abs(demoDeltaX + scrollDeltaX)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(demoDeltaY + scrollDeltaY)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(cursorDeltaX - demoDeltaX)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(cursorDeltaY - demoDeltaY)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(afterLocalX - beforeLocalX)).toBeLessThanOrEqual(0.5);
  expect(Math.abs(afterLocalY - beforeLocalY)).toBeLessThanOrEqual(0.5);

  expect(trace.moveItemCalls).toBe(0);
  expect(trace.ghostObserved).toBe(true);
  expect(trace.dragSessionObserved).toBe(true);
  expect(trace.frames.some((frame) => frame.targetIndex === "3")).toBe(true);
  expect(trace.frames.some((frame) => frame.dropIndex === "3")).toBe(true);
  expect(trace.events.some((event) => event.type === "pointercancel")).toBe(
    false,
  );
  const firstPostScrollMove = trace.events
    .slice(sample.eventCount)
    .find((event) => event.type === "pointermove");
  expect(firstPostScrollMove).toBeDefined();
  expect(
    Math.abs(firstPostScrollMove!.clientX - firstPostScrollMove!.cursorX!),
  ).toBeLessThanOrEqual(1.1);
  expect(
    Math.abs(firstPostScrollMove!.clientY - firstPostScrollMove!.cursorY!),
  ).toBeLessThanOrEqual(1.1);
  expect(
    Math.abs(firstPostScrollMove!.clientX - firstPostScrollMove!.cursorLeft!),
  ).toBeLessThanOrEqual(1.1);
  expect(
    Math.abs(firstPostScrollMove!.clientY - firstPostScrollMove!.cursorTop!),
  ).toBeLessThanOrEqual(1.1);
  await expect(demo).toHaveAttribute("data-todo-autoplay-active", "true");
  expect(pageErrors).toEqual([]);
});

test("keeps autoplay active when a virtual drag leaves the viewport", async ({
  page,
}) => {
  const pageErrors = recordPageErrors(page);
  const demo = await openPausedGallery(page);
  await installGalleryTrace(page, { interruptOnActiveDrag: true });
  await page.emulateMedia({ reducedMotion: "no-preference" });

  await expect
    .poll(async () => (await readGalleryTrace(page)).dragSessionObserved, {
      timeout: 7_000,
    })
    .toBe(true);

  await expect(demo).toHaveAttribute("data-todo-autoplay-active", "true");
  await expect(demo.locator('[data-demo="todo-list"]')).toHaveAttribute(
    "data-todo-order",
    FINAL_ORDER,
    { timeout: 15_000 },
  );
  await expect(demo.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);

  const trace = await readGalleryTrace(page);
  const cancel = trace.events.find((event) => event.type === "pointercancel");
  expect(cancel).toBeUndefined();
  expect(trace.moveItemCalls).toBe(0);
  expect(trace.ghostObserved).toBe(true);
  expect(trace.dragSessionObserved).toBe(true);
  expect(pageErrors).toEqual([]);
});

test("keeps the virtual pointer reel static when reduced motion is requested", async ({
  page,
}) => {
  const pageErrors = recordPageErrors(page);
  const demo = await openPausedGallery(page);
  await installGalleryTrace(page);

  await page.waitForTimeout(750);

  await expect(demo).toHaveAttribute("data-todo-phase", "reduced");
  await expect(demo).toHaveAttribute("data-todo-autoplay-active", "false");
  await expect(page.locator('[data-demo="todo-list"]')).toHaveAttribute(
    "data-todo-order",
    INITIAL_ORDER,
  );
  await expect(page.locator('[data-todo-id="todo-promo"]')).toHaveAttribute(
    "data-completed",
    "true",
  );
  const cursor = demo.locator("[data-virtual-pointer]");
  await expect(cursor).toHaveAttribute("data-virtual-pointer-state", "hidden");
  await expect(cursor).toHaveCSS("display", "none");
  await expect(page.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);

  const trace = await readGalleryTrace(page);
  expect(trace.events).toEqual([]);
  expect(trace.ghostObserved).toBe(false);
  expect(trace.dragSessionObserved).toBe(false);
  expect(trace.moveItemCalls).toBe(0);
  expect(pageErrors).toEqual([]);
});

test("drives all three nested-container moves through real handle events", async ({
  page,
}) => {
  const pageErrors = recordPageErrors(page);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const demo = page.locator(".nested-demo");
  await demo.scrollIntoViewIfNeeded();
  await expect(demo).toHaveAttribute("data-nested-phase", "reduced");
  await expect(demo).toHaveAttribute("data-nested-autoplay-active", "false");
  await expect(demo.locator('[data-demo="nested-containers"]')).toHaveAttribute(
    "data-nested-root-order",
    NESTED_INITIAL_ROOT_ORDER,
  );
  await expect(demo.locator("[data-nested-child-order]")).toHaveAttribute(
    "data-nested-child-order",
    NESTED_INITIAL_CHILD_ORDER,
  );
  await expect(demo.locator(".snapsort-handle")).toHaveCount(6);
  await expect(demo.locator("[data-nested-container-handle]")).toHaveCount(1);
  await expect(
    demo.locator("[data-virtual-pointer] .virtual-pointer-image"),
  ).toHaveAttribute("src", /^data:image\/svg\+xml/);

  await page.evaluate(
    async ({ coreImportPath, pointerId }) => {
      const { GlobalManager } = await import(coreImportPath);
      const demo = document.querySelector<HTMLElement>(".nested-demo");
      const rootElement = demo?.querySelector<HTMLElement>(
        '[data-demo="nested-containers"]',
      );
      const childElement = demo?.querySelector<HTMLElement>(
        '[data-nested-container-id="planning"]',
      );
      const cursor = demo?.querySelector<HTMLElement>("[data-virtual-pointer]");
      if (!demo || !rootElement || !childElement || !cursor) {
        throw new Error("Nested Gallery trace targets are missing.");
      }

      const containers =
        GlobalManager.getInstance().data.dragAndDropContainers ?? [];
      const root = containers.find(
        (candidate: any) => candidate.element === rootElement,
      );
      const child = containers.find(
        (candidate: any) => candidate.element === childElement,
      );
      if (!root || !child) {
        throw new Error("Nested Gallery SnapSort containers are missing.");
      }

      type NestedEvent = {
        type: string;
        pointerId: number;
        itemId: string | null;
        handleKind: "item" | "container" | "other";
        buttons: number;
        isTrusted: boolean;
        clientX: number;
        clientY: number;
        cursorLeft: number;
        cursorTop: number;
      };
      type NestedFrame = {
        phase: string | null;
        rootOrder: string | null;
        childOrder: string | null;
        dropOwner: string | null;
        dropIndex: string | null;
        dropItem: string | null;
        ghostCount: number;
        sessionStatus: string | null;
        sessionPointerId: number | null;
        sessionItemId: string | null;
      };
      type NestedTrace = {
        events: NestedEvent[];
        frames: NestedFrame[];
        moveItemCalls: number;
        ghostObserved: boolean;
        childLocked: boolean;
        lastFrameSignature: string;
      };

      const trace: NestedTrace = {
        events: [],
        frames: [],
        moveItemCalls: 0,
        ghostObserved: false,
        childLocked: child.locked,
        lastFrameSignature: "",
      };

      const recordFrame = () => {
        const session = root.dragSession;
        const ghostCount = demo.querySelectorAll(
          "[data-snapsort-ghost-entry]",
        ).length;
        if (ghostCount > 0) trace.ghostObserved = true;
        const frame: NestedFrame = {
          phase: demo.dataset.nestedPhase ?? null,
          rootOrder: rootElement.dataset.nestedRootOrder ?? null,
          childOrder:
            demo.querySelector<HTMLElement>("[data-nested-child-order]")
              ?.dataset.nestedChildOrder ?? null,
          dropOwner: demo.dataset.nestedDropOwner ?? null,
          dropIndex: demo.dataset.nestedDropIndex ?? null,
          dropItem: demo.dataset.nestedDropItem ?? null,
          ghostCount,
          sessionStatus: session?.status ?? null,
          sessionPointerId: session?.pointerId ?? null,
          sessionItemId: session?.primaryItem.itemId ?? null,
        };
        const signature = JSON.stringify(frame);
        if (signature !== trace.lastFrameSignature) {
          trace.lastFrameSignature = signature;
          trace.frames.push(frame);
        }
      };

      const recordPointerEvent = (event: Event) => {
        if (!(event instanceof PointerEvent) || event.pointerId !== pointerId) {
          return;
        }
        const target = event.target instanceof Element ? event.target : null;
        const cursorRect = cursor.getBoundingClientRect();
        trace.events.push({
          type: event.type,
          pointerId: event.pointerId,
          itemId:
            target?.closest<HTMLElement>("[data-nested-item-id]")?.dataset
              .nestedItemId ??
            target?.closest<HTMLElement>("[data-nested-container-id]")?.dataset
              .nestedContainerId ??
            null,
          handleKind: target?.closest("[data-nested-container-handle]")
            ? "container"
            : target?.closest("[data-nested-item-handle]")
              ? "item"
              : "other",
          buttons: event.buttons,
          isTrusted: event.isTrusted,
          clientX: event.clientX,
          clientY: event.clientY,
          cursorLeft: cursorRect.left,
          cursorTop: cursorRect.top,
        });
      };

      for (const type of [
        "pointerdown",
        "pointermove",
        "pointerup",
        "pointercancel",
      ]) {
        document.addEventListener(type, recordPointerEvent, { capture: true });
      }

      const observer = new MutationObserver(recordFrame);
      observer.observe(demo, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: [
          "data-nested-child-order",
          "data-nested-drop-index",
          "data-nested-drop-item",
          "data-nested-drop-owner",
          "data-nested-phase",
          "data-nested-root-order",
          "data-snapsort-ghost-entry",
        ],
      });
      root.engine.frameController.subscribe(recordFrame);
      recordFrame();

      for (const container of [root, child]) {
        if (typeof container.moveItem !== "function") {
          throw new Error("Nested Gallery container has no moveItem API.");
        }
        container.moveItem = (..._args: unknown[]) => {
          trace.moveItemCalls += 1;
          throw new Error("Nested Gallery automation called moveItem().");
        };
      }

      (
        globalThis as typeof globalThis & {
          __snapdesignNestedPointerTrace?: NestedTrace;
        }
      ).__snapdesignNestedPointerTrace = trace;
    },
    { coreImportPath, pointerId: NESTED_VIRTUAL_POINTER_ID },
  );

  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect
    .poll(
      () =>
        page.evaluate(
          ({ finalRootOrder, finalChildOrder }) => {
            const trace = (
              globalThis as typeof globalThis & {
                __snapdesignNestedPointerTrace?: {
                  frames: Array<{
                    phase: string | null;
                    rootOrder: string | null;
                    childOrder: string | null;
                    dropOwner: string | null;
                    dropIndex: string | null;
                    dropItem: string | null;
                  }>;
                };
              }
            ).__snapdesignNestedPointerTrace;
            return Boolean(
              trace?.frames.some(
                (frame) =>
                  frame.phase === "complete" &&
                  frame.rootOrder === finalRootOrder &&
                  frame.childOrder === finalChildOrder &&
                  frame.dropOwner === "root" &&
                  frame.dropIndex === "2" &&
                  frame.dropItem === "planning",
              ),
            );
          },
          {
            finalRootOrder: NESTED_FINAL_ROOT_ORDER,
            finalChildOrder: NESTED_FINAL_CHILD_ORDER,
          },
        ),
      { timeout: 10_000 },
    )
    .toBe(true);

  const trace = await page.evaluate(() => {
    const trace = (
      globalThis as typeof globalThis & {
        __snapdesignNestedPointerTrace?: {
          events: Array<{
            type: string;
            pointerId: number;
            itemId: string | null;
            handleKind: "item" | "container" | "other";
            buttons: number;
            isTrusted: boolean;
            clientX: number;
            clientY: number;
            cursorLeft: number;
            cursorTop: number;
          }>;
          frames: Array<{
            phase: string | null;
            rootOrder: string | null;
            childOrder: string | null;
            dropOwner: string | null;
            dropIndex: string | null;
            dropItem: string | null;
            ghostCount: number;
            sessionStatus: string | null;
            sessionPointerId: number | null;
            sessionItemId: string | null;
          }>;
          moveItemCalls: number;
          ghostObserved: boolean;
          childLocked: boolean;
        };
      }
    ).__snapdesignNestedPointerTrace;
    if (!trace) throw new Error("Nested Gallery trace was not installed.");
    return trace;
  });

  expect(trace.moveItemCalls).toBe(0);
  expect(trace.ghostObserved).toBe(true);
  expect(trace.childLocked).toBe(false);
  expect(
    trace.frames.some(
      (frame) =>
        frame.phase === "inside" &&
        frame.rootOrder === "planning,archive" &&
        frame.childOrder === "inbox,research,wireframes,review" &&
        frame.dropOwner === "planning" &&
        frame.dropIndex === "0" &&
        frame.dropItem === "inbox",
    ),
  ).toBe(true);
  expect(
    trace.frames.some(
      (frame) =>
        frame.phase === "outside" &&
        frame.rootOrder === "planning,review,archive" &&
        frame.childOrder === NESTED_FINAL_CHILD_ORDER &&
        frame.dropOwner === "root" &&
        frame.dropIndex === "1" &&
        frame.dropItem === "review",
    ),
  ).toBe(true);

  for (const itemId of ["inbox", "review", "planning"]) {
    expect(
      trace.frames.some(
        (frame) =>
          frame.sessionStatus === "active" &&
          frame.sessionPointerId === NESTED_VIRTUAL_POINTER_ID &&
          frame.sessionItemId === itemId,
      ),
    ).toBe(true);
  }

  const pointerDowns = trace.events.filter(
    (event) => event.type === "pointerdown",
  );
  expect(pointerDowns.slice(0, 3)).toMatchObject([
    {
      pointerId: NESTED_VIRTUAL_POINTER_ID,
      itemId: "inbox",
      handleKind: "item",
      buttons: 1,
      isTrusted: false,
    },
    {
      pointerId: NESTED_VIRTUAL_POINTER_ID,
      itemId: "review",
      handleKind: "item",
      buttons: 1,
      isTrusted: false,
    },
    {
      pointerId: NESTED_VIRTUAL_POINTER_ID,
      itemId: "planning",
      handleKind: "container",
      buttons: 1,
      isTrusted: false,
    },
  ]);
  expect(trace.events.some((event) => event.type === "pointercancel")).toBe(
    false,
  );
  expect(trace.events.length).toBeGreaterThan(20);
  for (const event of trace.events) {
    expect(event.pointerId).toBe(NESTED_VIRTUAL_POINTER_ID);
    expect(event.isTrusted).toBe(false);
    expect(Math.abs(event.clientX - event.cursorLeft)).toBeLessThanOrEqual(1.1);
    expect(Math.abs(event.clientY - event.cursorTop)).toBeLessThanOrEqual(1.1);
  }

  const cursorBox = await demo.locator("[data-virtual-pointer]").boundingBox();
  expect(cursorBox?.width).toBe(32);
  expect(cursorBox?.height).toBe(32);
  expect(pageErrors).toEqual([]);
});
