import type { ScreenToWorldMapper } from "./camera";
import { ZERO_EDGES, type Edges, type ElementBox, type Rect } from "./geometry";
import type { DomElement, TransformProperty } from "./object";

/**
 * Merges defined override values onto a complete defaults object.
 *
 * Unlike object spread, an explicit `undefined` does not replace a default.
 * Other falsy values such as `false`, `0`, `""`, and `null` are preserved.
 */
function mergeDefined<T extends object>(defaults: T, overrides: Partial<T>): T {
  const merged = { ...defaults };
  for (const key of Object.keys(overrides) as (keyof T)[]) {
    const value = overrides[key];
    if (value !== undefined) merged[key] = value as T[keyof T];
  }
  return merged;
}

/** The CSS edge thicknesses read from an element's computed style. */
interface MeasuredEdges {
  readonly margin: Edges;
  readonly padding: Edges;
  readonly border: Edges;
}

/** A frozen, all-zero element box used before the first DOM read. */
const EMPTY_ELEMENT_BOX: ElementBox = Object.freeze({
  x: 0,
  y: 0,
  width: 0,
  height: 0,
  screen: Object.freeze({ x: 0, y: 0, width: 0, height: 0 }),
  margin: ZERO_EDGES,
  padding: ZERO_EDGES,
  border: ZERO_EDGES,
});

function sameEdges(a: Edges, b: Edges): boolean {
  return (
    a.top === b.top &&
    a.right === b.right &&
    a.bottom === b.bottom &&
    a.left === b.left
  );
}

/** A frozen edge set, reusing `previous` or `ZERO_EDGES` when values match. */
function internEdges(
  top: number,
  right: number,
  bottom: number,
  left: number,
  previous: Edges | undefined,
): Edges {
  const edges = { top, right, bottom, left };
  if (previous && sameEdges(previous, edges)) return previous;
  if (sameEdges(ZERO_EDGES, edges)) return ZERO_EDGES;
  return Object.freeze(edges);
}

function readEdges(
  css: CSSStyleDeclaration,
  previous: ElementBox | undefined,
): MeasuredEdges {
  const px = (value: string) => parseFloat(value) || 0;
  return {
    margin: internEdges(
      px(css.marginTop),
      px(css.marginRight),
      px(css.marginBottom),
      px(css.marginLeft),
      previous?.margin,
    ),
    padding: internEdges(
      px(css.paddingTop),
      px(css.paddingRight),
      px(css.paddingBottom),
      px(css.paddingLeft),
      previous?.padding,
    ),
    border: internEdges(
      px(css.borderTopWidth),
      px(css.borderRightWidth),
      px(css.borderBottomWidth),
      px(css.borderLeftWidth),
      previous?.border,
    ),
  };
}

/**
 * Build an element box from a measured client rect and computed CSS edges.
 *
 * Pure: performs no DOM reads, so it can be exercised with a stub camera.
 * The box origin maps from screen to world space through `camera`; `screen`
 * keeps the client rect exactly as measured.
 */
function elementBoxFromMeasurement(
  camera: ScreenToWorldMapper | null,
  clientRect: Rect,
  edges: MeasuredEdges,
): ElementBox {
  let x = clientRect.x;
  let y = clientRect.y;
  if (camera) {
    const [cameraX, cameraY] = camera.getCameraFromScreen(x, y);
    [x, y] = camera.getWorldFromCamera(cameraX, cameraY);
  }
  return Object.freeze({
    x,
    y,
    width: clientRect.width,
    height: clientRect.height,
    screen: Object.freeze({
      x: clientRect.x,
      y: clientRect.y,
      width: clientRect.width,
      height: clientRect.height,
    }),
    margin: edges.margin,
    padding: edges.padding,
    border: edges.border,
  });
}

/**
 * Measure an element's box: its transformed client rect and computed CSS
 * margin, padding, and border widths.
 *
 * Forces layout, so call it only in a READ stage. Pass the element's
 * previous box to reuse unchanged edge objects.
 */
function measureElementBox(
  camera: ScreenToWorldMapper | null,
  element: DomElement,
  previous?: ElementBox,
): ElementBox {
  const rect = element.getBoundingClientRect();
  const css = window.getComputedStyle(element);
  return elementBoxFromMeasurement(
    camera,
    { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
    readEdges(css, previous),
  );
}

/**
 * Converts a transform object into a CSS transform string.
 *
 * Generates a translate3d and scale transformation for hardware acceleration.
 *
 * @param transform - The transform properties to convert.
 * @returns A CSS transform string.
 */
function generateTransformString(transform: TransformProperty) {
  const string = `translate3d(${transform.x}px, ${transform.y}px, 0px) scale(${transform.scaleX}, ${transform.scaleY}) `;
  return string;
}

/**
 * Parses a CSS transform string to extract position values.
 *
 * @param transform - A CSS transform string to parse.
 * @returns An object with x and y coordinates.
 */
function parseTransformString(transform: string) {
  const transformValues = transform.split("(")[1].split(")")[0].split(",");
  return {
    x: parseFloat(transformValues[0]),
    y: parseFloat(transformValues[1]),
    scaleX: parseFloat(transformValues[3]) || 1,
    scaleY: parseFloat(transformValues[4]) || 1,
  };
}

/**
 * Applies CSS styles to a DOM element.
 *
 * @param dom - The HTML or SVG element to style.
 * @param style - An object containing CSS property-value pairs.
 */
function setDomStyle(dom: DomElement, style: { [key: string]: string }) {
  Object.assign(dom.style, style);
}

type CallbackFunction = (...args: any[]) => void;

interface CallbackInterface extends Record<KeyType, CallbackFunction | null> {}

/**
 * Creates a proxy for event callbacks that automatically binds them to an object.
 *
 * When a callback function is assigned to the proxy, it's automatically bound to the
 * specified object, ensuring the correct `this` context during event handling.
 *
 * @param object - The object to bind callbacks to.
 * @param dict - The callback dictionary to proxy.
 * @param secondary - Optional secondary callback dictionary for fallback.
 * @returns A proxy that handles callback binding automatically.
 * ```
 */
function EventProxyFactory<BindObject, Callback extends object>(
  object: BindObject,
  dict: Callback,
  secondary: Callback | null = null,
): Callback {
  return new Proxy(dict, {
    set: (
      target: Callback,
      prop: keyof Callback & KeyType,
      value: CallbackFunction | null,
    ) => {
      if (value == null) {
        target[prop] = null as any;
      } else {
        target[prop] = value.bind(object) as any;
      }
      return true;
    },
    get: (
      target: Callback & CallbackInterface,
      prop: keyof Callback & KeyType,
    ) => {
      return (...args: any[]) => {
        target[prop]?.(...args);
        (secondary as Callback & CallbackInterface)?.[prop]?.(...args);
      };
    },
  });
}

export type { MeasuredEdges };
export {
  setDomStyle,
  EventProxyFactory,
  EMPTY_ELEMENT_BOX,
  measureElementBox,
  elementBoxFromMeasurement,
  generateTransformString,
  parseTransformString,
  mergeDefined,
};
