import { expect, test, type Locator, type Page } from "@playwright/test";
import { coreImportPath } from "../../shared/servers";

async function rect(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) throw new Error("Expected locator to have a bounding box.");
  return box;
}

function center(box: { x: number; y: number; width: number; height: number }) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

async function verticalColumn(page: Page): Promise<Locator> {
  const cell = page.locator(".demo-cell", {
    has: page.getByRole("heading", { name: "Vertical Column" }),
  });
  await expect(cell).toBeVisible();
  return cell.locator(".snapsort-container").first();
}

async function setGhostRemoveAvailable(page: Page, available: boolean) {
  await page.evaluate(
    async ({ coreImportPath, available }) => {
      const { GlobalManager } = await import(coreImportPath);
      const cell = [...document.querySelectorAll(".demo-cell")].find(
        (element) =>
          element.querySelector("h2")?.textContent?.trim() ===
          "Vertical Column",
      );
      const element = cell?.querySelector(".snapsort-container");
      const containers =
        GlobalManager.getInstance().data.dragAndDropContainers ?? [];
      const container = containers.find(
        (candidate: any) => candidate.element === element,
      );
      if (!container) throw new Error("Could not find the Vertical Column.");

      const testState = globalThis as typeof globalThis & {
        __snapsortGhostRemoveCallbacks?: Record<string, any>;
      };
      if (!available) {
        testState.__snapsortGhostRemoveCallbacks = container.callbacks;
        container.callbacks = {
          ...container.callbacks,
          onGhostRemove: undefined,
        };
      } else {
        const callbacks = testState.__snapsortGhostRemoveCallbacks;
        if (!callbacks) {
          throw new Error("No Vertical Column callbacks were saved.");
        }
        container.callbacks = callbacks;
      }
    },
    { coreImportPath, available },
  );
}

async function setItemMoveFailure(page: Page, enabled: boolean) {
  await page.evaluate(
    async ({ coreImportPath, enabled }) => {
      const { GlobalManager } = await import(coreImportPath);
      const cell = [...document.querySelectorAll(".demo-cell")].find(
        (element) =>
          element.querySelector("h2")?.textContent?.trim() ===
          "Vertical Column",
      );
      const element = cell?.querySelector(".snapsort-container");
      const containers =
        GlobalManager.getInstance().data.dragAndDropContainers ?? [];
      const container = containers.find(
        (candidate: any) => candidate.element === element,
      );
      if (!container) throw new Error("Could not find the Vertical Column.");

      const testState = globalThis as typeof globalThis & {
        __snapsortItemMoveFailure?: {
          container: { callbacks: Record<string, any> };
          descriptor: PropertyDescriptor;
          callbacks: Record<string, any>;
        };
      };
      if (enabled) {
        const callbacks = container.callbacks as Record<string, any>;
        const descriptor = Object.getOwnPropertyDescriptor(
          Object.getPrototypeOf(container),
          "callbacks",
        );
        if (!descriptor?.get || !descriptor.set) {
          throw new Error("Container has no controlled callbacks property.");
        }
        if (!callbacks.onItemMove) {
          throw new Error("Vertical Column has no onItemMove.");
        }
        const state = {
          container,
          descriptor,
          callbacks,
        };
        const wrap = (next: Record<string, any>) => {
          const original = next.onItemMove as
            | ((...args: any[]) => void)
            | undefined;
          if (!original) {
            throw new Error("Vertical Column has no onItemMove.");
          }
          state.callbacks = next;
          return {
            ...next,
            onItemMove: (...args: any[]) => {
              original(...args);
              throw new Error("intentional scheduled onItemMove failure");
            },
          };
        };
        descriptor.set.call(container, wrap(callbacks));
        Object.defineProperty(container, "callbacks", {
          configurable: true,
          enumerable: descriptor.enumerable,
          get: () => descriptor.get?.call(container),
          set: (next: Record<string, any>) => {
            descriptor.set?.call(container, wrap(next));
          },
        });
        testState.__snapsortItemMoveFailure = state;
      } else {
        const state = testState.__snapsortItemMoveFailure;
        if (!state) return;
        Reflect.deleteProperty(state.container, "callbacks");
        state.descriptor.set?.call(state.container, state.callbacks);
        delete testState.__snapsortItemMoveFailure;
      }
    },
    { coreImportPath, enabled },
  );
}

