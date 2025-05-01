import { pointerDownProp, pointerMoveProp, pointerUpProp } from "../../input";
import { BaseObject, ElementObject } from "../../object";
import { GlobalManager } from "../../global";
import { ItemContainer } from "./container";

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

  constructor(global: GlobalManager, parent: BaseObject | null) {
    super(global, parent);
    this.event.input.pointerDown = this.cursorDown;
    this.event.global.pointerUp = this.cursorUp;
    this.transformMode = "direct";
    this._containerObject = null;
    this.direction = "column";
    this.spacerIndex = 0;
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

  debug_all_items() {
    for (const item of this._containerObject?.itemList ?? []) {
      item.dom.element.style.border = "2px solid black";
      item.dom.element.style.backgroundColor = "rgb(52, 52, 52)";
      item.dom.element.innerHTML = `Index: ${this._containerObject?.itemList.indexOf(item)}, GID: ${item.gid}, ${item.dom.property.worldX}, ${item.dom.property.worldY}`;
    }
  }

  get orderedItemList() {
    return this._containerObject?.itemList ?? [];
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
    this.indexInList = this.orderedItemList.indexOf(this) ?? 0;
    if (this._containerObject) {
      this._containerObject.dragItem = this;
      this._containerObject?.removeItem(this);
      this._containerObject.updateItemIndexes();
    }
    this.event.global.onCursorMove = this.cursorMove;

    let { rowList, closestRow, rowBoundaries } = this.getClosestRow(
      this.orderedItemList,
      this.worldY + this.dom.property.height / 2,
    );
    this._dropIndex = this.indexInList;
    this.localDropIndex =
      this._dropIndex - rowBoundaries[closestRow.index].cumulativeLength;
    this._containerObject?.addExpandAnimationBeforeItem(this, this._dropIndex);

    // this.debug_all_items();
  }

  getClosestRow(itemList: ItemObject[], thisScreenY: number) {
    // Group items by row, using worldY
    let rowList: ItemObject[][] = [];
    let prevHeight = undefined;
    for (const item of itemList) {
      let row = Math.floor(item.worldY);
      if (row != prevHeight) {
        rowList.push([]);
        prevHeight = row;
      }
      rowList[rowList.length - 1].push(item);
    }
    // Use the first item in each row to find the top and bottom of the row
    let rowBoundaries = [];
    let cumulativeLength = 0;
    for (let i = 0; i < rowList.length; i++) {
      let row = rowList[i];
      let top = row[0].dom.property.worldY;
      let bottom =
        row[row.length - 1].dom.property.worldY +
        row[row.length - 1].dom.property.height;
      let length = row.length;
      rowBoundaries.push({ top, bottom, index: i, length, cumulativeLength });
      cumulativeLength += length;
    }
    let closestRow = rowBoundaries.reduce((prev, curr) => {
      return Math.abs((curr.bottom + curr.top) / 2 - thisScreenY) <
        Math.abs((prev.bottom + prev.top) / 2 - thisScreenY)
        ? curr
        : prev;
    });
    return {
      rowList,
      closestRow,
      rowBoundaries,
    };
  }

  cursorMove(prop: cursorMoveProp) {
    if (
      prop.button !== cursorState.mouseLeft ||
      !this._containerObject ||
      this._containerObject.dragItem !== this
    ) {
      return;
    }

    this.worldPosition = [
      prop.worldX - this._mouseOffsetX,
      prop.worldY - this._mouseOffsetY,
    ];
    this.requestPostWrite();

    const buffer = 12;
    let dropIndex = this._dropIndex;
    let localDropIndex = this.localDropIndex;
    let thisScreenY = this.worldY + this.dom.property.height / 2;
    let thisScreenX = this.worldX + this.dom.property.width / 2;

    // this.dom.element.style.backgroundColor = "green";
    // this.dom.element.innerHTML = `${thisScreenX}, ${thisScreenY}`;
    // this.debug_all_items();

    if (this.direction == "column") {
      let sortedItemList = this.orderedItemList.sort(
        (a, b) => a.dom.property.worldY - b.dom.property.worldY,
      );

      let lastAboveItem = (sortedItemList as ItemObject[]).findLast(
        (item) => item.dom.property.worldY < thisScreenY,
      );
      // Find the first element that is below the center of the item
      let firstBelowItem = sortedItemList.find(
        (item) =>
          item.dom.property.worldY + item.dom.property.height > thisScreenY,
      );

      let aboveItemBottom = lastAboveItem
        ? lastAboveItem.dom.property.worldY + lastAboveItem.dom.property.height
        : undefined;
      let belowItemTop = firstBelowItem?.dom.property.worldY;

      if (
        lastAboveItem &&
        aboveItemBottom &&
        aboveItemBottom - buffer > thisScreenY
      ) {
        dropIndex = this.orderedItemList.indexOf(lastAboveItem) + 1;
      } else if (
        firstBelowItem &&
        belowItemTop &&
        belowItemTop + buffer < thisScreenY
      ) {
        dropIndex = this.orderedItemList.indexOf(firstBelowItem!);
      } else if (belowItemTop == undefined) {
        dropIndex = this.orderedItemList.length;
      } else if (aboveItemBottom == undefined) {
        dropIndex = 0;
      }
    } else {
      let { rowList, closestRow, rowBoundaries } = this.getClosestRow(
        this.orderedItemList,
        thisScreenY,
      );
      let closestRowIndex = closestRow.index;
      // for (const item of rowList[closestRowIndex]) {
      //   item.dom.element.style.border = "2px solid red";
      // }
      // Populate the cumulative length of the rows
      let cumulativeLength = closestRow.cumulativeLength;
      // let localDropIndex = this.localDropIndex;
      let sortedItemList = rowList[closestRowIndex].sort(
        (a, b) => a.dom.property.worldX - b.dom.property.worldX,
      );

      let lastLeftItem = (sortedItemList as ItemObject[]).findLast(
        (item) =>
          item.dom.property.worldX <= thisScreenX - item.dom.property.width / 2,
      );
      // Find the first element that is below the center of the item
      let firstRightItem = sortedItemList.find(
        (item) =>
          item.dom.property.worldX + item.dom.property.width >=
          thisScreenX + item.dom.property.width / 2,
      );

      let leftItemRight = lastLeftItem
        ? lastLeftItem.dom.property.worldX + lastLeftItem.dom.property.width
        : undefined;
      let rightItemLeft = firstRightItem?.dom.property.worldX;

      // if (lastLeftItem) {
      //   lastLeftItem.dom.element.style.backgroundColor = "red";
      //   lastLeftItem.dom.element.innerHTML = `GID: ${lastLeftItem.gid}, ${lastLeftItem.dom.property.worldX} <-> ${leftItemRight}`;
      // }

      // if (firstRightItem) {
      //   firstRightItem.dom.element.style.backgroundColor = "blue";
      //   firstRightItem.dom.element.innerHTML = `GID: ${firstRightItem.gid}, ${rightItemLeft} <-> ${firstRightItem.dom.property.worldX + firstRightItem.dom.property.width}`;
      // }

      if (
        firstRightItem &&
        leftItemRight &&
        rightItemLeft &&
        Math.abs(rightItemLeft - leftItemRight) <
          this.dom.property.width - buffer
      ) {
        localDropIndex = rowList[closestRowIndex].indexOf(firstRightItem);
      } else if (
        lastLeftItem &&
        leftItemRight &&
        leftItemRight - buffer > thisScreenX
      ) {
        localDropIndex = rowList[closestRowIndex].indexOf(lastLeftItem);
      } else if (
        firstRightItem &&
        rightItemLeft &&
        rightItemLeft + buffer < thisScreenX
      ) {
        localDropIndex = rowList[closestRowIndex].indexOf(firstRightItem) + 1;
      } else if (rightItemLeft == undefined) {
        localDropIndex = rowList[closestRowIndex].length;
      } else if (leftItemRight == undefined) {
        localDropIndex = 0;
      }
      if (localDropIndex > rowList[closestRowIndex].length) {
        dropIndex = -1;
      } else {
        dropIndex = cumulativeLength + localDropIndex;
      }
    }

    if (dropIndex != this._containerObject?.spacerIndex) {
      this._containerObject?.addExpandAnimationBeforeItem(this, dropIndex);
    }
    this._dropIndex = dropIndex;
    this.localDropIndex = localDropIndex;
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
  }
}
