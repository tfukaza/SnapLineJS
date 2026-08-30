import { expect, test } from "@playwright/test";

const initialBankIds = [
  "lesson-exists",
  "lesson-very",
  "lesson-usage",
  "lesson-this",
  "lesson-new",
  "lesson-subject",
  "lesson-library",
  "lesson-many",
  "lesson-useful",
  "lesson-context",
  "lesson-link",
];

const distractorIds = ["lesson-very", "lesson-new", "lesson-useful"];

const correctAnswerIds = [
  "lesson-this",
  "lesson-library",
  "lesson-context",
  "lesson-many",
  "lesson-link",
  "lesson-usage",
  "lesson-subject",
  "lesson-exists",
];

const initialBankOrder = initialBankIds.join(",");
const distractorOrder = distractorIds.join(",");
const correctAnswerOrder = correctAnswerIds.join(",");
const imperfectDraftOrder = [
  "lesson-this",
  "lesson-new",
  "lesson-library",
  "lesson-link",
  "lesson-many",
  "lesson-context",
].join(",");
const draftWithoutDistractorOrder = [
  "lesson-this",
  "lesson-library",
  "lesson-link",
  "lesson-many",
  "lesson-context",
].join(",");
const firstCorrectionOrder = [
  "lesson-this",
  "lesson-library",
  "lesson-context",
  "lesson-link",
  "lesson-many",
].join(",");
const secondCorrectionOrder = [
  "lesson-this",
  "lesson-library",
  "lesson-many",
  "lesson-context",
  "lesson-link",
].join(",");
const correctedDraftOrder = [
  "lesson-this",
  "lesson-library",
  "lesson-context",
  "lesson-many",
  "lesson-link",
].join(",");
const toucanVirtualPointerId = 2_000_000_003;

type ToucanAutoplaySample = {
  phase: string;
  order: string;
  checkState: string;
};

type ToucanAutoplayTrace = {
  samples: ToucanAutoplaySample[];
  pointerIds: number[];
  returningPressedMoves: number;
  returningPlacements: string[];
  answerCollapsePlacements: Record<string, string>;
  answerCollapseBatches: Record<string, number>;
  reorderPaths: number[][];
  ghostObserved: boolean;
};