async function verticalColumnSessionStatus(page: Page): Promise<string | null> {
  return page.evaluate(
    async ({ coreImportPath }) => {
      const { GlobalManager } = await import(coreImportPath);
      const cell = [...document.querySelectorAll(".demo-cell")].find(
        (element) =>
          element.querySelector("h2")?.textContent?.trim() ===
          "Vertical Column",
      );
      const element = cell?.querySelector(".snapsort-container");
      const containers =
        GlobalManager.getInstance().data.dragAndDropContainers ?? [];
      const container = containers.find(
        (candidate: any) => candidate.element === element,
      );
      return container?.rootContainer?.dragSession?.status ?? null;
    },
    { coreImportPath },
  );
}

test("bad framework callbacks fail before activation without stopping the next drag", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

  const column = await verticalColumn(page);
  const first = column.locator(".snapsort-item").first();
  const start = center(await rect(first));

  await setGhostRemoveAvailable(page, false);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 8, start.y + 8);
  await page.waitForTimeout(100);
  await page.mouse.up();

  expect(
    pageErrors.some((error) =>
      error.message.includes("callbacks.onGhostRemove"),
    ),
  ).toBe(true);
  await expect(column.locator('[data-snapsort-dragging="true"]')).toHaveCount(
    0,
  );
  await expect(column.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);

  await setGhostRemoveAvailable(page, true);
  const last = column.locator(".snapsort-item").last();
  const retryStart = center(await rect(first));
  const retryTarget = center(await rect(last));
  await page.mouse.move(retryStart.x, retryStart.y);
  await page.mouse.down();
  await page.mouse.move(retryStart.x + 8, retryStart.y + 8);
  await page.waitForTimeout(60);
  await page.mouse.move(retryTarget.x, retryTarget.y + 20, { steps: 12 });
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page.waitForTimeout(220);

  await expect(column.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);
  const order = await column
    .locator(".snapsort-item")
    .evaluateAll((elements) =>
      elements.map((element) => element.textContent?.trim()),
    );
  expect(order).toEqual(["Item 2", "Item 3", "Item 4", "Item 1"]);
});

test("a throwing scheduled mutation is reported and cleanup keeps the frame loop alive", async ({
  page,
}) => {
  const pageErrors: Error[] = [];
  page.on("pageerror", (error) => pageErrors.push(error));
  await page.goto("/?demo=drop_snap_nested", { waitUntil: "networkidle" });

  const column = await verticalColumn(page);
  const first = column.locator(".snapsort-item").first();
  const start = center(await rect(first));

  await setItemMoveFailure(page, true);
  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  await page.mouse.move(start.x + 8, start.y + 8);
  await page.waitForTimeout(80);
  await page.mouse.up();
  await page.waitForTimeout(180);

  expect(
    pageErrors.some((error) =>
      error.message.includes("intentional scheduled onItemMove failure"),
    ),
  ).toBe(true);
  await expect(column.locator('[data-snapsort-dragging="true"]')).toHaveCount(
    0,
  );
  await expect(column.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);
  expect(await verticalColumnSessionStatus(page)).toBeNull();

  await setItemMoveFailure(page, false);
  const retryFirst = column.locator(".snapsort-item").first();
  const retryLast = column.locator(".snapsort-item").last();
  const retryStart = center(await rect(retryFirst));
  const retryTarget = center(await rect(retryLast));
  await page.mouse.move(retryStart.x, retryStart.y);
  await page.mouse.down();
  await page.mouse.move(retryStart.x + 8, retryStart.y + 8);
  await page.waitForTimeout(60);
  await page.mouse.move(retryTarget.x, retryTarget.y + 20, { steps: 12 });
  await page.waitForTimeout(100);
  await page.mouse.up();
  await page.waitForTimeout(220);

  await expect(column.locator("[data-snapsort-ghost-entry]")).toHaveCount(0);
  const order = await column
    .locator(".snapsort-item")
    .evaluateAll((elements) =>
      elements.map((element) => element.textContent?.trim()),
    );
  expect(order).toEqual(["Item 2", "Item 3", "Item 4", "Item 1"]);
});
