import { expect, test, type Page } from "@playwright/test";

test("sideways playing cards flip accessibly and preserve drag reordering", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const exhibit = page.locator('[data-gallery="sideways-insert"]');
  await exhibit.scrollIntoViewIfNeeded();
  const demo = exhibit.locator(".sideways-demo");
  await expect(demo).toHaveAttribute("data-sideways-phase", "reduced");
  await expect(demo).toHaveAttribute("data-sideways-autoplay-active", "false");
  const cards = exhibit.locator(".sideways-list > .snapsort-item");

  await expect(cards).toHaveCount(4);
  const clubs = exhibit.getByRole("button", { name: /3 of clubs/ });
  const diamonds = exhibit.getByRole("button", { name: /5 of diamonds/ });
  await expect(clubs).toHaveCount(1);
  await expect(diamonds).toHaveCount(1);
  await expect(
    exhibit.getByRole("button", { name: /7 of hearts/ }),
  ).toHaveCount(1);
  await expect(
    exhibit.getByRole("button", { name: /9 of spades/ }),
  ).toHaveCount(1);

  await clubs.click();
  await expect(clubs).toHaveAttribute("aria-pressed", "true");
  await expect(clubs).toHaveAttribute("data-card-side", "back");
  await expect(
    clubs.locator(".card-back-label", { hasText: "SnapSort" }),
  ).toHaveCount(2);
  const cardBackFits = await clubs.evaluate((element) => {
    const frame = element.querySelector<HTMLElement>(".card-back-frame");
    const labels = element.querySelectorAll<HTMLElement>(".card-back-label");
    if (!frame || labels.length !== 2) return false;
    const frameRect = frame.getBoundingClientRect();
    return [...labels].every((label) => {
      const labelRect = label.getBoundingClientRect();
      return (
        labelRect.left >= frameRect.left && labelRect.right <= frameRect.right
      );
    });
  });
  expect(cardBackFits).toBe(true);

  await diamonds.focus();
  await page.keyboard.press("Enter");
  await expect(diamonds).toHaveAttribute("aria-pressed", "true");
  await page.keyboard.press("Space");
  await expect(diamonds).toHaveAttribute("aria-pressed", "false");

  const cardGeometry = await exhibit
    .locator(".playing-card")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        const pip = element.querySelector<HTMLElement>(".card-pip");
        return {
          ratio: rect.width / rect.height,
          maskImage: pip ? getComputedStyle(pip).maskImage : "none",
        };
      }),
    );
  for (const card of cardGeometry) {
    expect(card.ratio).toBeCloseTo(5 / 7, 2);
    expect(card.maskImage).not.toBe("none");
  }

  const firstBox = await cards.nth(0).boundingBox();
  const lastBox = await cards.nth(3).boundingBox();
  if (!firstBox || !lastBox)
    throw new Error("Playing-card geometry is missing");
  await page.mouse.move(
    firstBox.x + firstBox.width / 2,
    firstBox.y + firstBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    lastBox.x + lastBox.width + 12,
    lastBox.y + lastBox.height / 2,
    { steps: 16 },
  );
  const targetSpacer = exhibit.locator(
    '[data-snapsort-ghost-entry="target-spacer"]',
  );
  await expect(targetSpacer).toHaveCount(1);
  await expect(targetSpacer).toHaveCSS(
    "background-color",
    "rgb(211, 211, 210)",
  );
  await expect(targetSpacer).toHaveCSS("outline-style", "none");
  await page.mouse.up();

  await expect
    .poll(() =>
      exhibit
        .locator(".playing-card")
        .evaluateAll((elements) =>
          elements.map((element) => element.getAttribute("data-card-suit")),
        ),
    )
    .toEqual(["diamonds", "hearts", "spades", "clubs"]);
  await expect(clubs).toHaveAttribute("aria-pressed", "true");
  await expect(clubs).toHaveAttribute("data-card-side", "back");

  await clubs.click();
  await expect(clubs).toHaveAttribute("aria-pressed", "false");
  await expect(clubs).toHaveAttribute("data-card-side", "front");
  expect(pageErrors).toEqual([]);
});

type SidewaysFrame = {
  phase: string | null;
  cycle: string | null;
  order: string | null;
  revealId: string | null;
  dropItem: string | null;
  dropIndex: string | null;
  sides: Record<string, string | null>;
};