test("autoplays an imperfect draft, corrects it, and checks once", async ({
  page,
}) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const exhibit = page.locator('[data-gallery="toucan-lesson"]');
  const lesson = exhibit.locator(".toucan-lesson");
  await lesson.evaluate((element, virtualPointerId) => {
    const trace: ToucanAutoplayTrace = {
      samples: [],
      pointerIds: [],
      returningPressedMoves: 0,
      returningPlacements: [],
      answerCollapsePlacements: {},
      answerCollapseBatches: {},
      reorderPaths: [],
      ghostObserved: false,
    };
    const collapseIds = [
      "lesson-library",
      "lesson-context",
      "lesson-link",
      "lesson-many",
    ];
    let mutationBatch = 0;
    let returnPointerPressed = false;
    const captureReturningPlacement = () => {
      if (
        element.dataset.lessonPhase !== "returning" ||
        !returnPointerPressed
      ) {
        return;
      }

      const ghost = element.querySelector<HTMLElement>(
        '[data-snapsort-ghost-entry="target-spacer"]',
      );
      const slot = ghost?.closest<HTMLElement>("[data-lesson-slot-for]");
      const placement = slot
        ? `slot:${slot.dataset.lessonSlotFor}`
        : ghost?.closest(".toucan-answer-zone")
          ? "answer"
          : ghost?.closest(".toucan-bank-zone")
            ? "bank"
            : "none";
      if (trace.returningPlacements.at(-1) !== placement) {
        trace.returningPlacements.push(placement);
      }

      for (const itemId of collapseIds) {
        if (trace.answerCollapsePlacements[itemId] !== undefined) continue;
        const item = element.querySelector<HTMLElement>(
          `[data-snapsort-item-id="${itemId}"]`,
        );
        if (item?.style.transform.startsWith("translate3d(")) {
          trace.answerCollapsePlacements[itemId] = placement;
          trace.answerCollapseBatches[itemId] = mutationBatch;
        }
      }
    };
    const capture = () => {
      const sample = {
        phase: element.dataset.lessonPhase ?? "",
        order: element.dataset.lessonAnswerOrder ?? "",
        checkState: element.dataset.lessonCheckState ?? "",
      };
      const previous = trace.samples.at(-1);
      if (
        previous?.phase !== sample.phase ||
        previous.order !== sample.order ||
        previous.checkState !== sample.checkState
      ) {
        trace.samples.push(sample);
      }
      if (element.querySelector("[data-snapsort-ghost-entry]")) {
        trace.ghostObserved = true;
      }
      captureReturningPlacement();
    };
    const observer = new MutationObserver(() => {
      mutationBatch += 1;
      capture();
    });
    observer.observe(element, {
      attributes: true,
      attributeFilter: [
        "data-lesson-phase",
        "data-lesson-answer-order",
        "data-lesson-check-state",
        "style",
      ],
      childList: true,
      subtree: true,
    });
    document.addEventListener(
      "pointerdown",
      (event) => {
        if (!trace.pointerIds.includes(event.pointerId)) {
          trace.pointerIds.push(event.pointerId);
        }
        if (event.pointerId === virtualPointerId) {
          returnPointerPressed = true;
          if (element.dataset.lessonPhase === "reordering") {
            trace.reorderPaths.push([]);
          }
        }
      },
      { capture: true },
    );
    const releaseVirtualPointer = (event: PointerEvent) => {
      if (event.pointerId === virtualPointerId) {
        returnPointerPressed = false;
      }
    };
    document.addEventListener("pointerup", releaseVirtualPointer, {
      capture: true,
    });
    document.addEventListener("pointercancel", releaseVirtualPointer, {
      capture: true,
    });
    document.addEventListener(
      "pointermove",
      (event) => {
        if (event.pointerId === virtualPointerId && event.buttons === 1) {
          if (element.dataset.lessonPhase === "returning") {
            trace.returningPressedMoves += 1;
          }
          if (element.dataset.lessonPhase === "reordering") {
            trace.reorderPaths.at(-1)?.push(event.clientX);
          }
        }
      },
      { capture: true },
    );
    capture();
    Reflect.set(window, "__toucanAutoplayTrace", trace);
  }, toucanVirtualPointerId);

  await lesson.scrollIntoViewIfNeeded();
  await expect(lesson).toHaveAttribute("data-lesson-active", "true");
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const trace = Reflect.get(
            window,
            "__toucanAutoplayTrace",
          ) as ToucanAutoplayTrace | undefined;
          return trace?.samples.some(
            (sample) =>
              sample.phase === "complete" && sample.checkState === "correct",
          ) ?? false;
        }),
      { timeout: 35_000 },
    )
    .toBe(true);

  const completedTrace = await page.evaluate(
    () => Reflect.get(window, "__toucanAutoplayTrace") as ToucanAutoplayTrace,
  );
  const phases = completedTrace.samples.map((sample) => sample.phase);
  const orders = completedTrace.samples.map((sample) => sample.order);
  const draftingOrders = completedTrace.samples
    .filter((sample) => sample.phase === "drafting" && sample.order !== "")
    .map((sample) => sample.order);
  expect(draftingOrders.slice(0, 2)).toEqual([
    "lesson-this",
    "lesson-this,lesson-new",
  ]);
  expect(phases).toEqual(
    expect.arrayContaining([
      "drafting",
      "hesitating",
      "returning",
      "reordering",
      "finishing",
      "checking",
      "complete",
    ]),
  );
  expect(orders).toEqual(
    expect.arrayContaining([
      imperfectDraftOrder,
      draftWithoutDistractorOrder,
      firstCorrectionOrder,
      secondCorrectionOrder,
      correctedDraftOrder,
      correctAnswerOrder,
    ]),
  );
  expect(completedTrace.pointerIds).toContain(toucanVirtualPointerId);
  expect(completedTrace.ghostObserved).toBe(true);
  expect(completedTrace.returningPressedMoves).toBeGreaterThan(1);
  const targetSlotPlacement = "slot:lesson-new";
  const pressedReturningPlacements =
    completedTrace.returningPlacements.filter(
      (placement) => placement !== "none",
    );
  expect(pressedReturningPlacements.at(-1)).toBe(targetSlotPlacement);
  expect(
    pressedReturningPlacements.filter(
      (placement) => placement === targetSlotPlacement,
    ).length,
  ).toBeLessThanOrEqual(2);
  expect(Object.keys(completedTrace.answerCollapsePlacements).sort()).toEqual(
    [
      "lesson-library",
      "lesson-context",
      "lesson-link",
      "lesson-many",
    ].sort(),
  );
  expect(completedTrace.reorderPaths.length).toBeGreaterThanOrEqual(3);
  for (const path of completedTrace.reorderPaths.slice(-3)) {
    expect(path.length).toBeGreaterThan(1);
    const firstLeftwardMove = path.findIndex(
      (x, index, values) => index > 0 && x < values[index - 1] - 1,
    );
    expect(firstLeftwardMove).toBeGreaterThan(0);
    const rightwardReversals = path
      .slice(firstLeftwardMove + 1)
      .filter((x, index, values) => index > 0 && x > values[index - 1] + 1);
    expect(rightwardReversals).toHaveLength(0);
  }
  expect(
    completedTrace.samples.some((sample) => sample.checkState === "incorrect"),
  ).toBe(false);

  const completedSampleIndex = completedTrace.samples.findIndex(
    (sample) => sample.phase === "complete" && sample.checkState === "correct",
  );
  await expect
    .poll(
      () =>
        page.evaluate((startIndex) => {
          const trace = Reflect.get(
            window,
            "__toucanAutoplayTrace",
          ) as ToucanAutoplayTrace | undefined;
          return trace?.samples
            .slice(startIndex + 1)
            .some((sample) => sample.order === "") ?? false;
        }, completedSampleIndex),
      { timeout: 5_000 },
    )
    .toBe(true);
  expect(pageErrors).toEqual([]);
});

