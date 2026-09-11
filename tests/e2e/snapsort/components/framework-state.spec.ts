import { expect, test } from "@playwright/test";
import { type Rect } from "../../../../src/geometry";
import { center } from "../../../helpers/snapsort-fixtures";
import {
  componentArrayList,
  dragBy,
  installSnapsortTrace,
  itemByTextIn,
  itemRect,
} from "../_support/drag-harness";
import { repoRoot } from "../../shared/servers";

test.describe("Snapsort drag-start snapshot layout", () => {
  test.beforeEach(async ({ page }) => {
    await installSnapsortTrace(page);
  });

  test("updates framework state when SnapSort move callbacks reorder an array list", async ({
    page,
  }) => {
    await page.goto("/?demo=snapsort_components", {
      waitUntil: "networkidle",
    });

    const list = await componentArrayList(page);
    const kanbanPanel = page.locator(".kanban-panel");
    await expect(page.locator(".demo-header p")).toHaveText(
      "6 Euclidean cards plus Progressive sentence demos",
    );

    await kanbanPanel.getByRole("button", { name: "Add Item" }).click();
    await expect(page.locator(".demo-header p")).toHaveText(
      "7 Euclidean cards plus Progressive sentence demos",
    );
    await expect(list.locator(".task-card")).toHaveCount(5);

    const deleteButton = page.getByRole("button", { name: "Delete Task 7" });
    await deleteButton.click();
    await expect(page.locator(".demo-header p")).toHaveText(
      "6 Euclidean cards plus Progressive sentence demos",
    );
    await expect(list.locator(".task-card")).toHaveCount(4);

    const upwardItem = await itemByTextIn(list, "Search filters");
    const upwardItemRect = await itemRect(upwardItem);
    const upwardItemCenter = center(upwardItemRect);
    const upwardTarget = await itemByTextIn(list, "Invite flow");
    const upwardTargetCenter = center(await itemRect(upwardTarget));

    await dragBy(
      page,
      upwardItem,
      "Search filters",
      0,
      {
        x: 0,
        y: upwardTargetCenter.y - upwardItemCenter.y - 24,
      },
      {
        start: {
          x: upwardItemRect.x + 24,
          y: upwardItemCenter.y,
        },
      },
    );

    await expect(list.locator(".task-card .task-main strong")).toHaveText([
      "Profile fields",
      "Search filters",
      "Invite flow",
      "Audit log",
    ]);

    await kanbanPanel.getByRole("button", { name: "Reset" }).click();
    await expect(page.locator(".demo-header p")).toHaveText(
      "6 Euclidean cards plus Progressive sentence demos",
    );

    const item = await itemByTextIn(list, "Profile fields");
    const itemRectValue = await itemRect(item);
    const itemCenter = center(itemRectValue);
    const target = await itemByTextIn(list, "Search filters");
    const targetCenter = center(await itemRect(target));

    await dragBy(
      page,
      item,
      "Profile fields",
      0,
      {
        x: 0,
        y: targetCenter.y - itemCenter.y + 16,
      },
      {
        start: {
          x: itemRectValue.x + 24,
          y: itemCenter.y,
        },
      },
    );

    await expect(
      page.locator(".task-card").filter({ hasText: "Profile fields" }),
    ).toHaveCount(1);

    await expect(page.locator(".demo-header p")).toHaveText(
      "6 Euclidean cards plus Progressive sentence demos",
    );
    await expect(list.locator(".task-card .task-main strong")).toHaveText([
      "Invite flow",
      "Audit log",
      "Search filters",
      "Profile fields",
    ]);
  });

  test("animates a component card moving between columns with SnapEngine FLIP", async ({
    page,
  }) => {
    await page.goto("/?demo=snapsort_components", {
      waitUntil: "networkidle",
    });

    await page.evaluate(() => {
      const win = window as typeof window & {
        __snapsortMoveComponentItem?: (
          itemId: string,
          direction: -1 | 1,
        ) => void;
      };
      win.__snapsortMoveComponentItem?.("item-1", 1);
    });

    const animated = await page.evaluate(async () => {
      for (let frame = 0; frame < 10; frame++) {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const animatedCard = [...document.querySelectorAll(".task-card")].find(
          (element) =>
            /^translate3d\(-?\d/.test((element as HTMLElement).style.transform),
        );
        if (animatedCard) {
          return true;
        }
      }
      return false;
    });

    expect(animated).toBe(true);

    const panels = page.locator(".list-panel");
    await expect(
      panels.nth(0).locator(".task-card .task-main strong"),
    ).toHaveText(["Invite flow", "Audit log", "Search filters"]);
    await expect(
      panels.nth(1).locator(".task-card .task-main strong"),
    ).toHaveText(["Profile fields", "Board polish"]);
  });

  test("animates framework-owned programmatic removal but not direct state deletion", async ({
    page,
  }) => {
    const observesTransform = async () =>
      page.evaluate(async () => {
        for (let frame = 0; frame < 10; frame++) {
          await new Promise((resolve) => requestAnimationFrame(resolve));
          const animatedCard = [
            ...document.querySelectorAll(".array-list .task-card"),
          ].find((element) =>
            /^translate3d\(-?\d/.test((element as HTMLElement).style.transform),
          );
          if (animatedCard) return true;
        }
        return false;
      });

    await page.goto("/?demo=snapsort_components&slowFlip=1", {
      waitUntil: "networkidle",
    });
    await page.evaluate(() => {
      const demoWindow = window as typeof window & {
        __snapsortDeleteComponentItem?: (itemId: string) => void;
      };
      demoWindow.__snapsortDeleteComponentItem?.("item-1");
    });
    expect(await observesTransform()).toBe(false);

    await page.goto("/?demo=snapsort_components&slowFlip=1", {
      waitUntil: "networkidle",
    });
    const accepted = await page.evaluate(() => {
      const demoWindow = window as typeof window & {
        __snapsortRemoveComponentItem?: (itemId: string) => boolean;
      };
      return demoWindow.__snapsortRemoveComponentItem?.("item-1") ?? false;
    });
    expect(accepted).toBe(true);
    expect(await observesTransform()).toBe(true);
    await expect(
      page.locator(".array-list .task-card .task-main strong"),
    ).toHaveText(["Invite flow", "Audit log", "Search filters"]);
  });

  test("resets pooled animation variables before a channel is reused", async ({
    page,
  }) => {
    await page.goto("/?demo=snapsort_components", {
      waitUntil: "networkidle",
    });

    const animationModuleUrl = `/@fs${repoRoot}/src/animation.ts`;
    const result = await page.evaluate(async (moduleUrl) => {
      const { AnimationObject } = await import(/* @vite-ignore */ moduleUrl);
      const target = document.createElement("div");
      document.body.appendChild(target);

      const first = new AnimationObject(
        target,
        { $value: [0, 1] },
        { duration: 40 },
      );
      first.play();
      for (let frame = 0; frame < 20 && !first.requestDelete; frame++) {
        await new Promise<void>((resolve) =>
          requestAnimationFrame(() => resolve()),
        );
      }

      const propertiesAfterFinish = Array.from(target.style).filter((name) =>
        name.startsWith("--snap-var-"),
      );
      const samples: number[] = [];
      const second = new AnimationObject(
        target,
        { $value: [0.25, 0.75] },
        {
          duration: 800,
          tick: (values: Record<string, number>) => samples.push(values.$value),
        },
      );
      const acquiredProperties = Array.from(target.style)
        .filter((name) => name.startsWith("--snap-var-"))
        .map((name) => target.style.getPropertyValue(name));
      second.play();
      second.progress = 0;
      second.calculateFrame(performance.now());
      second.cancel();
      target.remove();

      return {
        acquiredProperties,
        firstSample: samples[0] ?? null,
        propertiesAfterFinish,
      };
    }, animationModuleUrl);

    expect(result.propertiesAfterFinish).toEqual([]);
    expect(result.acquiredProperties).toHaveLength(1);
    expect(Number(result.acquiredProperties[0])).toBeCloseTo(0.25);
    expect(result.firstSample).toBeCloseTo(0.25);
  });

  test("installs the drop inverse before the first post-release paint", async ({
    page,
  }) => {
    await page.goto("/?demo=snapsort_components&slowFlip=1", {
      waitUntil: "networkidle",
    });

    const moveComponentItem = async (direction: -1 | 1) => {
      await page.evaluate((nextDirection) => {
        const win = window as typeof window & {
          __snapsortMoveComponentItem?: (
            itemId: string,
            direction: -1 | 1,
          ) => void;
        };
        win.__snapsortMoveComponentItem?.("item-1", nextDirection);
      }, direction);
    };
    await moveComponentItem(1);
    await page.waitForTimeout(900);
    await moveComponentItem(-1);
    await page.waitForTimeout(900);

    const card = page
      .locator(".task-card:not(.snapsort-ghost)")
      .filter({ hasText: "Profile fields" });
    const target = page
      .locator(".task-card:not(.snapsort-ghost)")
      .filter({ hasText: "Board polish" });
    const start = center(await itemRect(card.locator(".task-drag-handle")));
    const targetRect = await itemRect(target);
    const releasePoint = {
      x: targetRect.x + targetRect.width / 2,
      y: targetRect.y + targetRect.height * 0.8,
    };

    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x + 5, start.y);
    await page.waitForTimeout(16);
    await page.mouse.move(releasePoint.x, releasePoint.y, { steps: 24 });
    await page.waitForTimeout(80);
    const releaseRect = await itemRect(card);

    await page.evaluate(() => {
      const win = window as typeof window & {
        __dropFlipSamples?: Array<{
          column: string;
          transform: string;
          x: number;
          y: number;
        }>;
      };
      win.__dropFlipSamples = [];
      window.addEventListener(
        "pointerup",
        () => {
          let frame = 0;
          const sample = () => {
            const card = [
              ...document.querySelectorAll<HTMLElement>(
                ".task-card:not(.snapsort-ghost)",
              ),
            ].find((element) =>
              element.textContent?.includes("Profile fields"),
            );
            if (card) {
              const rect = card.getBoundingClientRect();
              win.__dropFlipSamples?.push({
                column:
                  card
                    .closest(".list-panel")
                    ?.querySelector("h2")
                    ?.textContent?.trim() ?? "",
                transform: card.style.transform,
                x: rect.x,
                y: rect.y,
              });
            }
            frame++;
            if (frame < 12) requestAnimationFrame(sample);
          };
          requestAnimationFrame(sample);
        },
        { capture: true, once: true },
      );
    });

    await page.mouse.up();
    await page.waitForTimeout(250);
    const samples = await page.evaluate(() => {
      const win = window as typeof window & {
        __dropFlipSamples?: Array<{
          column: string;
          transform: string;
          x: number;
          y: number;
        }>;
      };
      return win.__dropFlipSamples ?? [];
    });
    await page.waitForTimeout(700);
    const finalRect = await itemRect(card);
    const activeSamples = samples.filter(
      (sample) => sample.column === "Active",
    );
    expect(activeSamples.length).toBeGreaterThan(1);
    expect(activeSamples[0].transform).toMatch(/^translate3d\(/);

    const distanceTo = (sample: { x: number; y: number }, rect: Rect) =>
      Math.hypot(sample.x - rect.x, sample.y - rect.y);
    expect(distanceTo(activeSamples[0], releaseRect)).toBeLessThan(8);
    expect(distanceTo(activeSamples[0], finalRect)).toBeGreaterThan(12);

    const distancesToFinal = activeSamples.map((sample) =>
      distanceTo(sample, finalRect),
    );
    for (let index = 1; index < distancesToFinal.length; index++) {
      expect(distancesToFinal[index]).toBeLessThanOrEqual(
        distancesToFinal[index - 1] + 3,
      );
    }
  });
});