type SidewaysTrace = {
  frames: SidewaysFrame[];
  clickTargets: string[];
  activeDragItems: string[];
  ghostObserved: boolean;
  moveItemCalls: number;
};

async function installSidewaysTrace(page: Page) {
  const coreImportPath = `/@fs${process.cwd()}/src/index.ts`;
  await page.evaluate(
    async ({ coreImportPath }) => {
      const { GlobalManager } = await import(coreImportPath);
      const demo = document.querySelector<HTMLElement>(".sideways-demo");
      const list = demo?.querySelector<HTMLElement>(
        '[data-demo="sideways-insert"]',
      );
      if (!demo || !list) {
        throw new Error("Sideways Gallery trace targets are missing.");
      }

      const containers =
        GlobalManager.getInstance().data.dragAndDropContainers ?? [];
      const container = containers.find(
        (candidate: any) => candidate.element === list,
      );
      if (!container) {
        throw new Error("Sideways Gallery SnapSort container is missing.");
      }

      const trace = {
        frames: [],
        clickTargets: [],
        activeDragItems: [],
        ghostObserved: false,
        moveItemCalls: 0,
        lastFrameSignature: "",
        lastActiveDragItem: null,
      } as SidewaysTrace & {
        lastFrameSignature: string;
        lastActiveDragItem: string | null;
      };

      const captureFrame = () => {
        const session = container.dragSession;
        const activeItem =
          session?.status === "active"
            ? String(session.primaryItem.itemId)
            : null;
        if (activeItem !== trace.lastActiveDragItem) {
          trace.lastActiveDragItem = activeItem;
          if (activeItem) trace.activeDragItems.push(activeItem);
        }
        if (demo.querySelector("[data-snapsort-ghost-entry]")) {
          trace.ghostObserved = true;
        }

        const sides = Object.fromEntries(
          [
            ...demo.querySelectorAll<HTMLElement>("[data-sideways-card-id]"),
          ].map((item) => [
            item.dataset.sidewaysCardId ?? "",
            item.querySelector<HTMLElement>(".playing-card")?.dataset
              .cardSide ?? null,
          ]),
        );
        const frame: SidewaysFrame = {
          phase: demo.dataset.sidewaysPhase ?? null,
          cycle: demo.dataset.sidewaysCycle ?? null,
          order: list.dataset.sidewaysOrder ?? null,
          revealId: demo.dataset.sidewaysRevealId ?? null,
          dropItem: demo.dataset.sidewaysDropItem ?? null,
          dropIndex: demo.dataset.sidewaysDropIndex ?? null,
          sides,
        };
        const signature = JSON.stringify(frame);
        if (signature !== trace.lastFrameSignature) {
          trace.lastFrameSignature = signature;
          trace.frames.push(frame);
        }
      };

      document.addEventListener(
        "click",
        (event) => {
          if (
            !(event instanceof MouseEvent) ||
            event.isTrusted ||
            !(event.target instanceof Element)
          ) {
            return;
          }
          const card = event.target.closest<HTMLElement>(
            "[data-sideways-card-id]",
          );
          if (card) trace.clickTargets.push(card.dataset.sidewaysCardId ?? "");
        },
        { capture: true },
      );

      const observer = new MutationObserver(captureFrame);
      observer.observe(demo, {
        attributes: true,
        childList: true,
        subtree: true,
        attributeFilter: [
          "data-card-side",
          "data-sideways-cycle",
          "data-sideways-drop-index",
          "data-sideways-drop-item",
          "data-sideways-order",
          "data-sideways-phase",
          "data-sideways-reveal-id",
          "data-snapsort-ghost-entry",
        ],
      });
      container.engine.frameController.subscribe(captureFrame);
      captureFrame();

      if (typeof container.moveItem !== "function") {
        throw new Error("Sideways Gallery container has no moveItem API.");
      }
      container.moveItem = (..._args: unknown[]) => {
        trace.moveItemCalls += 1;
        throw new Error("Sideways Gallery automation called moveItem().");
      };

      (
        globalThis as typeof globalThis & {
          __sidewaysTrace?: SidewaysTrace;
        }
      ).__sidewaysTrace = trace;
    },
    { coreImportPath },
  );
}

