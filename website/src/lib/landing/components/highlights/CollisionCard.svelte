<script lang="ts">
  import CardDocsLink from "./CardDocsLink.svelte";
  import type { Action } from "svelte/action";
  import ClientDemoFrame from "$lib/components/ClientDemoFrame.svelte";
  import { Engine } from "@snap-engine/asset-base/svelte";
  import { CircleCollider, RectCollider } from "@snap-engine/core/collision";
  import type { Collider } from "@snap-engine/core/collision";
  import { ElementObject } from "@snap-engine/core";
  import type { Engine as EngineType } from "@snap-engine/core";
  import { debugState } from "$lib/landing/debugState.svelte";
  import collisionDotMatrix from "../../../../../static/generated/collision-detection-dot-matrix.json";

  type Dot = {
    x: number;
    y: number;
    key: string;
  };
  type CollisionDotMatrix = {
    columns: number;
    rows: number;
    dots: Array<{ x: number; y: number }>;
  };
  type TargetCollisionKind = "square" | "circle";

  const GENERATED_DOT_MATRIX = collisionDotMatrix as CollisionDotMatrix;
  const BOX_SIZE = 168;
  const CIRCLE_SIZE = 144;
  const DOT_DISPLACEMENT_MIN = 4;
  const DOT_DISPLACEMENT_MAX = 30;
  const DOT_DISPLACEMENT_POWER = 1.45;
  const DOT_SQUARE_CORNER_BONUS = 18;
  const ACTIVE_DISPLACEMENT_EPSILON = 0.01;
  const DESCRIPTION_DISPLACEMENT_MIN = 3;
  const DESCRIPTION_DISPLACEMENT_MAX = 22;
  const DESCRIPTION_DISPLACEMENT_POWER = 1.35;
  const DESCRIPTION_SQUARE_CORNER_BONUS = 12;
  const TARGET_COMBINED_COLOR = "#8f3dff";
  // Replaced by a measurement of the real handle once the first READ_1 runs.
  const KNOB_RADIUS_FALLBACK = 16;
  // Concentric rings drawn as a fraction of the target's radius.
  const FORCE_FIELD_RING_COUNT = 8;
  // Small enough that rings emerge from behind the drag handle.
  const FORCE_FIELD_INNER_SCALE = 0.08;
  const FORCE_FIELD_DURATION_MS = 4200;
  const FORCE_FIELD_RINGS = Array.from(
    { length: FORCE_FIELD_RING_COUNT },
    (_, index) => {
      const step = (index + 1) / FORCE_FIELD_RING_COUNT;
      const distanceFromCentre = index / (FORCE_FIELD_RING_COUNT - 1);
      return {
        // Static fallback only — the animation drives these when motion is allowed.
        // The exponent widens each gap, and the last ring lands on the collider edge.
        scale:
          FORCE_FIELD_INNER_SCALE +
          (1 - FORCE_FIELD_INNER_SCALE) * step ** 1.5,
        fade: 0.6 - distanceFromCentre * 0.52,
        // A negative delay starts each ring mid-flight, so the field is already
        // full on first paint instead of emitting the first ring from scratch.
        delayMs: -(index / FORCE_FIELD_RING_COUNT) * FORCE_FIELD_DURATION_MS,
      };
    },
  );
  const DESCRIPTION_TEXT = "Built-in collision engine to detect overlaps and contacts.";
  const descriptionCharacters = Array.from(DESCRIPTION_TEXT).map((character, index) => ({
    character,
    key: `${character}-${index}`,
  }));
  const dots: Dot[] = GENERATED_DOT_MATRIX.dots.map((dot) => ({
    ...dot,
    key: `${dot.x}-${dot.y}`,
  }));

  let engine: EngineType | null = $state(null);
  let stageElement: HTMLDivElement | null = $state(null);
  let descriptionDisplacementUpdateQueued = false;
  const descriptionCharacterObjects = new WeakMap<HTMLElement, ElementObject>();
  const descriptionCharacterClassLists = new WeakMap<HTMLElement, string[]>();
  const gridColumns = GENERATED_DOT_MATRIX.columns;
  const gridRows = GENERATED_DOT_MATRIX.rows;

  function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
  }

  type TargetHandle = {
    kind: TargetCollisionKind;
    element: HTMLElement;
    object: ElementObject;
    fieldCollider: Collider;
    knobCollider: CircleCollider;
    /** Constant offset from object.worldTransform to the knob's world centre. */
    centerOffset: number;
  };

  // Keyed by the FIELD collider only. Each target also owns a knob collider on the
  // same object and therefore the same element, so an element-based lookup cannot
  // tell them apart. Keeping this an allowlist means any collider added to a target
  // later is ignored by the dots by default, rather than by remembering to exclude it.
  const targetHandles = new Map<Collider, TargetHandle>();

  function getCollisionTargetKind(collider: Collider): TargetCollisionKind | null {
    return targetHandles.get(collider)?.kind ?? null;
  }

  function isCollisionTarget(collider: Collider) {
    return targetHandles.has(collider);
  }

  function setObjectActiveClass(
    object: ElementObject | null | undefined,
    baseClassList: string[],
    isActive: boolean,
  ) {
    if (!object) {
      return;
    }

    const nextClassList = isActive
      ? Array.from(new Set([...baseClassList, "is-active"]))
      : baseClassList;
    object.classList = nextClassList;
    object.writeDom();
  }

  function rectsOverlap(a: DOMRect, b: DOMRect) {
    return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }

  function getLayoutRect(element: HTMLElement) {
    const offsetParent = element.offsetParent as HTMLElement | null;
    if (!offsetParent) {
      return element.getBoundingClientRect();
    }

    const parentRect = offsetParent.getBoundingClientRect();
    return new DOMRect(
      parentRect.left + element.offsetLeft,
      parentRect.top + element.offsetTop,
      element.offsetWidth,
      element.offsetHeight,
    );
  }

  function getTargetElementKind(element: HTMLElement): TargetCollisionKind | null {
    if (element.classList.contains("collision-target--square")) {
      return "square";
    }
    if (element.classList.contains("collision-target--circle")) {
      return "circle";
    }
    return null;
  }

  function getDescriptionSquareCornerBonus(
    textCenter: { x: number; y: number },
    targetCenter: { x: number; y: number },
    targetRect: DOMRect,
    direction: { x: number; y: number },
  ) {
    const halfWidth = targetRect.width / 2;
    const halfHeight = targetRect.height / 2;
    const minHalfSize = Math.min(halfWidth, halfHeight);
    const absDirectionX = Math.abs(direction.x);
    const absDirectionY = Math.abs(direction.y);
    const rayBoundaryDistance = Math.min(
      absDirectionX > 0.001 ? halfWidth / absDirectionX : Number.POSITIVE_INFINITY,
      absDirectionY > 0.001 ? halfHeight / absDirectionY : Number.POSITIVE_INFINITY,
    );
    const angleBoost = clamp(rayBoundaryDistance / minHalfSize, 1, Math.SQRT2);
    const localX = clamp(Math.abs(textCenter.x - targetCenter.x) / halfWidth, 0, 1);
    const localY = clamp(Math.abs(textCenter.y - targetCenter.y) / halfHeight, 0, 1);
    const cornerCloseness = Math.sqrt(localX * localY);
    const normalizedAngleBoost = clamp((angleBoost - 1) / (Math.SQRT2 - 1), 0, 1);

    return cornerCloseness * normalizedAngleBoost * DESCRIPTION_SQUARE_CORNER_BONUS;
  }

  function updateDescriptionTextDisplacements() {
    if (!stageElement) {
      return;
    }

    const characters = Array.from(
      stageElement.querySelectorAll<HTMLElement>(".collision-description-character"),
    );
    const targets = Array.from(stageElement.querySelectorAll<HTMLElement>(".collision-target"));

    for (const character of characters) {
      const textRect = getLayoutRect(character);
      const textCenter = {
        x: textRect.left + textRect.width / 2,
        y: textRect.top + textRect.height / 2,
      };
      let displacementX = 0;
      let displacementY = 0;

      for (const target of targets) {
        const targetKind = getTargetElementKind(target);
        if (!targetKind) {
          continue;
        }

        const targetRect = target.getBoundingClientRect();
        if (!rectsOverlap(textRect, targetRect)) {
          continue;
        }

        const targetCenter = {
          x: targetRect.left + targetRect.width / 2,
          y: targetRect.top + targetRect.height / 2,
        };
        const awayX = textCenter.x - targetCenter.x;
        const awayY = textCenter.y - targetCenter.y;
        const distance = Math.hypot(awayX, awayY);
        const direction =
          distance > 0.001
            ? { x: awayX / distance, y: awayY / distance }
            : { x: 1, y: 0 };
        const influenceRadius = Math.max(targetRect.width, targetRect.height) * 0.8;
        const closeness = clamp(1 - distance / influenceRadius, 0, 1);
        const distanceFactor = Math.pow(closeness, DESCRIPTION_DISPLACEMENT_POWER);
        const displacement =
          DESCRIPTION_DISPLACEMENT_MIN +
          distanceFactor * (DESCRIPTION_DISPLACEMENT_MAX - DESCRIPTION_DISPLACEMENT_MIN) +
          (targetKind === "square"
            ? getDescriptionSquareCornerBonus(textCenter, targetCenter, targetRect, direction)
            : 0);
        const cappedDisplacement = Math.min(displacement, DESCRIPTION_DISPLACEMENT_MAX);

        displacementX += direction.x * cappedDisplacement;
        displacementY += direction.y * cappedDisplacement;
      }

      const displacementLength = Math.hypot(displacementX, displacementY);
      if (displacementLength > DESCRIPTION_DISPLACEMENT_MAX) {
        const clampFactor = DESCRIPTION_DISPLACEMENT_MAX / displacementLength;
        displacementX *= clampFactor;
        displacementY *= clampFactor;
      }

      const isActive = displacementLength > ACTIVE_DISPLACEMENT_EPSILON;
      const characterObject = descriptionCharacterObjects.get(character);
      const baseClassList =
        descriptionCharacterClassLists.get(character) ?? ["collision-description-character"];
      characterObject?.schedule(
        () => {
          setObjectActiveClass(characterObject, baseClassList, isActive);
          character.style.transform = isActive
            ? `translate(${displacementX.toFixed(2)}px, ${displacementY.toFixed(2)}px)`
            : "";
        },
        { stage: "WRITE_2", queueId: "description-character-displacement" },
      );
    }
  }

  function scheduleDescriptionDisplacementUpdate() {
    if (descriptionDisplacementUpdateQueued || typeof requestAnimationFrame === "undefined") {
      return;
    }

    descriptionDisplacementUpdateQueued = true;
    requestAnimationFrame(() => {
      descriptionDisplacementUpdateQueued = false;
      updateDescriptionTextDisplacements();
    });
  }

  const stageRef: Action<HTMLDivElement> = (node) => {
    stageElement = node;
    scheduleDescriptionDisplacementUpdate();

    return {
      destroy() {
        if (stageElement === node) {
          stageElement = null;
        }
      },
    };
  };

  const circleColliderRef: Action<
    HTMLDivElement,
    { engine: EngineType | null }
  > = (
    node,
    params,
  ) => {
    let object: ElementObject | null = null;
    let collider: CircleCollider | null = null;
    const baseClassList = Array.from(node.classList);
    const activeTargetCollisions = new Set<Collider>();
    // Last values written to the DOM, so unchanged frames cost nothing.
    let lastTransform = "";
    let lastHeat = "";
    let lastBlend = "";
    const previousTargetCenters = new Map<symbol, { x: number; y: number }>();

    function getDotCenter() {
      const offsetParent = node.offsetParent as HTMLElement | null;
      if (!offsetParent) {
        const rect = node.getBoundingClientRect();
        return {
          x: rect.left + rect.width / 2,
          y: rect.top + rect.height / 2,
        };
      }

      const parentRect = offsetParent.getBoundingClientRect();
      return {
        x: parentRect.left + node.offsetLeft + node.offsetWidth / 2,
        y: parentRect.top + node.offsetTop + node.offsetHeight / 2,
      };
    }

    function getFallbackDirection(targetCenter: { x: number; y: number }, target: Collider) {
      const previousCenter = previousTargetCenters.get(target.id);
      const motionX = previousCenter ? targetCenter.x - previousCenter.x : 0;
      const motionY = previousCenter ? targetCenter.y - previousCenter.y : 0;
      const motionDistance = Math.hypot(motionX, motionY);
      if (motionDistance > 0.001) {
        return { x: motionX / motionDistance, y: motionY / motionDistance };
      }

      const offsetParent = node.offsetParent as HTMLElement | null;
      if (offsetParent) {
        const parentX = node.offsetLeft - offsetParent.clientWidth / 2;
        const parentY = node.offsetTop - offsetParent.clientHeight / 2;
        const parentDistance = Math.hypot(parentX, parentY);
        if (parentDistance > 0.001) {
          return { x: parentX / parentDistance, y: parentY / parentDistance };
        }
      }

      return { x: 1, y: 0 };
    }

    function setDotDisplacement(x: number, y: number, heat = 0, blend = 0) {
      object?.schedule(
        () => {
          const displacementLength = Math.hypot(x, y);
          const isDisplaced = displacementLength > ACTIVE_DISPLACEMENT_EPSILON;
          // Opposing fields cancel to no displacement while the dot is still lit,
          // so heat has to be able to keep the dot active on its own.
          const isActive = isDisplaced || heat > ACTIVE_DISPLACEMENT_EPSILON;
          // No `is-active` class here: nothing styles it on dots now that the
          // transition is gone, and writeDom() on every dot is not free.

          // Every write here costs this dot a style recalc and a repaint, and there
          // are hundreds of them per frame, so skip writes that change nothing.
          const nextTransform = isDisplaced
            ? `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px)`
            : "";
          if (nextTransform !== lastTransform) {
            node.style.transform = nextTransform;
            lastTransform = nextTransform;
          }

          const nextHeat = isActive ? heat.toFixed(2) : "";
          const nextBlend = isActive ? blend.toFixed(2) : "";
          if (nextHeat !== lastHeat) {
            if (nextHeat) {
              node.style.setProperty("--dot-heat", nextHeat);
            } else {
              node.style.removeProperty("--dot-heat");
            }
            lastHeat = nextHeat;
          }
          if (nextBlend !== lastBlend) {
            if (nextBlend) {
              node.style.setProperty("--dot-blend", nextBlend);
            } else {
              node.style.removeProperty("--dot-blend");
            }
            lastBlend = nextBlend;
          }
        },
        { stage: "WRITE_2", queueId: "dot-displacement" },
      );
    }

    function getSquareCornerBonus(
      dotCenter: { x: number; y: number },
      targetCenter: { x: number; y: number },
      targetRect: DOMRect,
      direction: { x: number; y: number },
    ) {
      const halfWidth = targetRect.width / 2;
      const halfHeight = targetRect.height / 2;
      const minHalfSize = Math.min(halfWidth, halfHeight);
      const absDirectionX = Math.abs(direction.x);
      const absDirectionY = Math.abs(direction.y);
      const rayBoundaryDistance = Math.min(
        absDirectionX > 0.001 ? halfWidth / absDirectionX : Number.POSITIVE_INFINITY,
        absDirectionY > 0.001 ? halfHeight / absDirectionY : Number.POSITIVE_INFINITY,
      );
      const angleBoost = clamp(rayBoundaryDistance / minHalfSize, 1, Math.SQRT2);
      const localX = clamp(Math.abs(dotCenter.x - targetCenter.x) / halfWidth, 0, 1);
      const localY = clamp(Math.abs(dotCenter.y - targetCenter.y) / halfHeight, 0, 1);
      const cornerCloseness = Math.sqrt(localX * localY);
      const normalizedAngleBoost = clamp((angleBoost - 1) / (Math.SQRT2 - 1), 0, 1);

      return cornerCloseness * normalizedAngleBoost * DOT_SQUARE_CORNER_BONUS;
    }

    function updateDotState() {
      if (activeTargetCollisions.size === 0) {
        setDotDisplacement(0, 0);
        return;
      }

      const dotCenter = getDotCenter();
      let displacementX = 0;
      let displacementY = 0;
      // Colour comes from field influence, not from net displacement: two fields
      // pushing from opposite sides cancel out to no movement while the dot sits
      // deep inside both, which is exactly the case the overlap colour is for.
      let strongestInfluence = 0;
      let secondInfluence = 0;

      for (const target of activeTargetCollisions) {
        const targetHandle = targetHandles.get(target);
        if (!targetHandle) {
          // removeObject() drops collision pairs without firing onEndContact, so a
          // destroyed target would otherwise linger in this set forever.
          activeTargetCollisions.delete(target);
          previousTargetCenters.delete(target.id);
          continue;
        }

        const element = targetHandle.element;
        const targetKind = targetHandle.kind;
        const targetRect = element.getBoundingClientRect();
        const targetCenter = {
          x: targetRect.left + targetRect.width / 2,
          y: targetRect.top + targetRect.height / 2,
        };
        const awayX = dotCenter.x - targetCenter.x;
        const awayY = dotCenter.y - targetCenter.y;
        const distance = Math.hypot(awayX, awayY);
        const direction =
          distance > 0.001
            ? { x: awayX / distance, y: awayY / distance }
            : getFallbackDirection(targetCenter, target);
        const influenceRadius = Math.max(targetRect.width, targetRect.height) * 0.7;
        const closeness = clamp(1 - distance / influenceRadius, 0, 1);

        // Normalised to the collider radius rather than influenceRadius, so it
        // reaches zero exactly where contact ends. Using closeness here would make
        // dots pop to ~29% colour the instant they entered the field.
        const fieldRadius = Math.max(targetRect.width, targetRect.height) / 2;
        const fieldInfluence = clamp(1 - distance / fieldRadius, 0, 1);
        if (fieldInfluence > strongestInfluence) {
          secondInfluence = strongestInfluence;
          strongestInfluence = fieldInfluence;
        } else if (fieldInfluence > secondInfluence) {
          secondInfluence = fieldInfluence;
        }

        const distanceFactor = Math.pow(closeness, DOT_DISPLACEMENT_POWER);
        const displacement =
          DOT_DISPLACEMENT_MIN +
          distanceFactor * (DOT_DISPLACEMENT_MAX - DOT_DISPLACEMENT_MIN) +
          (targetKind === "square"
            ? getSquareCornerBonus(dotCenter, targetCenter, targetRect, direction)
            : 0);

        const cappedDisplacement = Math.min(displacement, DOT_DISPLACEMENT_MAX);
        displacementX += direction.x * cappedDisplacement;
        displacementY += direction.y * cappedDisplacement;
        previousTargetCenters.set(target.id, targetCenter);
      }

      const displacementLength = Math.hypot(displacementX, displacementY);
      if (displacementLength > DOT_DISPLACEMENT_MAX) {
        const clampFactor = DOT_DISPLACEMENT_MAX / displacementLength;
        displacementX *= clampFactor;
        displacementY *= clampFactor;
      }

      setDotDisplacement(
        displacementX,
        displacementY,
        strongestInfluence,
        secondInfluence,
      );
    }

    function detach() {
      if (collider) {
        engine?.collisionEngine?.removeObject(collider.id);
      }
      object?.destroy();
      activeTargetCollisions.clear();
      previousTargetCenters.clear();
      collider = null;
      object = null;
    }

    function attach(currentEngine: EngineType | null) {
      if (!currentEngine || object) {
        return;
      }

      object = new ElementObject(currentEngine, null);
      object.element = node;
      object.classList = baseClassList;
      object.schedule(() => {
        object?.readDom({ unapplyTransform: false });
        object?.saveDomProperety("READ_1");
      }, { stage: "READ_1", queueId: "collision-dot-read" });
      const radius = node.getBoundingClientRect().width / 2;
      collider = new CircleCollider(currentEngine, object, radius, radius, radius);
      object.addCollider(collider);

      collider.event.collider.onBeginContact = (_, other) => {
        const targetKind = getCollisionTargetKind(other);
        if (!targetKind) {
          return;
        }

        activeTargetCollisions.add(other);
        updateDotState();
      };

      collider.event.collider.onCollide = (_, other) => {
        if (!isCollisionTarget(other)) {
          return;
        }

        activeTargetCollisions.add(other);
        updateDotState();
      };

      collider.event.collider.onEndContact = (_, other) => {
        if (!isCollisionTarget(other)) {
          return;
        }

        activeTargetCollisions.delete(other);
        previousTargetCenters.delete(other.id);
        updateDotState();
      };
    }

    attach(params.engine);

    return {
      update(nextParams) {
        attach(nextParams.engine);
      },
      destroy() {
        detach();
      },
    };
  };

  const collisionTargetRef: Action<
    HTMLDivElement,
    {
      engine: EngineType | null;
      size: number;
      shape: "rect" | "circle";
    }
  > = (node, params) => {
    let object: ElementObject | null = null;
    let collider: RectCollider | CircleCollider | null = null;
    let handle: TargetHandle | null = null;
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    const activeTargetContacts = new Set<symbol>();

    /**
     * Force fields may interpenetrate freely; the knobs at their centres may not.
     * The dragged knob is what gives way, so the clamp lives on the drag input
     * rather than in a collision handler — that way there is never a frame where
     * the knobs are drawn overlapping.
     *
     * prop.delta is absolute from drag start, so re-clamping the same tentative
     * position every move is idempotent: no drift, and the knob is free again the
     * moment the pointer pulls it clear.
     */
    function clampToKnobBoundary(x: number, y: number) {
      if (!handle) {
        return { x, y };
      }

      let centerX = x + handle.centerOffset;
      let centerY = y + handle.centerOffset;

      // Exact for two knobs. With three or more, one pass could push a knob into
      // another it had already cleared, and this would need to iterate.
      for (const other of targetHandles.values()) {
        if (other === handle) {
          continue;
        }

        const otherKnob = other.knobCollider.getWorldBoundsSnapshot();
        const minDistance = handle.knobCollider.radius + otherKnob.radius;
        let awayX = centerX - otherKnob.centerX;
        let awayY = centerY - otherKnob.centerY;
        let distance = Math.hypot(awayX, awayY);

        if (distance >= minDistance) {
          continue;
        }

        if (distance < 0.001) {
          // Centres coincide, so there is no separating axis to read. Eject along
          // the direction the pointer has been pulling.
          const driftX = centerX - (dragStartX + handle.centerOffset);
          const driftY = centerY - (dragStartY + handle.centerOffset);
          const driftDistance = Math.hypot(driftX, driftY);
          awayX = driftDistance > 0.001 ? driftX / driftDistance : 1;
          awayY = driftDistance > 0.001 ? driftY / driftDistance : 0;
          distance = 1;
        }

        centerX = otherKnob.centerX + (awayX / distance) * minDistance;
        centerY = otherKnob.centerY + (awayY / distance) * minDistance;
      }

      return {
        x: centerX - handle.centerOffset,
        y: centerY - handle.centerOffset,
      };
    }

    function moveTo(x: number, y: number) {
      if (!object) {
        return;
      }

      const clamped = clampToKnobBoundary(x, y);
      object.worldTransform = { x: clamped.x, y: clamped.y };
      object.schedule(() => object?.writeTransform(), {
        stage: "WRITE_1",
        queueId: `${object.id}-transform`,
      });
      scheduleDescriptionDisplacementUpdate();
    }

    function attach(currentEngine: EngineType | null) {
      if (!currentEngine || object) {
        return;
      }

      object = new ElementObject(currentEngine, null);
      object.transformMode = "relative";
      object.element = node;
      object.schedule(() => {
        object?.readDom({ unapplyTransform: false });
        object?.saveDomProperety("READ_1");
      }, { stage: "READ_1", queueId: "collision-target-read" });

      collider =
        params.shape === "circle"
          ? new CircleCollider(
              currentEngine,
              object,
              params.size / 2,
              params.size / 2,
              params.size / 2,
            )
          : new RectCollider(currentEngine, object, 0, 0, params.size, params.size);
      object.addCollider(collider);

      // The handle is centred in the target, so its local offset matches the
      // field's. No events on this one — the clamp reads its geometry directly.
      const centerOffset = params.size / 2;
      const knobCollider = new CircleCollider(
        currentEngine,
        object,
        centerOffset,
        centerOffset,
        KNOB_RADIUS_FALLBACK,
      );
      object.addCollider(knobCollider);

      // The handle is sized in design-system units defined outside this repo, so
      // measure it rather than trusting a constant.
      object.schedule(() => {
        const handleElement = node.querySelector<HTMLElement>(
          ".collision-target-handle",
        );
        if (handleElement?.offsetWidth) {
          knobCollider.radius = handleElement.offsetWidth / 2;
        }
      }, { stage: "READ_1", queueId: "collision-target-knob-read" });

      handle = {
        kind: params.shape === "circle" ? "circle" : "square",
        element: node,
        object,
        fieldCollider: collider,
        knobCollider,
        centerOffset,
      };
      targetHandles.set(collider, handle);

      collider.event.collider.onBeginContact = (_, other) => {
        if (!isCollisionTarget(other)) {
          return;
        }

        activeTargetContacts.add(other.id);
        node.style.color = TARGET_COMBINED_COLOR;
      };
      collider.event.collider.onEndContact = (_, other) => {
        if (!isCollisionTarget(other)) {
          return;
        }

        activeTargetContacts.delete(other.id);
        if (activeTargetContacts.size === 0) {
          node.style.color = "";
        }
      };
      object.event.input.dragStart = (prop) => {
        if (!object) {
          return;
        }

        // Claim the pointer while dragging (auto-releases at gesture end).
        object.engine.input.claimPointer(prop.pointerId);
        isDragging = true;
        dragStartX = object.worldTransform.x;
        dragStartY = object.worldTransform.y;
      };

      object.event.input.drag = (prop) => {
        if (!object) {
          return;
        }

        moveTo(dragStartX + prop.delta.x, dragStartY + prop.delta.y);
      };

      object.event.input.dragEnd = () => {

        isDragging = false;
      };
    }

    attach(params.engine);

    return {
      update(nextParams) {
        attach(nextParams.engine);
      },
      destroy() {
        if (collider) {
          targetHandles.delete(collider);
          engine?.collisionEngine?.removeObject(collider.id);
        }
        if (handle) {
          engine?.collisionEngine?.removeObject(handle.knobCollider.id);
        }
        object?.destroy();
        handle = null;
        collider = null;
        object = null;
      },
    };
  };

  const descriptionCharacterRef: Action<HTMLSpanElement, { engine: EngineType | null }> = (
    node,
    params,
  ) => {
    let object: ElementObject | null = null;
    const baseClassList = Array.from(node.classList);
    descriptionCharacterClassLists.set(node, baseClassList);

    function attach(currentEngine: EngineType | null) {
      if (!currentEngine || object) {
        return;
      }

      object = new ElementObject(currentEngine, null);
      object.element = node;
      object.classList = baseClassList;
      descriptionCharacterObjects.set(node, object);
    }

    attach(params.engine);

    return {
      update(nextParams) {
        attach(nextParams.engine);
      },
      destroy() {
        descriptionCharacterObjects.delete(node);
        object?.destroy();
        object = null;
      },
    };
  };

