import { BaseObject, ElementObject } from "./object";

type cssValue =
  | string
  | number
  | string[]
  | (number | null)[]
  | null
  | undefined;
export type keyframeList = Record<string, cssValue>;

export interface keyframeProperty {
  offset?: (number | string)[];
  easing?: string | string[];
  duration?: number;
  delay?: number;
  tick?: (value: Record<string, number>) => void;
}

interface AnimationInterface {
  play(): void;
  pause(): void;
  cancel(): void;
  reverse(): void;
  calculateFrame(currentTime: number): boolean;
  currentTime: number;
  progress: number;
}

class AnimationObject implements AnimationInterface {
  owner: BaseObject;
  keyframe: keyframeList;
  property: keyframeProperty;

  #variables: Record<string, number[]>;
  #animation: Animation | null;
  #varAnimation: Animation[] | null;
  #offset: number[];
  #easing: string[];
  #duration: number[];
  #delay: number;
  #hasVariable: boolean;

  constructor(
    owner: BaseObject,
    keyframe: keyframeList,
    property: keyframeProperty,
  ) {
    this.owner = owner;
    this.keyframe = keyframe;
    this.property = property;

    this.#animation = null;
    if (!this.property.duration) {
      this.property.duration = 1000;
    }
    if (!this.property.delay) {
      this.property.delay = 0;
    }
    let numKeys = 0;
    for (const [key, value] of Object.entries(this.keyframe)) {
      const len = Array.isArray(value) ? value.length : 1;
      numKeys = Math.max(numKeys, len);
    }
    if (!this.property.offset) {
      this.#offset = [];
      for (let i = 0; i < numKeys; i++) {
        this.#offset.push(i / (numKeys - 1));
      }
    } else {
      this.#offset = this.property.offset as number[];
    }
    if (!this.property.easing) {
      this.#easing = ["linear"];
    } else {
      if (Array.isArray(this.property.easing)) {
        this.#easing = this.property.easing;
      } else {
        this.#easing = [this.property.easing];
      }
    }
    if (!this.property.duration) {
      this.#duration = [this.property.duration];
    } else {
      if (Array.isArray(this.property.duration)) {
        this.#duration = this.property.duration;
      } else {
        this.#duration = [this.property.duration];
      }
    }
    if (!this.property.delay) {
      this.#delay = 0;
    } else {
      this.#delay = this.property.delay;
    }

    this.#variables = {};
    this.#varAnimation = [];

    this.#hasVariable =
      Object.keys(this.keyframe).filter((key) => {
        return key.startsWith("$");
      }).length > 0;

    // Remove keys that start with $, and create a new keyframe
    let cssKeyframe: PropertyIndexedKeyframes = {};
    for (const [key, value] of Object.entries(this.keyframe)) {
      if (!key.startsWith("$")) {
        cssKeyframe[key] = value;
      } else {
        this.#variables[key] = value as number[];
      }
    }

    if (this.#hasVariable && Object.keys(cssKeyframe).length == 0) {
      cssKeyframe = {};
    }

    if (this.property.offset) {
      // TODO: Convert string offset to number
      cssKeyframe.offset = this.property.offset as number[];
    }

    const target =
      this.owner instanceof ElementObject
        ? this.owner.dom.element
        : this.owner.global.animationFragment;

    const animationProperty: KeyframeEffectOptions = {
      delay: this.#delay,
      fill: "both",
    };

    if (this.#duration.length > 1) {
      cssKeyframe.duration = this.#duration;
    } else {
      animationProperty.duration = this.#duration[0];
    }

    if (this.#easing.length > 1) {
      cssKeyframe.easing = this.#easing;
    } else {
      animationProperty.easing = this.#easing[0];
    }

    this.#animation = new Animation(
      new KeyframeEffect(target, cssKeyframe, animationProperty),
    );
    this.#animation.onfinish = () => {
      this.finish();
    };

    // As of April 2025, there seems to be a bug in Chrome where
    // getComputedTiming().progress returns the linear time interpolation
    // instead of the actual animation progress calculated from the easing function,
    // if the easing function is specified per key rather than globally for all keyframes.
    // To work around this, we create individual animations for each keyframe interval.
    this.#varAnimation = [];
    if (this.#hasVariable && this.#easing.length > 1) {
      for (let i = 0; i < this.#offset.length - 1; i++) {
        const intervalKeys: Record<string, number[]> = {};
        for (const [key, value] of Object.entries(this.#variables)) {
          intervalKeys[key] = value.slice(i, i + 1) as number[];
        }
        const intervalDuration =
          (this.#offset[i + 1] - this.#offset[i]) * this.property.duration!;
        const intervalDelay =
          this.#offset[i] * this.property.duration! + this.property.delay!;
        const intervalEasing = this.#easing[i];
        const animation = new Animation(
          new KeyframeEffect(target, intervalKeys, {
            duration: intervalDuration,
            delay: intervalDelay,
            easing: intervalEasing,
            fill: "both",
          }),
        );
        animation.onfinish = () => {
          animation.cancel();
        };
        animation.persist();
        this.#varAnimation.push(animation);
      }
    }
  }

  pause() {
    this.#animation!.pause();
    for (let i = 0; i < this.#varAnimation!.length; i++) {
      this.#varAnimation![i].pause();
    }
  }

  play() {
    this.#animation!.play();
    for (let i = 0; i < this.#varAnimation!.length; i++) {
      this.#varAnimation![i].play();
    }
  }

  cancel() {
    this.#animation!.cancel();
    for (let i = 0; i < this.#varAnimation!.length; i++) {
      this.#varAnimation![i].cancel();
    }
  }

  reverse() {
    this.#animation!.reverse();
    for (let i = 0; i < this.#varAnimation!.length; i++) {
      this.#varAnimation![i].reverse();
    }
  }

  calculateFrame(currentTime: number): boolean {
    const alpha = this.#animation!.effect!.getComputedTiming().progress ?? 0;
    const alphaElapsedTime =
      this.property.duration! * alpha + this.property.delay!;
    if (this.#hasVariable) {
      let currentKey = 0;
      for (let i = 0; i < this.#offset.length - 1; i++) {
        if (this.#offset[i] <= alpha && alpha < this.#offset[i + 1]) {
          currentKey = i;
          break;
        }
      }
      let localAlpha = alpha;
      if (this.#easing.length > 1) {
        const currentVarAnimation = this.#varAnimation![currentKey];
        currentVarAnimation.currentTime = alphaElapsedTime;
        localAlpha =
          currentVarAnimation.effect!.getComputedTiming().progress ?? 0;
      }
      const varValues: Record<string, number> = {};
      for (const [key, value] of Object.entries(this.#variables)) {
        const varFrom = value[currentKey];
        const varTo = value[currentKey + 1];
        const varValue = varFrom + (varTo - varFrom) * localAlpha;
        varValues[key] = varValue;
      }
      this.property.tick?.(varValues);
    }
    return false;
  }

  finish() {
    this.#animation?.commitStyles();
  }

  set currentTime(time: number) {
    this.#animation!.currentTime = time;
    for (let i = 0; i < this.#varAnimation!.length; i++) {
      this.#varAnimation![i].currentTime = time;
    }
  }

  set progress(progress: number) {
    this.currentTime =
      (this.property.duration! + this.property.delay!) * progress;
  }
}

class SequenceObject implements AnimationInterface {
  animations: AnimationObject[];
  startTime: number;
  endTime: number;
  expired: boolean;

  constructor() {
    this.animations = [];
    this.startTime = -1;
    this.endTime = -1;
    this.expired = false;
  }

  add(animation: AnimationObject) {
    this.animations.push(animation);
  }

  play() {
    for (let i = 0; i < this.animations.length; i++) {
      this.animations[i].play();
    }
  }

  pause() {
    for (let i = 0; i < this.animations.length; i++) {
      this.animations[i].pause();
    }
  }

  cancel() {
    for (let i = 0; i < this.animations.length; i++) {
      this.animations[i].cancel();
    }
  }

  reverse() {
    for (let i = 0; i < this.animations.length; i++) {
      this.animations[i].reverse();
    }
  }

  calculateFrame(currentTime: number): boolean {
    let result = false;
    for (let i = 0; i < this.animations.length; i++) {
      result = this.animations[i].calculateFrame(currentTime) || result;
    }
    return result;
  }

  set currentTime(time: number) {
    for (let i = 0; i < this.animations.length; i++) {
      this.animations[i].currentTime = time;
    }
  }

  set progress(progress: number) {
    for (let i = 0; i < this.animations.length; i++) {
      this.animations[i].progress = progress;
    }
  }
}

export { AnimationObject, SequenceObject };
