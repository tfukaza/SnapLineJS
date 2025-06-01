import { BaseObject, ElementObject } from "../../object";
import { GlobalManager } from "../../global";
import { ItemContainer } from "./container";
import {
  pointerDownProp,
  pointerUpProp,
  pointerMoveProp,
  dragStartProp,
  dragProp,
  mouseButtonBitmap,
  dragEndProp,
} from "../../input";

const BUFFER = 20;

export class ItemObject extends ElementObject {
  _containerObject: ItemContainer | null;
  indexInList: number = 0;
  _mouseOffsetX: number = 0;
  _mouseOffsetY: number = 0;
  _cloneDomElement: HTMLElement | null = null;
  _dropIndex: number = 0;
  spacerIndex: number = 0;
  localDropIndex: number = 0;
  direction: "column" | "row";
  #currentRow: number = 0;

  constructor(global: GlobalManager, parent: BaseObject | null) {
    super(global, parent);
    this.event.input.dragStart = this.cursorDown;
    this.event.input.drag = this.cursorMove;
    this.event.input.dragEnd = this.cursorUp;
    this.transformMode = "none";
    this._containerObject = null;
    this.direction = "column";
    this.spacerIndex = 0;
  }

  animateZeroTransform() {
    return;
    // console.log(
    //   "animateZeroTransform",
    //   `${this.dom.prevProperty.x - this.dom.property.x}, ${this.dom.prevProperty.y - this.dom.property.y}`,
    // );

    this.animate(
      {
        transform: [
          `translate3d(${this.dom.prevProperty.x - this.dom.property.x}px, ${this.dom.prevProperty.y - this.dom.property.y}px, 0px)`,
          `translate3d(${0}px, ${0}px, 0px)`,
        ],
      },
      {
        duration: 400,
        easing: "ease-out",
      },
    );
    this.animation.play();
    // this.animation.onfinish = () => {
    //   this.animation.cancel();
    // };
  }

  debug_all_items() {
    for (const item of this._containerObject?.itemList ?? []) {
      item.addDebugText(
        item.dom.property.x,
        item.dom.property.y,
        `Index: ${this._containerObject?.itemList.indexOf(item)}, GID: ${item.gid}, ${item.dom.property.x}, ${item.dom.property.y}`,
        "black",
      );
      // item.element!.style.border = "2px solid black";
      // item.element!.style.backgroundColor = "rgb(52, 52, 52)";
      // item.element!.innerHTML = `Index: ${this._containerObject?.itemList.indexOf(item)}, GID: ${item.gid}, ${item.dom.property.x}, ${item.dom.property.y}`;
    }
  }

  get orderedItemList() {
    return this._containerObject?.itemList ?? [];
  }

  cursorDown(prop: dragStartProp) {
    // this._containerObject?.readAllItems().then(() => {
    //   this._containerObject?.setItemRows(this);
    // });
    for (const item of this._containerObject?.itemList ?? []) {
      item.dom.read();
    }
    this._containerObject?.setItemRows(this);
    // this._containerObject?.setItemRows(this);

    this._mouseOffsetX = prop.start.screenX - (this.dom.property.screenX ?? 0);
    this._mouseOffsetY = prop.start.screenY - (this.dom.property.screenY ?? 0);
    // console.log(prop.start.x, prop.start.y);
    this.worldPosition = [
      prop.start.x - this._mouseOffsetX,
      prop.start.y - this._mouseOffsetY,
    ];

    this.dom.style = {
      cursor: "grabbing",
      position: "absolute",
      zIndex: "1000",
      top: "0px",
      left: "0px",
    };
    this.transformMode = "relative";

    // this.requestPreRead(true);
    this.requestWrite();
    this.requestRead(false);
    this.requestPostWrite();

    this.indexInList = this.orderedItemList.indexOf(this) ?? 0;
    // console.log(
    //   "cursorDown",
    //   this.gid,
    //   this.indexInList,
    //   this.orderedItemList.map((item) => item.gid),
    // );
    if (this._containerObject) {
      this._containerObject.dragItem = this;
      this._containerObject?.removeItem(this);
      this._containerObject.updateItemIndexes();
    }
    // this.event.global.drag = this.cursorMove;

    let { rowList, closestRow, rowBoundaries } = this.getClosestRow(
      this.transform.y + this.dom.property.height / 2,
    );
    this._dropIndex = this.indexInList;
    this.localDropIndex =
      this._dropIndex - rowBoundaries[closestRow.index].cumulativeLength;
    this._containerObject?.addExpandAnimationBeforeItem(
      this,
      this._dropIndex,
      false,
    );
    this.#currentRow = closestRow.index;

    this.debug_all_items();
  }

