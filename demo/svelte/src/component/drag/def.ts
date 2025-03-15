import { runInThisContext } from "vm";
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
import { GlobalManager } from "../../lib/snapline.mjs";

export class ItemContainer extends BaseObject {
  itemList: ItemObject[] = [];
  dragItem: ItemObject | null = null;
  _containerDomElement: HTMLElement | null = null;
  _dropIndex: number = 0;
  _expandAnimations: HTMLElement[] = [];
  constructor(global: GlobalManager, parent: BaseObject | null) {
    super(global, parent);
    this.itemList = [];
    // this.event.global.onCursorMove = this.updateItemPositions;
  }

  addItem(item: ItemObject) {
    this.itemList.push(item);
    item._containerObject = this;
  }

  removeItem(item: ItemObject) {
    this.itemList = this.itemList.filter((i) => i !== item);
    // item._containerObject = null;
  }

  // removeItemAtIndex(index: number) {
  //   this.itemList.splice(index, 1);
  // }
  // addShrinkAnimationBeforeItem(item: ItemObject) {
  //   let tmpDomElement = document.createElement("div");
  //   tmpDomElement.classList.add("shrink-animation-before-item");
  //   tmpDomElement.style.width = "100px";
  //   // tmpDomElement.style.backgroundColor = "red";
  //   tmpDomElement.style.transition = "height 0.3s ease-in-out";
  //   this._containerDomElement?.insertBefore(
  //     tmpDomElement,
  //     item.dom._domElement,
  //   );
  // }

  // removeShrinkAnimationBeforeItem(item: ItemObject) {
  //   item.dom._domElement.classList.remove("shrink-animation-before-item");
  // }

  // addExpandAnimationBeforeItem(item: ItemObject) {
  //   let tmpDomElement = document.createElement("div");
  //   tmpDomElement.classList.add("expand-animation-before-item");
  //   tmpDomElement.style.width = "100px";
  //   // tmpDomElement.style.backgroundColor = "red";
  //   this._containerDomElement?.insertBefore(
  //     tmpDomElement,
  //     item.dom._domElement,
  //   );
  //   this._expandAnimations.push(tmpDomElement);
  // }

  // shrinkAllExpandAnimations() {
  //   this._expandAnimations.forEach((animation) => {
  //     animation.classList.remove("expand-animation-before-item");
  //     animation.classList.add("shrink-animation-before-item");
  //   });
  // }

  // removeAllExpandAnimation() {
  //   this._expandAnimations.forEach((animation) => {
  //     animation.remove();
  //   });
  //   this._expandAnimations = [];
  // }

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
    // console.log("updateItemPositions");
    this.itemList.forEach((item) => {
      item.dom.submitFetchQueue();
    });
  }
}

export class ItemObject extends ElementObject {
  _containerObject: ItemContainer | null;
  // _containerDomElement: HTMLElement | null = null;
  indexInList: number = 0;
  _mouseOffsetX: number = 0;
  _mouseOffsetY: number = 0;
  _cloneDomElement: HTMLElement | null = null;
  _dropIndex: number = 0;
  constructor(global: GlobalManager, parent: BaseObject | null) {
    super(global, parent);
    this.event.dom.onCursorDown = this.cursorDown;
    // this.event.dom.onCursorMove = this.cursorMove;
    // this.event.global.onCursorMove = this.cursorMove;
    this.event.global.onCursorUp = this.cursorUp;
    // this.dom.style.cursor = "grab";
  }

  cursorDown(prop: cursorDownProp) {
    console.log("cursorDown ItemObject", prop);
    // this._containerDomElement = this._containerObject?._containerDomElement;
    this.dom.fetchProperty();
    this._mouseOffsetX = prop.worldX - (this.dom._domPosition.worldX ?? 0);
    this._mouseOffsetY = prop.worldY - (this.dom._domPosition.worldY ?? 0);
    // this.removeDomElement();
    // this.dom.position.worldX = prop.worldX - this._mouseOffsetX;
    // this.dom.position.worldY = prop.worldY - this._mouseOffsetY;

    this.dom.style = {
      cursor: "grabbing",
      // position: "fixed",
      // top: `${this.dom.position.screenY}px`,
      // left: `${this.dom.position.screenX}px`,
    };
    // this.dom.renderWorldPosition = [
    //   this.dom.position.worldX,
    //   this.dom.position.worldY,
    // ];
    if (this._containerObject) {
      this._containerObject.dragItem = this;
      this._containerObject?.removeItem(this);
      this._containerObject.updateItemIndexes();
    }
    this.event.global.onCursorMove = this.cursorMove;
    this.indexInList = this._containerObject?.itemList.indexOf(this) ?? 0;

    this.dom.worldPosition = [
      prop.worldX - this._mouseOffsetX,
      prop.worldY - this._mouseOffsetY,
    ];
    console.debug(
      "cursorMove",
      prop.worldX - this._mouseOffsetX,
      prop.worldY - this._mouseOffsetY,
    );
    // this._containerObject?.addShrinkAnimationBeforeItem(this);
    // let cloneElement = this._dom?.cloneNode(true) as HTMLElement;
    // // let originalElement = this._dom;
    // this.style.display = "none";
    // this._cloneDomElement = cloneElement;
    // cloneElement.style.cursor = "grabbing";
    // cloneElement.style.position = "fixed";
    // cloneElement.style.top = `${this._screenY}px`;
    // cloneElement.style.left = `${this._screenX}px`;
    // // cloneElement.style.zIndex = "1000";
    // this._containerObject?._containerDomElement?.appendChild(cloneElement);
    // this._cloneDomElement = cloneElement;
    // this.style.display = "none";
  }

