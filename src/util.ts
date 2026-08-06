import type { DomElement, DomProperty, TransformProperty } from "./object";

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

/**
 * Retrieves the position and dimensions of a DOM element in multiple coordinate spaces.
 *
 * Returns coordinates in world space (accounting for camera transform), camera space,
 * and screen space, along with transformed dimensions.
 *
 * @param engine - The engine instance containing camera information.
 * @param dom - The HTML element to measure.
 * @returns An object containing position and size in various coordinate systems.
 */
function getDomProperty(engine: any, dom: DomElement) {
  const rect = dom.getBoundingClientRect();
  const css = window.getComputedStyle(dom);
  const margin_top = parseFloat(css.marginTop) || 0;
  const margin_right = parseFloat(css.marginRight) || 0;
  const margin_bottom = parseFloat(css.marginBottom) || 0;
  const margin_left = parseFloat(css.marginLeft) || 0;
  const padding_top = parseFloat(css.paddingTop) || 0;
  const padding_right = parseFloat(css.paddingRight) || 0;
  const padding_bottom = parseFloat(css.paddingBottom) || 0;
  const padding_left = parseFloat(css.paddingLeft) || 0;
  const border_top = parseFloat(css.borderTopWidth) || 0;
  const border_right = parseFloat(css.borderRightWidth) || 0;
  const border_bottom = parseFloat(css.borderBottomWidth) || 0;
  const border_left = parseFloat(css.borderLeftWidth) || 0;

  if (engine == null || engine.camera == null) {
    return {
      height: rect.height,
      width: rect.width,
      x: rect.left,
      y: rect.top,
      cameraX: rect.left,
      cameraY: rect.top,
      screenX: rect.left,
      screenY: rect.top,
      margin: {
        top: margin_top,
        right: margin_right,
        bottom: margin_bottom,
        left: margin_left,
      },
      padding: {
        top: padding_top,
        right: padding_right,
        bottom: padding_bottom,
        left: padding_left,
      },
      border: {
        top: border_top,
        right: border_right,
        bottom: border_bottom,
        left: border_left,
      },
    };
  }
  const [cameraX, cameraY] = engine.camera.getCameraFromScreen(
    rect.left,
    rect.top,
  );
  const [worldX, worldY] = engine.camera.getWorldFromCamera(cameraX, cameraY);
  const [cameraWidth, cameraHeight] =
    engine.camera.getCameraDeltaFromWorldDelta(rect.width, rect.height);
  const [worldWidth, worldHeight] = engine.camera.getWorldDeltaFromCameraDelta(
    cameraWidth,
    cameraHeight,
  );

  return {
    height: worldHeight,
    width: worldWidth,
    x: worldX,
    y: worldY,
    cameraX: cameraX,
    cameraY: cameraY,
    screenX: rect.left,
    screenY: rect.top,
    margin: {
      top: margin_top,
      right: margin_right,
      bottom: margin_bottom,
      left: margin_left,
    },
    padding: {
      top: padding_top,
      right: padding_right,
      bottom: padding_bottom,
      left: padding_left,
    },
    border: {
      top: border_top,
      right: border_right,
      bottom: border_bottom,
      left: border_left,
    },
  };
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

function cloneDomProperty(prop: DomProperty): DomProperty {
  return {
    x: prop.x,
    y: prop.y,
    height: prop.height,
    width: prop.width,
    scaleX: prop.scaleX,
    scaleY: prop.scaleY,
    screenX: prop.screenX,
    screenY: prop.screenY,
    margin: { ...prop.margin },
    padding: { ...prop.padding },
    border: { ...prop.border },
  };
}

export {
  setDomStyle,
  EventProxyFactory,
  getDomProperty,
  cloneDomProperty,
  generateTransformString,
  parseTransformString,
  mergeDefined,
};