  getClosestRow(thisScreenY: number) {
    let rowList = this._containerObject?.itemRows ?? [];
    // Draw a horizontal line through each row
    const colors = ["orange", "yellow", "green", "purple", "gray", "black"];
    for (let i = 0; i < rowList.length; i++) {
      this.addDebugRect(
        0,
        rowList[i][0].dom.property.y + rowList[i][0].dom.property.height / 2,
        this.dom.property.width,
        2,
        colors[i],
        true,
        `row-${i}`,
      );
    }
    // Use the first item in each row to find the top and bottom of the row
    let rowBoundaries = [];
    let cumulativeLength = 0;
    for (let i = 0; i < rowList.length; i++) {
      let row = rowList[i];
      let top = row[0].dom.property.y ?? 0;
      let bottom =
        (row[row.length - 1].dom.property.y ?? 0) +
        row[row.length - 1].dom.property.height;
      let length = row.length;
      rowBoundaries.push({ top, bottom, index: i, length, cumulativeLength });
      cumulativeLength += length;
    }
    // Draw a debug rectangle indicating the height of each row
    for (const row of rowBoundaries) {
      this.addDebugRect(
        10,
        row.top,
        10,
        row.bottom - row.top,
        "red",
        true,
        `row-boundary-${row.index}`,
      );
    }
    // let closestRow = rowBoundaries.reduce((prev, curr) => {
    //   return Math.abs((curr.bottom + curr.top) / 2 - thisScreenY) <
    //     Math.abs((prev.bottom + prev.top) / 2 - thisScreenY)
    //     ? curr
    //     : prev;
    // });
    let closestRow = rowBoundaries[this.#currentRow];
    if (
      this.#currentRow > 0 &&
      thisScreenY < rowBoundaries[this.#currentRow - 1].bottom - BUFFER
    ) {
      closestRow = rowBoundaries[this.#currentRow - 1];
    } else if (
      this.#currentRow < rowBoundaries.length - 1 &&
      thisScreenY > rowBoundaries[this.#currentRow + 1].top + BUFFER
    ) {
      closestRow = rowBoundaries[this.#currentRow + 1];
    }
    if (closestRow == undefined) {
      closestRow = rowBoundaries[0];
      console.warn("closestRow is undefined", thisScreenY);
    }
    // Draw a horizontal line for each item in the closest row
    for (const item of rowList[closestRow.index]) {
      item.addDebugRect(
        item.dom.property.x,
        item.dom.property.y + item.dom.property.height / 2,
        item.dom.property.width,
        2,
        "green",
        true,
        `item-${item.gid}`,
      );
    }
    return {
      rowList,
      closestRow,
      rowBoundaries,
    };
  }

  findClosestItems(rowItemList: ItemObject[], thisWorldX: number) {
    const sortedItemList = rowItemList.sort(
      (a, b) =>
        a.dom.property.x +
        a.dom.property.width / 2 -
        (b.dom.property.x + b.dom.property.width / 2),
    );
    let leftItem = sortedItemList.findLast(
      (item) => item.transform.x + item.dom.property.width / 2 <= thisWorldX,
    );
    let rightItem = sortedItemList.find(
      (item) => item.transform.x + item.dom.property.width / 2 >= thisWorldX,
    );

    let leftItemRight = leftItem
      ? leftItem.transform.x + leftItem.dom.property.width
      : undefined;
    let rightItemLeft = rightItem?.transform.x;

    return {
      leftItem,
      rightItem,
      leftItemRight,
      rightItemLeft,
    };
  }

  determineDropIndex() {
    const thisWorldX = this.transform.x + this.dom.property.width / 2;
    const thisWorldY = this.transform.y + this.dom.property.height / 2;

    let dropIndex = this._dropIndex;
    let localDropIndex = this.localDropIndex;

    for (const item of this.orderedItemList) {
      item.clearAllDebugMarkers();
    }

    // this.element!.style.backgroundColor = "green";
    this.debug_all_items();

    let { rowList, closestRow, rowBoundaries } = this.getClosestRow(thisWorldY);
    let closestRowIndex = closestRow.index;
    let cumulativeLength = closestRow.cumulativeLength;
    let { leftItem, rightItem, leftItemRight, rightItemLeft } =
      this.findClosestItems(rowList[closestRowIndex], thisWorldX);

    // for (const item of rowList[closestRowIndex]) {
    //   item.element!.style.border = "2px solid red";
    // }
    // Clear all debug markers on all items

    // Draw a tall vertical line to indicate the left border of the item
    if (leftItem) {
      leftItem.addDebugRect(
        leftItemRight ?? 0,
        leftItem.dom.property.y,
        2,
        leftItem.dom.property.height,
        "red",
        true,
        `leftItem-${leftItem.gid}`,
      );
      leftItem.addDebugRect(
        (leftItemRight ?? 0) - leftItem.dom.property.width / 2 + BUFFER,
        leftItem.dom.property.y,
        2,
        leftItem.dom.property.height,
        "orange",
        true,
        `leftItem-buffer-${leftItem.gid}`,
      );
    }

    if (rightItem) {
      rightItem.addDebugRect(
        rightItemLeft ?? 0,
        rightItem.dom.property.y,
        2,
        rightItem.dom.property.height,
        "red",
        true,
        `rightItem-${rightItem.gid}`,
      );
      rightItem.addDebugRect(
        (rightItemLeft ?? 0) + rightItem.dom.property.width / 2 - BUFFER,
        rightItem.dom.property.y,
        2,
        rightItem.dom.property.height,
        "orange",
        true,
        `rightItem-buffer-${rightItem.gid}`,
      );
    }

    this.addDebugRect(
      thisWorldX,
      this.transform.y,
      2,
      this.dom.property.height,
      "blue",
      true,
      `thisItem-${this.gid}`,
    );

    if (
      rightItem &&
      leftItemRight &&
      rightItemLeft &&
      Math.abs(rightItemLeft - leftItemRight) < this.dom.property.width - BUFFER
    ) {
      // "Squeeze in" between the two items when moving to a new row
      localDropIndex = rowList[closestRowIndex].indexOf(rightItem);
    } else if (
      leftItem &&
      leftItemRight &&
      leftItemRight - leftItem.dom.property.width / 2 + BUFFER > thisWorldX
    ) {
      // console.log("leftItem", leftItem);
      localDropIndex = rowList[closestRowIndex].indexOf(leftItem);
      // leftItem.element!.style.backgroundColor = "yellow";
    } else if (
      rightItem &&
      rightItemLeft &&
      rightItemLeft + rightItem.dom.property.width / 2 - BUFFER < thisWorldX
    ) {
      // console.log("rightItem", rightItem);
      localDropIndex = rowList[closestRowIndex].indexOf(rightItem) + 1;
      // rightItem.element!.style.backgroundColor = "orange";
    } else if (rightItemLeft == undefined) {
      // console.log("undefined rightItemLeft", rightItemLeft);
      localDropIndex = rowList[closestRowIndex].length;
    } else if (leftItemRight == undefined) {
      // console.log("undefined leftItemRight", leftItemRight);
      localDropIndex = 0;
    } else {
      // console.log("else", leftItem, leftItemRight, rightItem, rightItemLeft);
    }
    if (localDropIndex > rowList[closestRowIndex].length) {
      dropIndex = -1;
    } else {
      dropIndex = cumulativeLength + localDropIndex;
    }

    // console.log(
    //   "determineDropIndex",
    //   cumulativeLength,
    //   dropIndex,
    //   localDropIndex,
    //   closestRowIndex,
    // );

    return {
      dropIndex,
      localDropIndex,
      closestRowIndex,
    };
  }

  cursorMove(prop: dragProp) {
    if (
      !(prop.button & mouseButtonBitmap.LEFT) ||
      !this._containerObject ||
      this._containerObject.dragItem !== this ||
      this._containerObject._inputLock
    ) {
      return;
    }

    this.worldPosition = [
      prop.position.x - this._mouseOffsetX,
      prop.position.y - this._mouseOffsetY,
    ];
    this.requestPostWrite();

    let { dropIndex, localDropIndex, closestRowIndex } =
      this.determineDropIndex();

    if (dropIndex != this._containerObject?.spacerIndex) {
      const differentRow = this.#currentRow != closestRowIndex;
      // console.log("Previous", this.#currentRow, "New", closestRowIndex);
      this.#currentRow = closestRowIndex;
      this._containerObject?.addExpandAnimationBeforeItem(
        this,
        dropIndex,
        differentRow,
      );

      // console.log("addExpandAnimationBeforeItem", dropIndex);
    }
    this._dropIndex = dropIndex;
    // console.log("dropIndex", dropIndex);
    this.localDropIndex = localDropIndex;
  }

  cursorUp(prop: dragEndProp) {
    if (!this._containerObject || this._containerObject.dragItem !== this) {
      return;
    }
    if (this._containerObject) {
      this._containerObject.dragItem = null;
    }
    // this.event.global.drag = null;
    this.transformMode = "none";
    this.dom.style = {
      cursor: "grab",
      position: "relative",
      zIndex: "0",
    };
    if (this._containerObject) {
      this._containerObject.addItemAfter(
        this,
        this.orderedItemList[this._dropIndex],
      );
      this._containerObject.removeAllExpandAnimation();
    }

    this.dom.moveTo({
      insertBefore: [
        this._containerObject?._containerDomElement as HTMLElement,
        this._dropIndex >= this.orderedItemList.length - 1
          ? (null as unknown as HTMLElement)
          : this.orderedItemList[this._dropIndex].dom.element,
      ],
      appendChild: null,
      replaceChild: null,
    });
    this._containerObject?.readAllItems().then(() => {
      this._containerObject?.reorderItemList();
    });
    // this.requestRead(true).then(() => {
    //   this._containerObject?.reorderItemList();
    // });
    this.requestPostWrite();
    // this._containerObject?.reorderItemList();
    // console.log("cursorUp", this._dropIndex);
  }
}
