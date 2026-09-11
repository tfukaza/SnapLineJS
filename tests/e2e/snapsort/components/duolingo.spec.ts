import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

type ConsoleEntry = {
  type: string;
  text: string;
};

type DragSample = {
  step: number;
  spacerCount: number;
  defaultSpacerCount: number;
  frameworkGhostCount: number;
  adapterOwnedGhostCount: number;
  answerChildOrder: string[];
  bankChildOrder: string[];
  draggedParentClass: string | null;
  spacerParentClass: string | null;
  answerTexts: string[];
  bankTexts: string[];
};

async function writeJson(path: string, value: unknown) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(value, null, 2));
}

async function gotoDemo(page: Page) {
  await page.goto("/?demo=snapsort_duolingo", { waitUntil: "networkidle" });
  await page.locator(".game-demo").scrollIntoViewIfNeeded();
  await expect(page.locator(".answer-box")).toBeVisible();
  await expect(page.locator(".tile-bank")).toBeVisible();
}

function tileIn(container: Locator, text: string) {
  return container.locator(".snapsort-item").filter({ hasText: text }).first();
}

async function tileTexts(container: Locator) {
  return container
    .locator(".tile")
    .evaluateAll((nodes) =>
      nodes.map((node) => node.textContent?.trim().replace(/\s+/g, " ") ?? ""),
    );
}

async function rect(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Expected locator to have a bounding box.");
  return box;
}

function center(box: { x: number; y: number; width: number; height: number }) {
  return {
    x: box.x + box.width / 2,
    y: box.y + box.height / 2,
  };
}

async function collectSample(page: Page, step: number): Promise<DragSample> {
  return page.evaluate((step) => {
    const textList = (selector: string) =>
      [...document.querySelectorAll(`${selector} .tile`)].map(
        (node) => node.textContent?.trim().replace(/\s+/g, " ") ?? "",
      );
    const childOrder = (selector: string) =>
      [...(document.querySelector(selector)?.children ?? [])].map((node) => {
        if (node.id === "spacer") return "#spacer";
        if (node.classList.contains("tile-ghost")) return ".tile-ghost";
        return node.textContent?.trim().replace(/\s+/g, " ") ?? "";
      });
    const active = document.querySelector(".snapsort-item[style*='absolute']");
    const spacer = document.querySelector("#spacer, .tile-ghost");
    const defaultSpacerCount = document.querySelectorAll("#spacer").length;
    const frameworkGhostCount = document.querySelectorAll(".tile-ghost").length;
    // `id="spacer"` is now a universal ghost-entry marker (both core-created
    // and adapter-rendered ghosts carry it, post unified-entries redesign) --
    // `data-snapsort-ghost-entry` is the authoritative "the Svelte adapter
    // itself rendered this, not a raw core-inserted default" signal.
    const adapterOwnedGhostCount = document.querySelectorAll(
      "[data-snapsort-ghost-entry]",
    ).length;
    // `id="spacer"` is the universal ghost-PLACEMENT marker post
    // unified-entries redesign (every ghost carries it, default or
    // adapter-rendered) -- `.tile-ghost` is now a separate, nested
    // CONTENT-level marker (the adapter's ghost entry is a wrapper div with
    // `id="spacer"` containing the consumer's `.tile-ghost` button), not an
    // alternate placement marker as it was pre-redesign. So placement count
    // is `defaultSpacerCount` alone; summing it with the nested content
    // marker would double-count one ghost as two.
    const spacerCount = defaultSpacerCount;
    return {
      step,
      spacerCount,
      defaultSpacerCount,
      frameworkGhostCount,
      adapterOwnedGhostCount,
      answerChildOrder: childOrder(".answer-box"),
      bankChildOrder: childOrder(".tile-bank"),
      draggedParentClass: active?.parentElement?.className ?? null,
      spacerParentClass: spacer?.parentElement?.className ?? null,
      answerTexts: textList(".answer-box"),
      bankTexts: textList(".tile-bank"),
    };
  }, step);
}

