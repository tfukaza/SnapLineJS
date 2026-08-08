import { Engine } from "@snap-engine/core";

/** @type {Map<string, Engine>} */
const engineDict = new Map();

/**
 * @param {string} id
 * @returns {Engine}
 */
export function getEngine(id) {
  let engine = engineDict.get(id);
  if (!engine) {
    engine = new Engine();
    engineDict.set(id, engine);
  }
  return engine;
}

/**
 * Destroys and removes an engine created by getEngine.
 * @param {string} id
 * @returns {boolean}
 */
export function destroyEngine(id) {
  const engine = engineDict.get(id);
  if (!engine) return false;
  engineDict.delete(id);
  engine.destroy();
  return true;
}
