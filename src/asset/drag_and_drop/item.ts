import { BaseObject, ElementObject } from "../../object";
import { GlobalManager } from "../../global";
import { ItemContainer } from "./container";
import {
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
  _rowIndex: number = 0;
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

    // this.animate(
    //   {
    //     transform: [
    //       `translate3d(${this.dom.prevProperty.x - this.dom.property.x}px, ${this.dom.prevProperty.y - this.dom.property.y}px, 0px)`,
    //       `translate3d(${0}px, ${0}px, 0px)`,
    //     ],
    //   },
    //   {
    //     duration: 400,
    //     easing: "ease-out",
    //   },
    // );
    // this.animation.play();
    // this.animation.onfinish = () => {
    //   this.animation.cancel();
    // };
  }

  debug_all_items() {
    for (const item of this._containerObject?.itemList ?? []) {
      const property = item.getDomProperty("READ_2");
      item.addDebugText(
        property.x,
        property.y,
        `Index: ${this._containerObject?.itemList.indexOf(item)}, GID: ${item.gid}, ${property.x}, ${property.y}`,
        "black",
      );
    }
  }

  get orderedItemList() {
    return this._containerObject?.itemList ?? [];
  }

  cursorDown(prop: dragStartProp) {
    this._containerObject?.readDom(false, "READ_2");
    this._containerObject?.saveDomPropertyToTransform("READ_2");
    for (const item of this._containerObject?.itemList ?? []) {
      item.readDom(false, "READ_2");
      item.saveDomPropertyToTransform("READ_2");
    }
    this._containerObject?.setItemRows(this);
    let property = this.getDomProperty("READ_2");

    this._mouseOffsetX = prop.start.screenX - (property.screenX ?? 0);
    this._mouseOffsetY = prop.start.screenY - (property.screenY ?? 0);

    this.worldPosition = [
      prop.start.x - this._mouseOffsetX,
      prop.start.y - this._mouseOffsetY,
    ];

    this.style = {
      cursor: "grabbing",
      position: "absolute",
      zIndex: "1000",
      top: "0px",
      left: "0px",
    };
    this.transformMode = "offset";
    this.transformOrigin = this._containerObject; // TODO: Take padding into account
    this.requestWrite(
      false,
      () => {
        this.writeDom();
        this.writeTransform();
      },
      "WRITE_1", // Must apply transform early since we need to read the position of the other items in READ_2
    );

    this.indexInList = this.orderedItemList.indexOf(this) ?? 0;
    if (this._containerObject) {
      this._containerObject.dragItem = this;
      this._containerObject?.removeItem(this);
      this._containerObject.updateItemIndexes();
    }
    this.#currentRow = this._rowIndex;
    let { rowList, closestRow, rowBoundaries } = this.getClosestRow(
      this.transform.y + property.height / 2,
    );
    this._dropIndex = this.indexInList;
    this.localDropIndex =
      this._dropIndex - rowBoundaries[closestRow.index].cumulativeLength;
    this._containerObject?.addGhostBeforeItem(this, this._dropIndex, false);
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
        rowList[i][0].transform.y + rowList[i][0]._domProperty[1].height / 2,
        this._domProperty[1].width,
        2,
        i == this.#currentRow ? "#000000FF" : colors[i],
        true,
        `row-${i}`,
      );
    }
    // Use the first item in each row to find the top and bottom of the row
    let rowBoundaries = [];
    let cumulativeLength = 0;
    for (let i = 0; i < rowList.length; i++) {
      let row = rowList[i];
      let top = row[0].transform.y ?? 0;
      let bottom =
        (row[row.length - 1].transform.y ?? 0) +
        row[row.length - 1]._domProperty[1].height;
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
    // Draw a circle at thisScreenY
    this.addDebugRect(
      10,
      thisScreenY,
      10,
      10,
      "#000000FF",
      true,
      `thisScreenY`,
    );

    let closestRow = rowBoundaries.reduce((prev, curr) => {
      return Math.abs((curr.bottom + curr.top) / 2 - thisScreenY) <
        Math.abs((prev.bottom + prev.top) / 2 - thisScreenY)
        ? curr
        : prev;
    });
    // Draw a horizontal line for each item in the closest row
    for (const item of rowList[closestRow.index]) {
      item.addDebugRect(
        item.transform.x,
        item.transform.y + item._domProperty[1].height / 2,
        item._domProperty[1].width,
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
        a.transform.x +
        a._domProperty[1].width / 2 -
        (b.transform.x + b._domProperty[1].width / 2),
    );
    let leftItem = sortedItemList.findLast(
      (item) => item.transform.x + item._domProperty[1].width / 2 <= thisWorldX,
    );
    let rightItem = sortedItemList.find(
      (item) => item.transform.x + item._domProperty[1].width / 2 >= thisWorldX,
    );

    let leftItemRight = leftItem
      ? leftItem.transform.x + leftItem._domProperty[1].width
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
    const thisWorldX = this.transform.x + this._domProperty[1].width / 2;
    const thisWorldY = this.transform.y + this._domProperty[1].height / 2;

    let dropIndex = this._dropIndex;
    let localDropIndex = this.localDropIndex;

    for (const item of this.orderedItemList) {
      item.clearAllDebugMarkers();
    }

    this.debug_all_items();

    let { rowList, closestRow, rowBoundaries } = this.getClosestRow(thisWorldY);
    let closestRowIndex = closestRow.index;
    let cumulativeLength = closestRow.cumulativeLength;
    let { leftItem, rightItem, leftItemRight, rightItemLeft } =
      this.findClosestItems(rowList[closestRowIndex], thisWorldX);

    // Draw a tall vertical line to indicate the left border of the item
    if (leftItem) {
      leftItem.addDebugRect(
        leftItemRight ?? 0,
        leftItem.transform.y,
        2,
        leftItem._domProperty[1].height,
        "red",
        true,
        `leftItem-${leftItem.gid}`,
      );
      leftItem.addDebugRect(
        (leftItemRight ?? 0) - leftItem._domProperty[1].width / 2 + BUFFER,
        leftItem.transform.y,
        2,
        leftItem._domProperty[1].height,
        "orange",
        true,
        `leftItem-buffer-${leftItem.gid}`,
      );
    }

    if (rightItem) {
      rightItem.addDebugRect(
        rightItemLeft ?? 0,
        rightItem.transform.y,
        2,
        rightItem._domProperty[1].height,
        "red",
        true,
        `rightItem-${rightItem.gid}`,
      );
      rightItem.addDebugRect(
        (rightItemLeft ?? 0) + rightItem._domProperty[1].width / 2 - BUFFER,
        rightItem.transform.y,
        2,
        rightItem._domProperty[1].height,
        "orange",
        true,
        `rightItem-buffer-${rightItem.gid}`,
      );
    }

    this.addDebugRect(
      thisWorldX,
      this.transform.y,
      2,
      this._domProperty[1].height,
      "blue",
      true,
      `thisItem-${this.gid}`,
    );

    if (
      leftItem &&
      leftItemRight &&
      leftItemRight - leftItem._domProperty[1].width / 2 + BUFFER > thisWorldX
    ) {
      localDropIndex = rowList[closestRowIndex].indexOf(leftItem);
    } else if (
      rightItem &&
      rightItemLeft &&
      rightItemLeft + rightItem._domProperty[1].width / 2 - BUFFER < thisWorldX
    ) {
      localDropIndex = rowList[closestRowIndex].indexOf(rightItem) + 1;
    } else if (
      rightItem &&
      leftItemRight &&
      rightItemLeft &&
      Math.abs(rightItemLeft - leftItemRight) <
        this._domProperty[1].width - BUFFER
    ) {
      // "Squeeze in" between the two items when moving to a new row
      localDropIndex = rowList[closestRowIndex].indexOf(rightItem);
    } else if (rightItemLeft == undefined) {
      localDropIndex = rowList[closestRowIndex].length;
    } else if (leftItemRight == undefined) {
      localDropIndex = 0;
    } else {
      console.log("Else");
    }
    if (localDropIndex > rowList[closestRowIndex].length) {
      dropIndex = -1;
    } else {
      dropIndex = cumulativeLength + localDropIndex;
    }

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
    this.requestTransform();

    let { dropIndex, localDropIndex, closestRowIndex } =
      this.determineDropIndex();

    if (dropIndex != this._containerObject?.spacerIndex) {
      const differentRow = this.#currentRow != closestRowIndex;
      this.#currentRow = closestRowIndex;
      this._containerObject?.addGhostBeforeItem(this, dropIndex, differentRow);
      this._dropIndex = dropIndex;
      this.localDropIndex = localDropIndex;
    }
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
    this.style = {
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

    this.requestWrite(
      true,
      () => {
        this._containerObject?.element?.insertBefore(
          this.element as HTMLElement,
          this._dropIndex >= this.orderedItemList.length - 1
            ? (null as unknown as HTMLElement)
            : this.orderedItemList[this._dropIndex].element,
        );
        this.writeDom();
        this.writeTransform();
      },
      "WRITE_1",
    );
  }
}