async function dragTileToContainer(
  page: Page,
  source: Locator,
  targetContainer: Locator,
  options: { steps?: number; xOffset?: number; yOffset?: number } = {},
) {
  const sourceBox = await rect(source);
  const targetBox = await rect(targetContainer);
  const start = center(sourceBox);
  const end = {
    x: targetBox.x + targetBox.width / 2 + (options.xOffset ?? 0),
    y: targetBox.y + targetBox.height / 2 + (options.yOffset ?? 0),
  };
  const steps = options.steps ?? 36;
  const samples: DragSample[] = [];

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x, start.y - 6);

  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    await page.mouse.move(
      start.x + (end.x - start.x) * t,
      start.y + (end.y - start.y) * t,
    );
    await page.waitForTimeout(16);
    samples.push(await collectSample(page, step));
  }

  await page.mouse.up();
  await page.waitForTimeout(220);
  return samples;
}

async function dragTileToLiveTile(
  page: Page,
  source: Locator,
  target: Locator,
  options: { steps?: number; xOffset?: number; yOffset?: number } = {},
) {
  const sourceBox = await rect(source);
  const start = center(sourceBox);
  const steps = options.steps ?? 36;
  const samples: DragSample[] = [];

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 6, start.y);
  await page.waitForTimeout(80);

  const targetBox = await rect(target);
  const targetCenter = center(targetBox);
  const end = {
    x: targetCenter.x + (options.xOffset ?? 0),
    y: targetCenter.y + (options.yOffset ?? 0),
  };

  for (let step = 1; step <= steps; step++) {
    const t = step / steps;
    await page.mouse.move(
      start.x + (end.x - start.x) * t,
      start.y + (end.y - start.y) * t,
    );
    await page.waitForTimeout(16);
    samples.push(await collectSample(page, step));
  }

  await page.mouse.up();
  await page.waitForTimeout(220);
  return samples;
}

function installConsoleCapture(page: Page, entries: ConsoleEntry[]) {
  const pageErrors: string[] = [];
  page.on("console", (message) => {
    entries.push({ type: message.type(), text: message.text() });
  });
  page.on("pageerror", (error) => {
    pageErrors.push(error.stack ?? error.message);
  });
  return pageErrors;
}

async function expectCleanConsole(
  consoleEntries: ConsoleEntry[],
  pageErrors: string[],
  outputPath: string,
  extra: Record<string, unknown> = {},
) {
  await writeJson(outputPath, {
    consoleEntries,
    pageErrors,
    ...extra,
  });

  expect(pageErrors, "page should not throw").toHaveLength(0);
  expect(
    consoleEntries.filter((entry) =>
      /Element is not set|DOM is not assigned|cannot write to DOM|Unhandled|TypeError|ReferenceError/i.test(
        entry.text,
      ),
    ),
    "SnapSort should not warn about unassigned DOM or crash",
  ).toHaveLength(0);
}

