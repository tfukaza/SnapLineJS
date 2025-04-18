import { toNamespacedPath } from "node:path/win32";
import { BaseObject, frameStats } from "./object";

interface AnimationProperty {
  from: number;
  to: number;
  duration: number;
  delay?: number;
  easing?: string;
  setValue?: (value: number) => void;
  onStart?: () => void;
  onFinish?: () => void;
}

interface AnimationInterface {
  start(startTime: number | null): void;
  calculateFrame(currentTime: number): boolean;
  cancel(): void;
}

class AnimationObject implements AnimationInterface {
  owner: BaseObject;
  property: AnimationProperty;
  startTime: number;
  endTime: number;
  animation: Animation | null;
  hasStarted: boolean;
  expired: boolean;

  constructor(owner: BaseObject, property: AnimationProperty) {
    this.owner = owner;
    this.property = property;
    this.startTime = -1;
    this.endTime = -1;
    this.animation = null;
    this.hasStarted = false;
    this.expired = false;
  }

  start(startTime: number | null = null) {
    this.startTime = startTime ?? Date.now();
    this.endTime =
      this.startTime + this.property.duration + (this.property.delay ?? 0);
    if (this.property.setValue) {
      this.property.setValue(this.property.from);
    }

    this.animation = new Animation(
      new KeyframeEffect(
        this.owner.global.animationFragment,
        [{ nonExistentProperty: 0 }, { nonExistentProperty: 1 }],
        {
          duration: this.property.duration,
          easing: this.property.easing,
          delay: this.property.delay ?? 0,
        },
      ),
    );
    this.animation.onfinish = () => {
      this.animation?.cancel();
    };
    this.animation.currentTime = 0;
  }

  calculateFrame(currentTime: number): boolean {
    if (this.expired) {
      return true;
    }
    let elapsedTime = currentTime - this.startTime;
    // console.log("Elapsed time", elapsedTime);
    this.animation!.currentTime = elapsedTime;
    const alpha = this.animation!.effect!.getComputedTiming().progress ?? 1;
    const value =
      this.property.from + (this.property.to - this.property.from) * alpha;
    if (this.property.setValue) {
      if (elapsedTime < (this.property.delay ?? 0)) {
        this.property.setValue(this.property.from);
      } else {
        this.property.setValue(value);
      }
    }

    if (!this.hasStarted && elapsedTime >= (this.property.delay ?? 0)) {
      this.hasStarted = true;
      this.property.onStart?.();
    }

    if (elapsedTime >= this.property.duration + (this.property.delay ?? 0)) {
      // console.log(
      //   "Animation finished",
      //   elapsedTime,
      //   this.property.duration,
      //   this.property.delay,
      //   this.property.onFinish,
      // );
      this.property.onFinish?.();
      this.cancel();
      return true;
    }
    return false;
  }

  cancel() {
    // console.log("Cancelling animation");
    this.animation?.cancel();
    this.expired = true;
  }
}

// interface TimelineAnimation {
//   offset: number;
//   animation: AnimationObject;
// }

class TimelineObject implements AnimationInterface {
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
    let prevEndTime = 0;
    if (this.animations.length > 0) {
      let prevAnimation = this.animations[this.animations.length - 1];
      prevEndTime =
        (prevAnimation.property.delay ?? 0) + prevAnimation.property.duration;
      if (!animation.property.delay) {
        animation.property.delay = prevEndTime;
      }
    }
    this.animations.push(animation);
    this.endTime = Math.max(
      this.endTime,
      prevEndTime +
        animation.property.duration +
        (animation.property.delay ?? 0),
    );
  }

  start(startTime: number | null = null) {
    this.startTime = startTime ?? Date.now();
    for (let i = 0; i < this.animations.length; i++) {
      this.animations[i].start(this.startTime);
      // console.log(
      //   "Starting animation with delay",
      //   this.animations[i].property.delay,
      // );
    }
  }

  calculateFrame(currentTime: number): boolean {
    if (this.expired) {
      return true;
    }
    for (let i = 0; i < this.animations.length; i++) {
      let animation = this.animations[i];
      // if (currentTime >= animation.startTime) {
      animation.calculateFrame(currentTime);
      // }
    }
    let elapsedTime = currentTime - this.startTime;
    // console.log("Comparing timeline", elapsedTime, this.endTime);
    if (elapsedTime >= this.endTime) {
      this.cancel();
      return true;
    }
    return false;
  }

  cancel() {
    // console.log("Cancelling timeline");
    this.expired = true;
    for (let i = 0; i < this.animations.length; i++) {
      this.animations[i].animation?.cancel();
    }
  }
}

export { AnimationObject, TimelineObject };
export type { AnimationProperty };