</script>

<article class="collision-card theme-secondary-1">
  <h3 class="sr-only">Collision Detection</h3>

  <ClientDemoFrame>
    {#snippet fallback()}
      <div class="collision-stage collision-skeleton" aria-hidden="true">
        <div class="collision-content">
          <div
            class="dot-title"
            style={`--dot-columns: ${gridColumns}; --dot-rows: ${gridRows};`}
          >
            {#each dots.slice(0, 120) as dot (dot.key)}
              <div
                class="dot-cell"
                style={`grid-column: ${dot.x + 1}; grid-row: ${dot.y + 1};`}
              ></div>
            {/each}
          </div>
          <p class="collision-description">{DESCRIPTION_TEXT}</p>
          <CardDocsLink href="/docs/snapengine/introduction/06_collision" label="Collision docs" />
        </div>
      </div>
    {/snippet}
    <Engine id="collision-card-canvas" bind:engine debug={debugState.enabled}>
    <div class="collision-stage" use:stageRef>
      <div class="collision-content">
        <div
          class="dot-title"
          style={`--dot-columns: ${gridColumns}; --dot-rows: ${gridRows};`}
          aria-hidden="true"
        >
          {#each dots as dot (dot.key)}
            <div
              class="dot-cell"
              style={`grid-column: ${dot.x + 1}; grid-row: ${dot.y + 1};`}
              use:circleColliderRef={{ engine }}
            ></div>
          {/each}
        </div>

        <p class="collision-description">
          {#each descriptionCharacters as segment (segment.key)}
            <span class="collision-description-character" use:descriptionCharacterRef={{ engine }}>
              {segment.character}
            </span>
          {/each}
        </p>
        <CardDocsLink href="/docs/snapengine/introduction/06_collision" label="Collision docs" />
      </div>

      {#if dots.length > 0}
        <div
          class="collision-target collision-target--circle collision-target--lower"
          style={`width: ${BOX_SIZE}px; height: ${BOX_SIZE}px; --force-field-duration: ${FORCE_FIELD_DURATION_MS}ms; --force-field-inner: ${FORCE_FIELD_INNER_SCALE};`}
          use:collisionTargetRef={{
            engine,
            size: BOX_SIZE,
            shape: "circle",
          }}
          aria-label="Drag collision box"
        >
          {#each FORCE_FIELD_RINGS as ring, ringIndex (ringIndex)}
            <span
              class="collision-target-ring"
              style={`--ring-scale: ${ring.scale}; --ring-fade: ${ring.fade}; --ring-delay: ${ring.delayMs}ms;`}
            ></span>
          {/each}
          <span class="collision-target-handle">
            <span class="material-symbols-rounded" aria-hidden="true">open_with</span>
          </span>
        </div>

        <div
          class="collision-target collision-target--circle collision-target--upper"
          style={`width: ${CIRCLE_SIZE}px; height: ${CIRCLE_SIZE}px; --force-field-duration: ${FORCE_FIELD_DURATION_MS}ms; --force-field-inner: ${FORCE_FIELD_INNER_SCALE};`}
          use:collisionTargetRef={{
            engine,
            size: CIRCLE_SIZE,
            shape: "circle",
          }}
          aria-label="Drag collision circle"
        >
          {#each FORCE_FIELD_RINGS as ring, ringIndex (ringIndex)}
            <span
              class="collision-target-ring"
              style={`--ring-scale: ${ring.scale}; --ring-fade: ${ring.fade}; --ring-delay: ${ring.delayMs}ms;`}
            ></span>
          {/each}
          <span class="collision-target-handle">
            <span class="material-symbols-rounded" aria-hidden="true">open_with</span>
          </span>
        </div>
      {/if}
    </div>
    </Engine>
  </ClientDemoFrame>
</article>

<style lang="scss">
  .collision-card {
    --card-padding: var(--size-48);
    --card-top-padding: var(--card-padding);
    --dot-gap: 0px;
    --dot-title-scale: 0.7;
    /* Both are overridden inline from the script constants — see FORCE_FIELD_*. */
    --force-field-duration: 4200ms;
    --force-field-inner: 0.22;
    --title-description-gap: 36px;
    min-height: 520px;
    height: auto;
    display: flex;
    align-items: center;
    justify-content: center;
    box-sizing: border-box;
    padding: 0;
    background-color: var(--color-background-tint);
    border-radius: var(--ui-radius);
    overflow: hidden;
    text-align: center;

    :global(.snap-engine-canvas) {
      width: 100%;
      height: auto !important;
      min-height: inherit;
      flex: 1 1 auto;
    }

    @media (max-width: 720px) {
      --card-padding: var(--size-24);
      --card-top-padding: var(--highlight-card-mobile-top-padding);
      --title-description-gap: 30px;
      padding-block: var(--card-top-padding) 0;
      grid-column: span 2;
    }
  }

  .collision-stage {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: inherit;
    overflow: hidden;
  }

  .collision-skeleton .dot-cell {
    opacity: 0.16;
  }

  .collision-content {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: var(--title-description-gap);
    pointer-events: none;
  }

  .dot-title {
    width: calc(min(75%, calc(100% - var(--size-32) * 2)) * var(--dot-title-scale));
    aspect-ratio: var(--dot-columns) / var(--dot-rows);
    display: grid;
    grid-template-columns: repeat(var(--dot-columns), minmax(0, 1fr));
    grid-template-rows: repeat(var(--dot-rows), minmax(0, 1fr));
    gap: var(--dot-gap);
  }

  .dot-cell {
    /* Both set inline by the collider. Heat is the strongest single field's
       influence; blend is the second strongest, so it is only ever non-zero
       where two fields genuinely overlap and is always <= heat. */
    --dot-heat: 0;
    --dot-blend: 0;
    --dot-overlap-color: #ff0a3d;
    align-self: center;
    justify-self: center;
    width: 100%;
    height: 100%;
    border-radius: 50%;
    background: color-mix(
      in srgb,
      color-mix(
        in srgb,
        var(--dot-overlap-color) calc(var(--dot-blend) * 100%),
        var(--color-primary)
      )
        calc(var(--dot-heat) * 100%),
      #000000
    );
    transform-origin: center;
  }

  .collision-description {
    width: min(26rem, calc(100% - var(--size-48)));
    margin: 0;
    color: #000000;
    font-size: var(--type-body);
    line-height: 1.35;
    text-align: center;
    white-space: normal;
  }

  .collision-description-character {
    display: inline-block;
    transform-origin: center;
    white-space: pre;
  }

  :global(.collision-description-character.is-active) {
    transition: transform 220ms cubic-bezier(0.22, 1, 0.36, 1);
    will-change: transform;
  }

  .collision-target {
    position: absolute;
    display: grid;
    place-items: center;
    box-sizing: border-box;
    padding: 0;
    border: 0;
    background: transparent;
    box-shadow: none;
    /* Drives the ring borders, so target-on-target contact recolours the field. */
    color: rgba(0, 0, 0, 0.3);
    cursor: grab;
    touch-action: none;
    user-select: none;
  }

  .collision-target-ring {
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100%;
    aspect-ratio: 1 / 1;
    /* Scaled rather than resized so the expansion stays on the compositor. */
    transform: translate(-50%, -50%) scale(var(--ring-scale));
    /* Static colour: animating border-color would repaint every ring every frame.
       The dark-to-faint appearance comes from the opacity curve instead, which the
       compositor can handle on its own. Mixing against currentColor keeps the
       target-on-target contact recolour working. */
    border: 1px solid color-mix(in srgb, currentColor 80%, transparent);
    border-radius: 50%;
    opacity: var(--ring-fade);
    pointer-events: none;
    /* Accelerating outward is what widens the gaps as rings near the rim. */
    animation: force-field-pulse var(--force-field-duration)
      cubic-bezier(0.4, 0, 0.9, 0.7) infinite;
    animation-delay: var(--ring-delay);
    transition: border-color 160ms ease;
  }

  /* Born small and dark just outside the knob, dissolving to thin grey at the rim.
     Transform and opacity only — both composited, neither triggers a repaint. */
  @keyframes force-field-pulse {
    0% {
      transform: translate(-50%, -50%) scale(var(--force-field-inner));
      opacity: 0;
    }
    10% {
      opacity: 1;
    }
    100% {
      transform: translate(-50%, -50%) scale(1);
      opacity: 0.05;
    }
  }

  /* Falls back to the static concentric field from --ring-scale / --ring-fade. */
  @media (prefers-reduced-motion: reduce) {
    .collision-target-ring {
      animation: none;
    }
  }

  .collision-target--lower {
    left: 18%;
    top: 58%;
  }

  .collision-target:active {
    cursor: grabbing;
  }

  .collision-target--upper {
    right: 18%;
    top: 29%;
  }

  .collision-target--circle {
    border-radius: 50%;
  }

  /* Knob styling lifted from the toggle switch in snapdesign.scss, so the handle
     reads as the same physical control rather than a flat button. */
  .collision-target-handle {
    --knob-color: var(--color-primary);
    --specular-angle: 130deg;
    display: grid;
    place-items: center;
    box-sizing: border-box;
    padding: 0;
    width: var(--size-32);
    height: var(--size-32);
    border-radius: 50%;
    background:
      radial-gradient(
        hsl(from var(--knob-color) h calc(s + 5) calc(l + 15)) 0%,
        hsl(from var(--knob-color) h s calc(l + 10)) 50%,
        hsl(from var(--knob-color) h s l / 0) 58%,
        hsl(from var(--knob-color) h s l / 0) 65%,
        hsl(from var(--knob-color) h s calc(l - 5) / 0.4) 72%
      ),
      conic-gradient(
        from var(--specular-angle) at center,
        hsl(from var(--knob-color) h calc(s + 20) calc(l + 5) / 0.1) 43%,
        #fff 57%,
        hsl(from var(--knob-color) h calc(s + 20) calc(l + 5) / 0.1) 70%
      ),
      conic-gradient(
        from 120deg at center,
        hsl(from var(--knob-color) h calc(s - 5) calc(l - 10)) 0%,
        hsl(from var(--knob-color) calc(h + 10) calc(s + 10) calc(l + 20)) 50%,
        hsl(from var(--knob-color) h calc(s - 5) calc(l - 10)) 100%
      );
    box-shadow:
      2px 2px 2px 0px rgba(4, 14, 48, 0.096),
      4px 4px 4px -3px rgba(7, 20, 53, 0.142),
      6px 6px 6px -4px rgba(6, 21, 40, 0.422);
  }

  .collision-target .material-symbols-rounded {
    font-family: "Material Symbols Rounded";
    font-size: var(--size-16);
    font-variation-settings: "FILL" 0, "wght" 500, "GRAD" 0, "opsz" 24;
    line-height: 1;
    color: #fff;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }
</style>