test("keeps one persistent container per word-bank tile", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const exhibit = page.locator('[data-gallery="toucan-lesson"]');
  const stage = exhibit.locator(".toucan-stage");
  const lesson = exhibit.locator(".toucan-lesson");
  const answer = exhibit.locator(".toucan-answer-zone");
  const bank = exhibit.locator(".toucan-bank-zone");
  const checkButton = exhibit.getByRole("button", { name: "Check" });

  await expect(stage).not.toHaveAttribute("inert", "");
  await expect(stage).not.toHaveAttribute("aria-hidden", "true");
  await expect(stage).toHaveCSS("pointer-events", "auto");
  await expect(stage).toHaveAttribute("role", "group");
  await expect(lesson).toHaveAttribute(
    "data-lesson-bank-order",
    initialBankOrder,
  );
  await expect(bank.locator("button.lesson-word")).toHaveCount(11);
  await expect(checkButton).toBeDisabled();
  await expect(bank.locator("[data-lesson-stub-for]")).toHaveCount(0);

  await lesson.scrollIntoViewIfNeeded();
  await expect(lesson).toHaveAttribute("data-lesson-active", "true");
  await bank.locator('[data-lesson-tile-id="lesson-very"]').click();
  await expect(lesson).toHaveAttribute("data-lesson-manual", "true");
  await expect(lesson).toHaveAttribute(
    "data-lesson-answer-order",
    "lesson-very",
  );
  await page.waitForTimeout(700);
  await expect(lesson).toHaveAttribute(
    "data-lesson-answer-order",
    "lesson-very",
  );
  await expect(bank.locator("[data-lesson-slot-for]")).toHaveCount(11);
  await expect(checkButton).toBeEnabled();
  await checkButton.click();
  await expect(
    exhibit.getByRole("button", { name: "Try again" }),
  ).toBeVisible();
  await expect(
    bank.locator('[data-lesson-stub-for="lesson-very"]'),
  ).toHaveCount(1);
  await answer.locator('[data-lesson-tile-id="lesson-very"]').click();
  await expect(lesson).toHaveAttribute("data-lesson-answer-order", "");
  await expect(exhibit.getByRole("button", { name: "Check" })).toBeDisabled();
  await expect(
    bank.locator(
      '[data-lesson-slot-for="lesson-very"] [data-lesson-tile-id="lesson-very"]',
    ),
  ).toHaveCount(1);
  await expect(exhibit.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);
  expect(pageErrors).toEqual([]);
});