  cursorMove(prop: cursorMoveProp) {
    // console.log("cursorMove", prop);
    if (
      prop.button !== cursorState.mouseLeft ||
      !this._containerObject ||
      this._containerObject.dragItem !== this
    ) {
      console.log("cursorMove false", prop);
      return;
    }
    // this.dom.position.worldX = prop.worldX - this._mouseOffsetX;
    // this.dom.position.worldY = prop.worldY - this._mouseOffsetY;
    this.dom.worldPosition = [
      prop.worldX - this._mouseOffsetX,
      prop.worldY - this._mouseOffsetY,
    ];

    console.debug(
      "cursorMove",
      prop.worldX - this._mouseOffsetX,
      prop.worldY - this._mouseOffsetY,
    );
    // this.dom.style = {
    //   top: `${this.dom.position.worldY}px`,
    //   left: `${this.dom.position.worldX}px`,
    // };
    // this.dom.renderWorldPosition = [
    //   this.dom.position.worldX,
    //   this.dom.position.worldY,
    // ];

    let thisScreenY = this.dom.screenPosition[1];
    // let thisScreenY = this.dom.position.screenY;
    // FInd what index this item should be in if it were to be dropped
    // console.log(
    //   this._containerObject.itemList.map((item) => item.dom.position.screenY),
    // );
    let sortedItemList = this._containerObject.itemList.sort(
      (a, b) => a.dom.screenPosition[1] - b.dom.screenPosition[1],
    );
    let dropIndex = sortedItemList.findIndex(
      (item) => item.dom.screenPosition[1] > thisScreenY,
    );
    if (dropIndex === -1) {
      // dropIndex = this._containerObject.itemList.length;
      return;
    }
    if (dropIndex != this._dropIndex) {
      // this._containerObject?.removeShrinkAnimationBeforeItem(
      //   this._containerObject.itemList[this._dropIndex],
      // );
      // this._containerObject?.removeAllExpandAnimation();
      // this._containerObject?.shrinkAllExpandAnimations();
      // this._containerObject?.addExpandAnimationBeforeItem(
      //   this._containerObject.itemList[dropIndex],
      // );
    }
    this._dropIndex = dropIndex;
    console.log(this._dropIndex);
  }

  cursorUp(prop: cursorUpProp) {
    if (
      // prop.button !== cursorState.mouseLeft ||
      !this._containerObject ||
      this._containerObject.dragItem !== this
    ) {
      return;
    }
    console.log("cursorUp", prop);
    if (this._containerObject) {
      this._containerObject.dragItem = null;
    }
    this.event.global.onCursorMove = null;
    // this.dom.position.screenX = prop.screenX - this._mouseOffsetX;
    // this.dom.position.screenY = prop.screenY - this._mouseOffsetY;
    // this.dom.style = {
    //   position: "relative",
    //   top: "0px",
    //   left: "0px",
    //   transform: "translate(0px, 0px)",
    // };

    // this.dom.submitFetchQueue();

    // this.dom.position.worldX = null;
    // this.dom.position.worldY = null;
    this.dom.worldPosition = [null, null];
    // this.dom.fetchProperty();
    // if (this._containerObject) {
    //   this._containerObject.removeItem(this);
    //   this._containerObject.addItemAfter(
    //     this,
    //     this._containerObject.itemList[0],
    //   );
    //   this._containerObject._containerDomElement?.removeChild(
    //     this._cloneDomElement as HTMLElement,
    //   );
    // }
    if (this._containerObject) {
      this._containerObject.addItemAfter(
        this,
        this._containerObject.itemList[this._dropIndex],
      );
    }
    // this._containerObject?.removeAllExpandAnimation();
    // console.log(
    //   "Inserting before",
    //   this._containerObject.itemList[this._dropIndex].dom._domElement,
    // );
    this.dom.moveTo({
      insertBefore: [
        this._containerObject?._containerDomElement as HTMLElement,
        this._dropIndex > this._containerObject.itemList.length - 1
          ? (null as unknown as HTMLElement)
          : this._containerObject.itemList[this._dropIndex].dom._domElement,
        // .nextSibling as HTMLElement),
      ],
      appendChild: null,
      replaceChild: null,
    });

    // this.dom.worldPosition = [
    //   this.dom._domPosition.worldX,
    //   this.dom._domPosition.worldY,
    // ];
  }
}
