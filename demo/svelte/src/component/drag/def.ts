import {
  cursorMoveProp,
  cursorDownProp,
  cursorState,
  cursorUpProp,
} from "../../../../../src/input";
import {
  BaseObject,
  ElementObject,
} from "../../../../../src/components/object";
import { GlobalManager } from "../../../../../src/global";

export class ItemContainer extends BaseObject {
  itemList: ItemObject[] = [];
  dragItem: ItemObject | null = null;
  _containerDomElement: HTMLElement | null = null;
  _dropIndex: number = 0;
  _expandAnimations: HTMLElement[] = [];
  _spacerDomElement: HTMLElement | null = null;

  constructor(global: GlobalManager, parent: BaseObject | null) {
    super(global, parent);
    this.itemList = [];
  }

  addItem(item: ItemObject) {
    this.itemList.push(item);
    item._containerObject = this;
  }

  removeItem(item: ItemObject) {
    this.itemList = this.itemList.filter((i) => i !== item);
  }

  addExpandAnimationBeforeItem(caller: ItemObject, item: ItemObject) {
    this.requestWrite(() => {
      let tmpDomElement = document.createElement("div");
      tmpDomElement.style.width = "64px";
      tmpDomElement.style.height = "64px";
      if (this._spacerDomElement) {
        this._spacerDomElement.remove();
        this._spacerDomElement = null;
      }
      this._spacerDomElement = tmpDomElement;
      if (item == undefined) {
        return;
      }
      this._containerDomElement?.insertBefore(tmpDomElement, item.dom.element);
    });

    for (const item of this.itemList) {
      if (item.gid == caller.gid) {
        continue;
      }
      item.elementPositionMode = "absolute";
      let flip = item.requestFLIP();
      flip[2].then(() => {
        item.animateZeroTransform();
      });
    }
  }

  removeAllExpandAnimation() {
    this.requestWrite(() => {
      if (this._spacerDomElement) {
        this._spacerDomElement.remove();
        this._spacerDomElement = null;
      }
    });
  }

  pickUpItem(item: ItemObject) {
    this.dragItem = item;
    this.removeItem(item);
  }

  addItemAfter(item: ItemObject, afterItem: ItemObject) {
    const index = this.itemList.indexOf(afterItem);
    this.itemList.splice(index + 1, 0, item);
    item._containerObject = this;
    this.dragItem = null;
  }

  updateItemIndexes() {
    this.itemList.forEach((item, index) => {
      item.indexInList = index;
    });
  }

  updateItemPositions() {
    this.itemList.forEach((item) => {
      item.requestRead();
    });
  }
}

export class ItemObject extends ElementObject {
  _containerObject: ItemContainer | null;
  indexInList: number = 0;
  _mouseOffsetX: number = 0;
  _mouseOffsetY: number = 0;
  _cloneDomElement: HTMLElement | null = null;
  _dropIndex: number = 0;

  constructor(global: GlobalManager, parent: BaseObject | null) {
    super(global, parent);
    this.event.dom.onCursorDown = this.cursorDown;
    this.event.global.onCursorUp = this.cursorUp;
    this.elementPositionMode = "relative";
  }

  animateZeroTransform() {
    if (true) {
      let currentAnimation = this.dom.element.getAnimations()[0];
      if (currentAnimation) {
        currentAnimation.cancel();
      }
      let newAnimation = this.dom.element.animate(
        [
          {
            transform: `translate3d(${this.dom.prevProperty.worldX - this.dom.property.worldX}px, ${this.dom.prevProperty.worldY - this.dom.property.worldY}px, 0px)`,
          },
          {
            transform: `translate3d(${0}px, ${0}px, 0px)`,
          },
        ],
        {
          duration: 100,
          easing: "ease-out",
        },
      );
      newAnimation.onfinish = () => {
        newAnimation.cancel();
      };
    } else {
      this.animate(
        100,
        this.dom.prevProperty.worldY,
        this.dom.property.worldY,
        (value) => {
          this.worldY = value;
          this.requestPostWrite();
        },
      );
    }
  }