async function readSidewaysTrace(page: Page): Promise<SidewaysTrace> {
  return page.evaluate(() => {
    const trace = (
      globalThis as typeof globalThis & {
        __sidewaysTrace?: SidewaysTrace;
      }
    ).__sidewaysTrace;
    if (!trace) throw new Error("Sideways Gallery trace was not installed.");
    return {
      frames: trace.frames,
      clickTargets: trace.clickTargets,
      activeDragItems: trace.activeDragItems,
      ghostObserved: trace.ghostObserved,
      moveItemCalls: trace.moveItemCalls,
    };
  });
}

test("autoplays four flips, three real shuffles, and rotating reveals", async ({
  page,
}) => {
  test.setTimeout(30_000);
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const demo = page.locator(".sideways-demo");
  await demo.scrollIntoViewIfNeeded();
  await expect(demo).toHaveAttribute("data-sideways-phase", "reduced");
  await installSidewaysTrace(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });

  await expect
    .poll(
      async () => {
        const trace = await readSidewaysTrace(page);
        return trace.frames.some(
          (frame) =>
            frame.phase === "complete" &&
            frame.cycle === "2" &&
            frame.revealId === "side-design",
        );
      },
      { timeout: 24_000 },
    )
    .toBe(true);

  const trace = await readSidewaysTrace(page);
  expect(trace.clickTargets.slice(0, 5)).toEqual([
    "side-discover",
    "side-design",
    "side-build",
    "side-ship",
    "side-discover",
  ]);
  expect(trace.activeDragItems.slice(0, 3)).toEqual([
    "side-discover",
    "side-ship",
    "side-design",
  ]);
  expect(trace.frames).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        phase: "shuffle-1",
        order: "side-design,side-build,side-ship,side-discover",
        dropItem: "side-discover",
        dropIndex: "3",
      }),
      expect.objectContaining({
        phase: "shuffle-2",
        order: "side-ship,side-design,side-build,side-discover",
        dropItem: "side-ship",
        dropIndex: "0",
      }),
      expect.objectContaining({
        phase: "shuffle-3",
        order: "side-ship,side-build,side-discover,side-design",
        dropItem: "side-design",
        dropIndex: "3",
      }),
      expect.objectContaining({
        phase: "complete",
        cycle: "1",
        revealId: "side-discover",
        sides: {
          "side-build": "back",
          "side-design": "back",
          "side-discover": "front",
          "side-ship": "back",
        },
      }),
      expect.objectContaining({
        phase: "complete",
        cycle: "2",
        revealId: "side-design",
        sides: {
          "side-build": "back",
          "side-design": "front",
          "side-discover": "back",
          "side-ship": "back",
        },
      }),
    ]),
  );
  expect(trace.ghostObserved).toBe(true);
  expect(trace.moveItemCalls).toBe(0);
  expect(pageErrors).toEqual([]);
});

test("trusted input takes control of the sideways autoplay", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const exhibit = page.locator('[data-gallery="sideways-insert"]');
  const demo = exhibit.locator(".sideways-demo");
  await demo.scrollIntoViewIfNeeded();
  await expect(demo).toHaveAttribute("data-sideways-autoplay-active", "true");

  const hearts = exhibit.getByRole("button", { name: /7 of hearts/ });
  await hearts.click();
  const manualStartedAt = Date.now();
  await expect(demo).toHaveAttribute("data-sideways-manual", "true");
  await expect(demo).toHaveAttribute("data-sideways-autoplay-active", "false");
  await expect(demo.locator("[data-virtual-pointer]")).toHaveAttribute(
    "data-virtual-pointer-state",
    "hidden",
  );

  await page.locator(".gallery-hero").scrollIntoViewIfNeeded();
  await expect(demo).toHaveAttribute("data-sideways-manual", "true");
  await expect(demo).toHaveAttribute("data-sideways-autoplay-active", "false");
  await expect(demo).toHaveAttribute("data-sideways-manual", "false", {
    timeout: 10_000,
  });
  expect(Date.now() - manualStartedAt).toBeGreaterThanOrEqual(7_500);
  await expect(demo).toHaveAttribute("data-sideways-autoplay-active", "true");
  expect(pageErrors).toEqual([]);
});