test.describe("SnapSort Kiokun sentence builder demo", () => {
  test("click moves tiles between bank and answer without DOM warnings", async ({
    page,
  }, testInfo) => {
    const consoleEntries: ConsoleEntry[] = [];
    const pageErrors = installConsoleCapture(page, consoleEntries);
    await gotoDemo(page);

    const answer = page.locator(".answer-box");
    const bank = page.locator(".tile-bank");

    await bank.getByRole("button", { name: "私" }).click();
    await bank.getByRole("button", { name: "は" }).click();
    await expect(answer.locator(".tile")).toHaveText(["私", "は"]);

    await answer.getByRole("button", { name: "私" }).click();
    await expect(answer.locator(".tile")).toHaveText(["は"]);
    await expect(bank.locator(".tile").filter({ hasText: "私" })).toHaveCount(
      1,
    );

    await expectCleanConsole(
      consoleEntries,
      pageErrors,
      testInfo.outputPath("click-move-console.json"),
      {
        answerTexts: await tileTexts(answer),
        bankTexts: await tileTexts(bank),
      },
    );
  });

  test("drags a tile from bank to answer with a framework-owned ghost", async ({
    page,
  }, testInfo) => {
    const consoleEntries: ConsoleEntry[] = [];
    const pageErrors = installConsoleCapture(page, consoleEntries);
    await gotoDemo(page);

    const answer = page.locator(".answer-box");
    const bank = page.locator(".tile-bank");
    const source = tileIn(bank, "毎朝");
    const samples = await dragTileToContainer(page, source, answer);

    await writeJson(testInfo.outputPath("bank-to-answer-before-assert.json"), {
      samples,
      answerTexts: await tileTexts(answer),
      bankTexts: await tileTexts(bank),
    });
    await expect(answer.locator(".tile")).toContainText(["毎朝"]);
    expect(
      samples.some(
        (sample) =>
          sample.spacerCount === 1 &&
          sample.frameworkGhostCount === 1 &&
          sample.adapterOwnedGhostCount === 1 &&
          sample.spacerParentClass?.includes("answer-box"),
      ),
      "framework-owned ghost should render under the answer container",
    ).toBe(true);

    await expectCleanConsole(
      consoleEntries,
      pageErrors,
      testInfo.outputPath("bank-to-answer-drag-console.json"),
      { samples },
    );
  });

  test("handles releasing immediately after a fast cross-container drag", async ({
    page,
  }, testInfo) => {
    const consoleEntries: ConsoleEntry[] = [];
    const pageErrors = installConsoleCapture(page, consoleEntries);
    await gotoDemo(page);

    const answer = page.locator(".answer-box");
    const bank = page.locator(".tile-bank");
    const source = tileIn(bank, "毎朝");
    const sourceBox = await rect(source);
    const targetBox = await rect(answer);
    const start = center(sourceBox);
    const end = center(targetBox);

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 8, start.y);
    await page.waitForTimeout(60);
    await page.mouse.move(end.x, end.y);
    await page.mouse.up();
    await page.waitForTimeout(260);

    await expect(answer.locator(".tile")).toContainText(["毎朝"]);
    await expectCleanConsole(
      consoleEntries,
      pageErrors,
      testInfo.outputPath("fast-release-cross-container-console.json"),
      {
        answerTexts: await tileTexts(answer),
        bankTexts: await tileTexts(bank),
      },
    );
  });

  test("drags a selected tile back to the bank with a framework-owned ghost", async ({
    page,
  }, testInfo) => {
    const consoleEntries: ConsoleEntry[] = [];
    const pageErrors = installConsoleCapture(page, consoleEntries);
    await gotoDemo(page);

    const answer = page.locator(".answer-box");
    const bank = page.locator(".tile-bank");
    await bank.getByRole("button", { name: "私" }).click();
    await bank.getByRole("button", { name: "は" }).click();
    await expect(answer.locator(".tile")).toHaveText(["私", "は"]);
    await page.waitForTimeout(260);

    const source = tileIn(answer, "私");
    const samples = await dragTileToContainer(page, source, bank, {
      yOffset: -10,
    });

    await expect(answer.locator(".tile")).toHaveText(["は"]);
    await expect(bank.locator(".tile").filter({ hasText: "私" })).toHaveCount(
      1,
    );
    expect(
      samples.some(
        (sample) =>
          sample.spacerCount === 1 &&
          sample.frameworkGhostCount === 1 &&
          sample.adapterOwnedGhostCount === 1 &&
          sample.spacerParentClass?.includes("tile-bank"),
      ),
      "framework-owned ghost should render under the bank container",
    ).toBe(true);

    await expectCleanConsole(
      consoleEntries,
      pageErrors,
      testInfo.outputPath("answer-to-bank-drag-console.json"),
      { samples },
    );
  });

  test("reorders a non-last answer tile without dropping it at the end", async ({
    page,
  }, testInfo) => {
    const consoleEntries: ConsoleEntry[] = [];
    const pageErrors = installConsoleCapture(page, consoleEntries);
    await gotoDemo(page);

    const answer = page.locator(".answer-box");
    const bank = page.locator(".tile-bank");
    for (const text of ["私", "は", "毎朝", "水"]) {
      await bank.getByRole("button", { name: text }).click();
    }
    await expect(answer.locator(".tile")).toHaveText([
      "私",
      "は",
      "毎朝",
      "水",
    ]);

    const source = tileIn(answer, "は");
    const target = tileIn(answer, "水");
    const samples = await dragTileToLiveTile(page, source, target, {
      xOffset: -36,
    });

    await writeJson(
      testInfo.outputPath("same-container-non-last-before-assert.json"),
      {
        samples,
        answerTexts: await tileTexts(answer),
        bankTexts: await tileTexts(bank),
      },
    );
    await expect(answer.locator(".tile")).toHaveText([
      "私",
      "毎朝",
      "は",
      "水",
    ]);
    await expectCleanConsole(
      consoleEntries,
      pageErrors,
      testInfo.outputPath("same-container-non-last-reorder-console.json"),
      {
        samples,
        answerTexts: await tileTexts(answer),
        bankTexts: await tileTexts(bank),
      },
    );
  });
});
