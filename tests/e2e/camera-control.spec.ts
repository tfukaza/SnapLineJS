import { expect, test, type Page } from "@playwright/test";

const engineSelector = '[data-testid="camera-engine"]';

type Point = {
  x: number;
  y: number;
};

type CameraTransform = {
  scale: number;
  x: number;
  y: number;
};

async function cameraTransform(page: Page): Promise<CameraTransform> {
  return page.locator("#snap-camera-control").evaluate((element) => {
    const transform = getComputedStyle(element).transform;
    if (!transform || transform === "none") {
      return { scale: 1, x: 0, y: 0 };
    }

    const values = transform
      .slice(transform.indexOf("(") + 1, transform.lastIndexOf(")"))
      .split(",")
      .map((value) => Number(value.trim()));

    if (transform.startsWith("matrix3d(")) {
      return { scale: values[0] || 1, x: values[12] || 0, y: values[13] || 0 };
    }

    return { scale: values[0] || 1, x: values[4] || 0, y: values[5] || 0 };
  });
}

async function cameraScale(page: Page) {
  return (await cameraTransform(page)).scale;
}

async function cameraWorldAt(page: Page, point: Point) {
  const [transform, canvasBox] = await Promise.all([
    cameraTransform(page),
    page.locator(engineSelector).boundingBox(),
  ]);
  expect(canvasBox).not.toBeNull();

  const cameraX = point.x - canvasBox!.x;
  const cameraY = point.y - canvasBox!.y;

  return {
    x: (cameraX - transform.x) / transform.scale,
    y: (cameraY - transform.y) / transform.scale,
  };
}

async function dispatchTouchPointer(
  page: Page,
  type: "pointerdown" | "pointermove" | "pointerup",
  pointerId: number,
  point: Point,
  options: { isPrimary?: boolean; buttons?: number } = {},
) {
  await page.locator(engineSelector).evaluate(
    (
      element,
      {
        type,
        pointerId,
        point,
        isPrimary,
        buttons,
      }: {
        type: "pointerdown" | "pointermove" | "pointerup";
        pointerId: number;
        point: Point;
        isPrimary: boolean;
        buttons: number;
      },
    ) => {
      element.dispatchEvent(
        new PointerEvent(type, {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId,
          pointerType: "touch",
          isPrimary,
          clientX: point.x,
          clientY: point.y,
          button: type === "pointerdown" ? 0 : -1,
          buttons,
        }),
      );
    },
    {
      type,
      pointerId,
      point,
      isPrimary: options.isPrimary ?? pointerId === 1,
      buttons: options.buttons ?? (type === "pointerup" ? 0 : 1),
    },
  );
}

test("stationary second touch after a one-finger pan does not zoom the camera", async ({
  page,
}) => {
  await page.goto("/?demo=camera_control");
  await expect(page.locator("#snap-camera-control")).toBeAttached();
  await expect(page.locator(engineSelector)).toBeVisible();

  await expect.poll(() => cameraScale(page)).toBeLessThan(0.95);

  const canvasBox = await page.locator(engineSelector).boundingBox();
  expect(canvasBox).not.toBeNull();

  const y = canvasBox!.y + canvasBox!.height / 2;
  const firstDown = { x: canvasBox!.x + canvasBox!.width / 2 - 140, y };
  const firstCurrent = { x: firstDown.x + 80, y };
  const secondCurrent = { x: firstCurrent.x + 260, y };

  await dispatchTouchPointer(page, "pointerdown", 1, firstDown, {
    isPrimary: true,
  });
  await dispatchTouchPointer(page, "pointermove", 1, firstCurrent, {
    isPrimary: true,
  });
  await dispatchTouchPointer(page, "pointerdown", 2, secondCurrent, {
    isPrimary: false,
  });

  const scaleBeforeStationaryPinch = await cameraScale(page);

  await dispatchTouchPointer(page, "pointermove", 1, firstCurrent, {
    isPrimary: true,
  });
  await dispatchTouchPointer(page, "pointermove", 2, secondCurrent, {
    isPrimary: false,
  });

  const scaleAfterStationaryPinch = await cameraScale(page);

  await dispatchTouchPointer(page, "pointerup", 1, firstCurrent, {
    isPrimary: true,
    buttons: 0,
  });
  await dispatchTouchPointer(page, "pointerup", 2, secondCurrent, {
    isPrimary: false,
    buttons: 0,
  });

  expect(scaleAfterStationaryPinch).toBeCloseTo(scaleBeforeStationaryPinch, 3);
});

