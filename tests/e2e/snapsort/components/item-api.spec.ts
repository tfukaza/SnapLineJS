import { expect, test, type Page } from "@playwright/test";

type ItemApiReport = {
  adoptedBound: boolean;
  adoptedDestroyed: boolean;
  adoptedDetached: boolean;
  adoptedMetadata: unknown;
  adoptedParent: boolean;
  adoptedSelected: boolean;
  generatedBound: boolean;
  generatedDestroyed: boolean;
  generatedMetadata: unknown;
  generatedParent: boolean;
  nativeClicks: number;
};

async function readReport(page: Page): Promise<ItemApiReport> {
  const text = await page.getByTestId("item-api-report").textContent();
  if (!text) throw new Error("Missing Item API fixture report.");
  return JSON.parse(text) as ItemApiReport;
}

test("Item creates an owned instance and borrows an explicitly supplied instance", async ({
  page,
}) => {
  await page.goto("/?demo=snapsort_components&itemApi=1", {
    waitUntil: "networkidle",
  });

  await expect(page.getByTestId("item-api-fixture")).toBeVisible();
  await page.getByTestId("item-api-inspect").click();
  expect(await readReport(page)).toEqual({
    adoptedBound: true,
    adoptedDestroyed: false,
    adoptedDetached: false,
    adoptedMetadata: "application",
    adoptedParent: true,
    adoptedSelected: true,
    generatedBound: true,
    generatedDestroyed: false,
    generatedMetadata: 1,
    generatedParent: true,
    nativeClicks: 0,
  });

  await expect(page.getByTestId("item-api-generated")).toHaveAttribute(
    "aria-label",
    "Generated Item",
  );
  await page.getByTestId("item-api-generated").click();
  await page.getByTestId("item-api-replace-metadata").click();
  await page.getByTestId("item-api-inspect").click();
  expect((await readReport(page)).generatedMetadata).toBe(2);
  expect((await readReport(page)).nativeClicks).toBe(1);

  await page.getByTestId("item-api-unmount").click();
  await page.getByTestId("item-api-inspect").click();
  expect(await readReport(page)).toEqual({
    adoptedBound: false,
    adoptedDestroyed: false,
    adoptedDetached: true,
    adoptedMetadata: "application",
    adoptedParent: true,
    adoptedSelected: true,
    generatedBound: false,
    generatedDestroyed: true,
    generatedMetadata: 2,
    generatedParent: false,
    nativeClicks: 1,
  });
});
