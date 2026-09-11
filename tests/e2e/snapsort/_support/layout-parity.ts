// Browser-vs-simulation layout parity: builds real flex/grid DOM through
// page.setContent and converts the measured boxes into layout snapshots.
import { type Page } from "@playwright/test";
import { type ItemSnapshot } from "../../../../assets/snapsort/src/snapshot";
import { type Box, snapshotFixture } from "../../../helpers/snapsort-fixtures";

export type LayoutCase = {
  name: string;
  width: number;
  padding: { top: number; right: number; bottom: number; left: number };
  border: { top: number; right: number; bottom: number; left: number };
  columnGap: number;
  rowGap: number;
  itemWidths: number[];
  itemHeights: number[];
  itemBorders: number[];
};

export type BrowserLayoutCase = {
  name: string;
  container: Box;
  items: Array<{ id: string; box: Box }>;
  draggedId: string;
  ghost: { width: number; height: number };
  actualGhosts: Array<{ index: number; x: number; y: number }>;
};

export function horizontalDoubleRowLayoutCases(): LayoutCase[] {
  const cases: LayoutCase[] = [];
  for (let width = 236; width <= 356; width += 4) {
    const seed = width * 17;
    const count = 14 + (width % 5);
    const itemWidths = Array.from({ length: count }, (_, index) => {
      return 42 + ((seed + index * 13) % 42);
    });
    const itemHeights = Array.from({ length: count }, (_, index) => {
      return 30 + ((seed + index * 7) % 16);
    });
    const itemBorders = Array.from({ length: count }, (_, index) => {
      return (seed + index * 3) % 4;
    });
    cases.push({
      name: `w${width}`,
      width,
      padding: {
        top: (seed % 9) + 1,
        right: ((seed >> 1) % 13) + 2,
        bottom: ((seed >> 2) % 7) + 1,
        left: ((seed >> 3) % 11) + 2,
      },
      border: {
        top: seed % 5,
        right: (seed + 1) % 6,
        bottom: (seed + 2) % 5,
        left: (seed + 3) % 6,
      },
      columnGap: 4 + (seed % 8),
      rowGap: 3 + ((seed >> 2) % 9),
      itemWidths,
      itemHeights,
      itemBorders,
    });
  }
  return cases;
}

export function layoutNodeFromBrowserCase(
  browserCase: BrowserLayoutCase,
): ItemSnapshot<string> {
  return snapshotFixture<string>({
    value: "container",
    direction: "row",
    locked: false,
    box: browserCase.container,
    children: browserCase.items.map((item) => ({
      value: item.id,
      direction: "column",
      locked: false,
      box: item.box,
      children: [],
    })),
  });
}

export async function measureBrowserLayoutCases(
  page: Page,
  cases: LayoutCase[],
): Promise<BrowserLayoutCase[]> {
  await page.setContent('<main id="layout-fixture"></main>');
  return page.evaluate((layoutCases) => {
    type BrowserBox = Box;
    type BrowserCase = BrowserLayoutCase;
    const fixture = document.querySelector("#layout-fixture") as HTMLElement;
    const px = (value: number) => `${value}px`;
    const sideCss = (value: {
      top: number;
      right: number;
      bottom: number;
      left: number;
    }) =>
      `${px(value.top)} ${px(value.right)} ${px(value.bottom)} ${px(value.left)}`;
    const boxOf = (element: HTMLElement): BrowserBox => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      const number = (value: string) => parseFloat(value) || 0;
      return {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        screen: {
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        },
        margin: {
          top: number(style.marginTop),
          right: number(style.marginRight),
          bottom: number(style.marginBottom),
          left: number(style.marginLeft),
        },
        padding: {
          top: number(style.paddingTop),
          right: number(style.paddingRight),
          bottom: number(style.paddingBottom),
          left: number(style.paddingLeft),
        },
        border: {
          top: number(style.borderTopWidth),
          right: number(style.borderRightWidth),
          bottom: number(style.borderBottomWidth),
          left: number(style.borderLeftWidth),
        },
      };
    };
    const makeItem = (
      id: string,
      width: number,
      height: number,
      border: number,
      isGhost = false,
    ) => {
      const item = document.createElement("div");
      item.dataset.itemId = id;
      item.textContent = id;
      item.style.boxSizing = "border-box";
      item.style.flex = "0 0 auto";
      item.style.width = px(width);
      item.style.height = px(height);
      item.style.border = `${px(border)} solid ${isGhost ? "#b45309" : "#2563eb"}`;
      item.style.padding = `${px((width + height) % 5)} ${px((width + border) % 7)}`;
      item.style.background = isGhost ? "#fef3c7" : "#dbeafe";
      return item;
    };
    const buildContainer = (entry: LayoutCase) => {
      fixture.innerHTML = "";
      const container = document.createElement("section");
      container.style.boxSizing = "border-box";
      container.style.display = "flex";
      container.style.flexDirection = "row";
      container.style.flexWrap = "wrap";
      container.style.alignItems = "flex-start";
      container.style.alignContent = "flex-start";
      container.style.width = px(entry.width);
      container.style.padding = sideCss(entry.padding);
      container.style.borderStyle = "solid";
      container.style.borderColor = "#111827";
      container.style.borderWidth = sideCss(entry.border);
      container.style.columnGap = px(entry.columnGap);
      container.style.rowGap = px(entry.rowGap);
      container.style.margin = "16px";
      fixture.appendChild(container);
      return container;
    };

    return layoutCases.map((entry) => {
      const draggedIndex = Math.min(3, entry.itemWidths.length - 1);
      const draggedId = `item-${draggedIndex}`;
      let container = buildContainer(entry);
      const itemElements = entry.itemWidths.map((width, index) => {
        const item = makeItem(
          `item-${index}`,
          width,
          entry.itemHeights[index],
          entry.itemBorders[index],
        );
        container.appendChild(item);
        return item;
      });
      const containerBox = boxOf(container);
      const items = itemElements.map((item) => ({
        id: item.dataset.itemId!,
        box: boxOf(item),
      }));
      const dragged = items[draggedIndex];
      const remaining = items.filter((item) => item.id !== draggedId);
      const actualGhosts: BrowserCase["actualGhosts"] = [];

      for (let index = 0; index <= remaining.length; index++) {
        container = buildContainer(entry);
        for (let i = 0; i <= remaining.length; i++) {
          if (i === index) {
            container.appendChild(
              makeItem(
                "ghost",
                dragged.box.width,
                dragged.box.height,
                entry.itemBorders[draggedIndex],
                true,
              ),
            );
          }
          const remainingItem = remaining[i];
          if (remainingItem) {
            const originalIndex = Number(remainingItem.id.replace("item-", ""));
            container.appendChild(
              makeItem(
                remainingItem.id,
                entry.itemWidths[originalIndex],
                entry.itemHeights[originalIndex],
                entry.itemBorders[originalIndex],
              ),
            );
          }
        }
        const ghost = container.querySelector(
          '[data-item-id="ghost"]',
        ) as HTMLElement;
        const rect = ghost.getBoundingClientRect();
        actualGhosts.push({ index, x: rect.x, y: rect.y });
      }

      return {
        name: entry.name,
        container: containerBox,
        items,
        draggedId,
        ghost: { width: dragged.box.width, height: dragged.box.height },
        actualGhosts,
      };
    });
  }, cases);
}