test("drags from the bank, reorders the answer, and returns to its fixed slot", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const exhibit = page.locator('[data-gallery="toucan-lesson"]');
  const lesson = exhibit.locator(".toucan-lesson");
  const answer = exhibit.locator(".toucan-answer-zone");
  const bank = exhibit.locator(".toucan-bank-zone");
  await lesson.scrollIntoViewIfNeeded();

  const initialSlots = await bank.evaluate((element) =>
    Array.from(
      element.querySelectorAll<HTMLElement>(":scope > [data-lesson-slot-for]"),
    ).map((slot) => {
      const tile = slot.querySelector<HTMLElement>("[data-lesson-tile-id]");
      const rect = slot.getBoundingClientRect();
      return {
        id: tile?.dataset.lessonTileId ?? "",
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      };
    }),
  );
  expect(initialSlots.map((slot) => slot.id)).toEqual(initialBankIds);

  const draggableTile = bank.locator(
    'button[data-lesson-tile-id="lesson-this"]',
  );
  const tileBox = await draggableTile.boundingBox();
  const answerBox = await exhibit.locator(".toucan-answer-zone").boundingBox();
  if (!tileBox || !answerBox)
    throw new Error("Toucan drag geometry is missing");
  await page.mouse.move(
    tileBox.x + tileBox.width / 2,
    tileBox.y + tileBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    answerBox.x + answerBox.width / 2,
    answerBox.y + answerBox.height / 2,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(lesson).toHaveAttribute(
    "data-lesson-answer-order",
    "lesson-this",
  );
  await expect(
    bank.locator('[data-lesson-stub-for="lesson-this"]'),
  ).toHaveCount(1);
  await page.waitForTimeout(500);

  await bank.locator('[data-lesson-tile-id="lesson-library"]').click();
  await page.waitForTimeout(500);
  const firstAnswerTile = answer.locator('[data-lesson-tile-id="lesson-this"]');
  const secondAnswerTile = answer.locator(
    '[data-lesson-tile-id="lesson-library"]',
  );
  const firstAnswerBox = await firstAnswerTile.boundingBox();
  const secondAnswerBox = await secondAnswerTile.boundingBox();
  if (!firstAnswerBox || !secondAnswerBox) {
    throw new Error("Toucan answer reorder geometry is missing");
  }
  await page.mouse.move(
    secondAnswerBox.x + secondAnswerBox.width / 2,
    secondAnswerBox.y + secondAnswerBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    firstAnswerBox.x + firstAnswerBox.width / 2,
    firstAnswerBox.y + firstAnswerBox.height / 2,
    { steps: 8 },
  );
  await page.mouse.up();
  await expect(lesson).toHaveAttribute(
    "data-lesson-answer-order",
    "lesson-library,lesson-this",
  );
  await page.waitForTimeout(500);

  const returnTile = answer.locator('[data-lesson-tile-id="lesson-this"]');
  const returnTileBox = await returnTile.boundingBox();
  const bankBox = await bank.boundingBox();
  if (!returnTileBox || !bankBox) {
    throw new Error("Toucan return geometry is missing");
  }
  await page.mouse.move(
    returnTileBox.x + returnTileBox.width / 2,
    returnTileBox.y + returnTileBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    bankBox.x + bankBox.width - 8,
    bankBox.y + bankBox.height - 8,
    {
      steps: 10,
    },
  );
  await page.mouse.up();
  await expect(lesson).toHaveAttribute(
    "data-lesson-answer-order",
    "lesson-library",
  );
  await expect(
    bank.locator(
      '[data-lesson-slot-for="lesson-this"] [data-lesson-tile-id="lesson-this"]',
    ),
  ).toHaveCount(1);
  await page.waitForTimeout(500);

  const movedSlots = await bank.evaluate((element) =>
    Array.from(
      element.querySelectorAll<HTMLElement>(":scope > [data-lesson-slot-for]"),
    ).map((slot) => {
      const tile = slot.querySelector<HTMLElement>("[data-lesson-tile-id]");
      const stub = slot.matches("[data-lesson-stub-for]")
        ? slot
        : slot.querySelector<HTMLElement>("[data-lesson-stub-for]");
      const rect = slot.getBoundingClientRect();
      return {
        id: tile?.dataset.lessonTileId ?? stub?.dataset.lessonStubFor ?? "",
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        stub: Boolean(stub),
      };
    }),
  );
  expect(movedSlots).toHaveLength(initialSlots.length);
  for (const [index, slot] of movedSlots.entries()) {
    const initial = initialSlots[index];
    expect(slot.id).toBe(initial.id);
    expect(Math.abs(slot.x - initial.x)).toBeLessThanOrEqual(1);
    expect(Math.abs(slot.y - initial.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(slot.width - initial.width)).toBeLessThanOrEqual(1);
    expect(Math.abs(slot.height - initial.height)).toBeLessThanOrEqual(1);
  }
  expect(movedSlots.find((slot) => slot.id === "lesson-library")?.stub).toBe(
    true,
  );
  await expect(exhibit.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);
});

test("returns an answer tile through the open bank corridor", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const exhibit = page.locator('[data-gallery="toucan-lesson"]');
  const lesson = exhibit.locator(".toucan-lesson");
  const answer = exhibit.locator(".toucan-answer-zone");
  const bank = exhibit.locator(".toucan-bank-zone");
  await lesson.scrollIntoViewIfNeeded();

  await bank.locator('[data-lesson-tile-id="lesson-this"]').click();
  await bank.locator('[data-lesson-tile-id="lesson-library"]').click();
  await expect(lesson).toHaveAttribute(
    "data-lesson-answer-order",
    "lesson-this,lesson-library",
  );
  await page.waitForTimeout(500);

  const sibling = answer.locator('[data-snapsort-item-id="lesson-library"]');
  await sibling.evaluate((element) => {
    const trace = { translated: false };
    const capture = () => {
      if ((element as HTMLElement).style.transform.startsWith("translate3d(")) {
        trace.translated = true;
      }
    };
    const observer = new MutationObserver(capture);
    observer.observe(element, {
      attributes: true,
      attributeFilter: ["style"],
    });
    Reflect.set(window, "__toucanCorridorAnimation", { observer, trace });
  });

  const source = answer.locator('[data-lesson-tile-id="lesson-this"]');
  const sourceBox = await source.boundingBox();
  const corridor = await exhibit.evaluate((element) => {
    const answerElement = element.querySelector<HTMLElement>(
      ".toucan-answer-zone",
    );
    const bankElement = element.querySelector<HTMLElement>(
      ".toucan-bank-zone",
    );
    const slots = Array.from(
      element.querySelectorAll<HTMLElement>(
        ".toucan-bank-zone > [data-lesson-slot-for]",
      ),
    );
    if (!answerElement || !bankElement || slots.length === 0) return null;
    const answerRect = answerElement.getBoundingClientRect();
    const bankRect = bankElement.getBoundingClientRect();
    const visibleRowsTop = Math.min(
      ...slots.map((slot) => slot.getBoundingClientRect().top),
    );
    const answerBottom = answerRect.bottom;
    return {
      answerBottom,
      bankTop: bankRect.top,
      visibleRowsTop,
      x: bankRect.left + bankRect.width / 2,
      y: answerBottom + (visibleRowsTop - answerBottom) / 2,
    };
  });
  if (!sourceBox || !corridor) {
    throw new Error("Toucan corridor drag geometry is missing");
  }
  expect(Math.abs(corridor.bankTop - corridor.answerBottom)).toBeLessThanOrEqual(
    1,
  );
  expect(corridor.visibleRowsTop).toBeGreaterThan(corridor.answerBottom + 8);

  await page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(corridor.x, corridor.y, { steps: 12 });
  await expect(
    bank.locator('[data-snapsort-ghost-entry="target-spacer"]'),
  ).toHaveCount(1);
  await expect(
    answer.locator('[data-snapsort-ghost-entry="target-spacer"]'),
  ).toHaveCount(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const state = Reflect.get(window, "__toucanCorridorAnimation") as {
          trace: { translated: boolean };
        };
        return state.trace.translated;
      }),
    )
    .toBe(true);
  await page.mouse.up();

  await expect(lesson).toHaveAttribute(
    "data-lesson-answer-order",
    "lesson-library",
  );
  await expect(
    bank.locator(
      '[data-lesson-slot-for="lesson-this"] [data-lesson-tile-id="lesson-this"]',
    ),
  ).toHaveCount(1);
  await expect(exhibit.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);
  await page.evaluate(() => {
    const state = Reflect.get(window, "__toucanCorridorAnimation") as {
      observer: MutationObserver;
    };
    state.observer.disconnect();
  });
  expect(pageErrors).toEqual([]);
});