test("pinch pans from the center point between two fingers", async ({
  page,
}) => {
  await page.goto("/?demo=camera_control");
  await expect(page.locator("#snap-camera-control")).toBeAttached();
  await expect(page.locator(engineSelector)).toBeVisible();

  await expect.poll(() => cameraScale(page)).toBeLessThan(0.95);

  const canvasBox = await page.locator(engineSelector).boundingBox();
  expect(canvasBox).not.toBeNull();

  const y = canvasBox!.y + canvasBox!.height / 2;
  const firstStart = { x: canvasBox!.x + canvasBox!.width / 2 - 180, y };
  const secondStart = { x: firstStart.x + 300, y };
  const movement = { x: 64, y: 36 };
  const firstEnd = {
    x: firstStart.x + movement.x,
    y: firstStart.y + movement.y,
  };
  const secondEnd = {
    x: secondStart.x + movement.x,
    y: secondStart.y + movement.y,
  };

  await dispatchTouchPointer(page, "pointerdown", 1, firstStart, {
    isPrimary: true,
  });
  await dispatchTouchPointer(page, "pointerdown", 2, secondStart, {
    isPrimary: false,
  });
  await dispatchTouchPointer(page, "pointermove", 1, firstStart, {
    isPrimary: true,
  });
  await dispatchTouchPointer(page, "pointermove", 2, secondStart, {
    isPrimary: false,
  });

  const transformBeforePan = await cameraTransform(page);

  await dispatchTouchPointer(page, "pointermove", 1, firstEnd, {
    isPrimary: true,
  });
  await dispatchTouchPointer(page, "pointermove", 2, secondEnd, {
    isPrimary: false,
  });

  await expect
    .poll(async () => (await cameraTransform(page)).scale)
    .toBeCloseTo(transformBeforePan.scale, 3);
  await expect
    .poll(async () => (await cameraTransform(page)).x - transformBeforePan.x)
    .toBeCloseTo(movement.x, 1);
  await expect
    .poll(async () => (await cameraTransform(page)).y - transformBeforePan.y)
    .toBeCloseTo(movement.y, 1);

  const transformAfterPan = await cameraTransform(page);

  await dispatchTouchPointer(page, "pointerup", 1, firstEnd, {
    isPrimary: true,
    buttons: 0,
  });
  await dispatchTouchPointer(page, "pointerup", 2, secondEnd, {
    isPrimary: false,
    buttons: 0,
  });

  expect(transformAfterPan.x - transformBeforePan.x).toBeCloseTo(movement.x, 1);
  expect(transformAfterPan.y - transformBeforePan.y).toBeCloseTo(movement.y, 1);
});

test("pinch zoom keeps the original world points under both fingers", async ({
  page,
}) => {
  await page.goto("/?demo=camera_control");
  await expect(page.locator("#snap-camera-control")).toBeAttached();
  await expect(page.locator(engineSelector)).toBeVisible();

  await expect.poll(() => cameraScale(page)).toBeLessThan(0.95);

  const canvasBox = await page.locator(engineSelector).boundingBox();
  expect(canvasBox).not.toBeNull();

  const x = Math.round(canvasBox!.x + canvasBox!.width / 2);
  const centerY = Math.round(canvasBox!.y + canvasBox!.height / 2);
  const firstStart = { x, y: centerY - 100 };
  const secondStart = { x, y: centerY + 100 };
  const firstEnd = { x, y: centerY - 150 };
  const secondEnd = { x, y: centerY + 130 };

  const firstWorldStart = await cameraWorldAt(page, firstStart);
  const secondWorldStart = await cameraWorldAt(page, secondStart);

  await dispatchTouchPointer(page, "pointerdown", 1, firstStart, {
    isPrimary: true,
  });
  await dispatchTouchPointer(page, "pointerdown", 2, secondStart, {
    isPrimary: false,
  });
  await dispatchTouchPointer(page, "pointermove", 1, firstStart, {
    isPrimary: true,
  });
  await dispatchTouchPointer(page, "pointermove", 2, secondStart, {
    isPrimary: false,
  });

  await dispatchTouchPointer(page, "pointermove", 1, firstEnd, {
    isPrimary: true,
  });
  await dispatchTouchPointer(page, "pointermove", 2, secondEnd, {
    isPrimary: false,
  });

  await expect
    .poll(async () => (await cameraWorldAt(page, firstEnd)).y)
    .toBeCloseTo(firstWorldStart.y, 1);
  await expect
    .poll(async () => (await cameraWorldAt(page, secondEnd)).y)
    .toBeCloseTo(secondWorldStart.y, 1);

  const firstWorldEnd = await cameraWorldAt(page, firstEnd);
  const secondWorldEnd = await cameraWorldAt(page, secondEnd);

  await dispatchTouchPointer(page, "pointerup", 1, firstEnd, {
    isPrimary: true,
    buttons: 0,
  });
  await dispatchTouchPointer(page, "pointerup", 2, secondEnd, {
    isPrimary: false,
    buttons: 0,
  });

  expect(firstWorldEnd.x).toBeCloseTo(firstWorldStart.x, 1);
  expect(firstWorldEnd.y).toBeCloseTo(firstWorldStart.y, 1);
  expect(secondWorldEnd.x).toBeCloseTo(secondWorldStart.x, 1);
  expect(secondWorldEnd.y).toBeCloseTo(secondWorldStart.y, 1);
});
