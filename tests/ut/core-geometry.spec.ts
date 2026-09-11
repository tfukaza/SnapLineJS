import { expect, test } from "@playwright/test";
import {
  addEdges,
  boundingRect,
  boundsOf,
  contentOffset,
  contentRect,
  distance,
  edgesToCss,
  freezePoint,
  freezeRect,
  insetRect,
  lerpRect,
  marginRect,
  outsetRect,
  paddingRect,
  projectRect,
  projectRects,
  rectArea,
  rectCenter,
  rectContainsRect,
  rectsEqual,
  translateRect,
  ZERO_EDGES,
  type BoxModel,
} from "../../src/geometry";

const box: BoxModel = {
  x: 10,
  y: 20,
  width: 100,
  height: 60,
  margin: { top: 1, right: 2, bottom: 3, left: 4 },
  padding: { top: 5, right: 6, bottom: 7, left: 8 },
  border: { top: 1, right: 1, bottom: 2, left: 2 },
};

test.describe("box model", () => {
  test("content and padding boxes inset the border box", () => {
    expect(paddingRect(box)).toEqual({ x: 12, y: 21, width: 97, height: 57 });
    expect(contentRect(box)).toEqual({ x: 20, y: 26, width: 83, height: 45 });
    expect(contentOffset(box)).toEqual({ x: 10, y: 6 });
  });

  test("margin box outsets the border box", () => {
    expect(marginRect(box)).toEqual({ x: 6, y: 19, width: 106, height: 64 });
  });

  test("insets clamp the size at zero and outsets invert them", () => {
    const edges = { top: 40, right: 40, bottom: 40, left: 40 };
    expect(insetRect(box, edges)).toEqual({
      x: 50,
      y: 60,
      width: 20,
      height: 0,
    });
    const content = contentRect(box);
    expect(outsetRect(content, addEdges(box.border, box.padding))).toEqual({
      x: box.x,
      y: box.y,
      width: box.width,
      height: box.height,
    });
  });

  test("edges format as CSS shorthand", () => {
    expect(edgesToCss(box.margin)).toBe("1px 2px 3px 4px");
    expect(Object.isFrozen(ZERO_EDGES)).toBe(true);
  });
});

test.describe("rect helpers", () => {
  const a = { x: 0, y: 0, width: 10, height: 20 };
  const b = { x: 30, y: 5, width: 10, height: 10 };

  test("bounding rect covers every input and is null when empty", () => {
    expect(boundingRect([a, b])).toEqual({ x: 0, y: 0, width: 40, height: 20 });
    expect(boundingRect([])).toBeNull();
  });

  test("freezePoint copies only point fields", () => {
    const point = freezePoint({ x: 1, y: 2, ...{ extra: true } });
    expect(point).toEqual({ x: 1, y: 2 });
    expect(Object.isFrozen(point)).toBe(true);
  });

  test("freeze and bounds copy only rectangle fields", () => {
    const frozen = freezeRect(box);
    expect(frozen).toEqual({ x: 10, y: 20, width: 100, height: 60 });
    expect(Object.isFrozen(frozen)).toBe(true);
    expect(boundsOf(a)).toEqual({
      x: 0,
      y: 0,
      width: 10,
      height: 20,
      left: 0,
      top: 0,
      right: 10,
      bottom: 20,
    });
  });

  test("measures", () => {
    expect(rectCenter(a)).toEqual({ x: 5, y: 10 });
    expect(rectArea(a)).toBe(200);
    expect(distance({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  test("containment is edge-inclusive", () => {
    expect(rectContainsRect(a, a)).toBe(true);
    expect(rectContainsRect(a, { x: 1, y: 1, width: 9, height: 19 })).toBe(
      true,
    );
    expect(rectContainsRect(a, { x: 1, y: 1, width: 10, height: 1 })).toBe(
      false,
    );
  });

  test("equality honors tolerance", () => {
    const nudged = { x: 0.01, y: 0, width: 10, height: 20 };
    expect(rectsEqual(a, nudged)).toBe(false);
    expect(rectsEqual(a, nudged, 0.05)).toBe(true);
  });

  test("translate and lerp", () => {
    expect(translateRect(a, 5, -5)).toEqual({
      x: 5,
      y: -5,
      width: 10,
      height: 20,
    });
    expect(lerpRect(a, b, 0.5)).toEqual({
      x: 15,
      y: 2.5,
      width: 10,
      height: 15,
    });
  });

  test("projection maps between frames by size ratio", () => {
    const from = { x: 0, y: 0, width: 100, height: 100 };
    const to = { x: 50, y: 50, width: 50, height: 200 };
    expect(
      projectRect({ x: 10, y: 10, width: 20, height: 20 }, from, to),
    ).toEqual({ x: 55, y: 70, width: 10, height: 40 });
    expect(projectRects([from], from, to)).toEqual([to]);
  });

  test("projection from a degenerate frame keeps scale 1", () => {
    const from = { x: 0, y: 0, width: 0, height: 10 };
    const to = { x: 5, y: 0, width: 40, height: 20 };
    expect(projectRect({ x: 0, y: 5, width: 0, height: 5 }, from, to)).toEqual({
      x: 5,
      y: 10,
      width: 0,
      height: 10,
    });
  });
});