test("completed tiles, distractors, and writing lines remain deterministic", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto("/snapdesign/gallery", { waitUntil: "networkidle" });

  const exhibit = page.locator('[data-gallery="toucan-lesson"]');
  const lesson = exhibit.locator(".toucan-lesson");
  const answer = exhibit.locator(".toucan-answer-zone");
  const bank = exhibit.locator(".toucan-bank-zone");
  await lesson.scrollIntoViewIfNeeded();

  await expect(lesson).toHaveAttribute(
    "data-lesson-answer-order",
    correctAnswerOrder,
  );
  await expect(lesson).toHaveAttribute(
    "data-lesson-bank-order",
    distractorOrder,
  );
  await expect(bank.locator("[data-lesson-stub-for]")).toHaveCount(8);

  const bankContainment = await bank.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight,
    rowCount: new Set(
      Array.from(
        element.querySelectorAll<HTMLElement>(
          ":scope > [data-lesson-slot-for]",
        ),
        (slot) => Math.round(slot.getBoundingClientRect().y),
      ),
    ).size,
  }));
  expect(bankContainment.scrollHeight).toBe(bankContainment.clientHeight);
  expect(bankContainment.rowCount).toBe(2);

  const lineClearances = await answer.evaluate((element) => {
    const lineTops = Array.from(
      element.querySelectorAll<HTMLElement>("[data-answer-rule]"),
      (line) => line.getBoundingClientRect().top,
    );
    return Array.from(
      element.querySelectorAll<HTMLElement>(".lesson-word"),
    ).map((word) => {
      const visualBottom = word.getBoundingClientRect().bottom + 6;
      const line = lineTops.find((top) => top > visualBottom);
      return line === undefined
        ? Number.NEGATIVE_INFINITY
        : line - visualBottom;
    });
  });
  expect(Math.min(...lineClearances)).toBeGreaterThanOrEqual(5.5);

  await bank.locator('button[data-lesson-tile-id="lesson-very"]').focus();
  await page.keyboard.press("Enter");
  await expect(lesson).toHaveAttribute(
    "data-lesson-answer-order",
    `${correctAnswerOrder},lesson-very`,
  );
  await expect(lesson).not.toHaveClass(/complete/);
  await expect(
    bank.locator('[data-lesson-stub-for="lesson-very"]'),
  ).toHaveCount(1);

  await page.waitForTimeout(500);
  await answer.locator('button[data-lesson-tile-id="lesson-very"]').click();
  await expect(lesson).toHaveAttribute(
    "data-lesson-answer-order",
    correctAnswerOrder,
  );
  await expect(lesson).toHaveClass(/complete/);
  await expect(
    bank.locator('[data-lesson-stub-for="lesson-very"]'),
  ).toHaveCount(0);
});