  cursorDown(prop: cursorDownProp) {
    this.dom.read(true);
    this._mouseOffsetX = prop.worldX - (this.dom.property.worldX ?? 0);
    this._mouseOffsetY = prop.worldY - (this.dom.property.worldY ?? 0);
    this.worldPosition = [
      this.dom.property.worldX ?? 0,
      this.dom.property.worldY ?? 0,
    ];

    this.dom.style = {
      cursor: "grabbing",
      position: "absolute",
      zIndex: "1000",
      top: "0px",
      left: "0px",
    };
    this.requestWrite();
    this.requestRead();
    this.requestPostWrite();

    this.elementPositionMode = "absolute";
    this.indexInList = this._containerObject?.itemList.indexOf(this) ?? 0;
    if (this._containerObject) {
      this._containerObject.dragItem = this;
      this._containerObject?.removeItem(this);
      this._containerObject.updateItemIndexes();
    }
    this.event.global.onCursorMove = this.cursorMove;

    this._dropIndex = this.indexInList;
    this._containerObject?.addExpandAnimationBeforeItem(this, this);
  }

  cursorMove(prop: cursorMoveProp) {
    if (
      prop.button !== cursorState.mouseLeft ||
      !this._containerObject ||
      this._containerObject.dragItem !== this
    ) {
      console.log("cursorMove false", prop);
      return;
    }

    this.worldPosition = [
      prop.worldX - this._mouseOffsetX,
      prop.worldY - this._mouseOffsetY,
    ];
    this.requestPostWrite();
    let thisScreenY = this.worldY + this.dom.property.height / 2;
    let sortedItemList = this._containerObject.itemList.sort(
      (a, b) => a.dom.property.worldY - b.dom.property.worldY,
    );

    const buffer = 24;
    let lastAboveItem = (sortedItemList as any).findLast(
      (item) => item.dom.property.worldY < thisScreenY,
    );
    // Find the first element that is below the center of the item
    let firstBelowItem = sortedItemList.find(
      (item) =>
        item.dom.property.worldY + item.dom.property.height > thisScreenY,
    );

    let aboveItemBottom =
      lastAboveItem?.dom.property.worldY + lastAboveItem?.dom.property.height;
    let belowItemTop = firstBelowItem?.dom.property.worldY;

    let dropIndex = this._dropIndex;
    if (aboveItemBottom && aboveItemBottom - buffer > thisScreenY) {
      dropIndex = this._containerObject.itemList.indexOf(lastAboveItem) + 1;
    } else if (belowItemTop && belowItemTop + buffer < thisScreenY) {
      dropIndex = this._containerObject.itemList.indexOf(firstBelowItem!);
    } else if (belowItemTop == undefined) {
      dropIndex = this._containerObject.itemList.length;
    } else if (isNaN(aboveItemBottom)) {
      dropIndex = 0;
    }

    if (dropIndex != this._dropIndex) {
      this._containerObject?.addExpandAnimationBeforeItem(
        this,
        this._containerObject.itemList[dropIndex],
      );
    }
    this._dropIndex = dropIndex;
  }

  cursorUp(prop: cursorUpProp) {
    if (!this._containerObject || this._containerObject.dragItem !== this) {
      return;
    }
    if (this._containerObject) {
      this._containerObject.dragItem = null;
    }
    this.event.global.onCursorMove = null;
    this.elementPositionMode = "relative";
    this.dom.style = {
      cursor: "grab",
      position: "relative",
      zIndex: "0",
    };
    if (this._containerObject) {
      this._containerObject.addItemAfter(
        this,
        this._containerObject.itemList[this._dropIndex],
      );
      this._containerObject.removeAllExpandAnimation();
    }

    this.dom.moveTo({
      insertBefore: [
        this._containerObject?._containerDomElement as HTMLElement,
        this._dropIndex >= this._containerObject.itemList.length - 1
          ? (null as unknown as HTMLElement)
          : this._containerObject.itemList[this._dropIndex].dom.element,
      ],
      appendChild: null,
      replaceChild: null,
    });
  }
}
