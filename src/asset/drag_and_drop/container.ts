import { BaseObject } from "../../object";
import { GlobalManager } from "../../global";
import { ItemObject } from "./item";
import { dragProp } from "@/input";

export class ItemContainer extends BaseObject {
  itemList: ItemObject[] = [];
  itemRows: ItemObject[][] = [];
  dragItem: ItemObject | null = null;
  _containerDomElement: HTMLElement | null = null;
  _dropIndex: number = 0;
  _expandAnimations: HTMLElement[] = [];
  _spacerDomElement: HTMLElement | null = null;
  spacerIndex: number = 0;
  direction: "column" | "row";
  _awaitingRemove: boolean = false;
  _inputLock: boolean = false;
  constructor(global: GlobalManager, parent: BaseObject | null) {
    super(global, parent);
    this.itemList = [];
    this.direction = "column";
    this.spacerIndex = 0;
    this._awaitingRemove = false;
    this._inputLock = false;
  }

  addItem(item: ItemObject) {
    this.itemList.push(item);
    item._containerObject = this;
    item.direction = this.direction;
    // item.requestRead(true, false);
  }

  removeItem(item: ItemObject) {
    this.itemList = this.itemList.filter((i) => i !== item);
  }

  readAllItems() {
    return this.requestRead().then(() => {
      for (const item of this.itemList) {
        item.dom.read();
      }
    });
  }

  /**
   * Reorder the item list based on the document position of the items.
   * This is used to determine the order of the items when they are dropped.
   */
  reorderItemList() {
    this.itemList = this.itemList.sort((a, b) => {
      return a.element!.compareDocumentPosition(b.element!) &
        Node.DOCUMENT_POSITION_PRECEDING
        ? 1
        : -1;
    });
    // console.log(
    //   "reorderItemList",
    //   this.itemList.map((item) => item.gid),
    // );
  }

  /**
   * Set the item rows based on the document position of the items.
   * It assumes the latest DOM positions has already been saved.
   */
  setItemRows(caller: ItemObject | null) {
    let rowList: ItemObject[][] = [];
    let prevHeight = undefined;
    for (const item of this.itemList) {
      let row = Math.floor(item.dom.property.screenY ?? 0);
      if (item == caller) {
        continue;
      }
      if (row != prevHeight) {
        rowList.push([]);
        prevHeight = row;
      }
      rowList[rowList.length - 1].push(item);
    }
    this.itemRows = rowList;
    console.log("setItemRows", this.itemRows);
  }

  addGhostItem(caller: ItemObject, itemIndex: number) {
    if (this._spacerDomElement) {
      this._spacerDomElement.remove();
      this._spacerDomElement = null;
      console.warn("spacerDomElement already exists");
      return;
    }
    // this.removeGhostItem();
    if (itemIndex == -1) {
      return;
    }
    let tmpDomElement = document.createElement("div");
    tmpDomElement.id = "spacer";
    // tmpDomElement.style.width = `${caller.dom.property.width}px`;
    // tmpDomElement.style.height = `${caller.dom.property.height}px`;
    // tmpDomElement.style.margin = caller.element!.style.margin;
    // tmpDomElement.style.padding = caller.element!.style.padding;
    // Get computed style of caller

    const computedStyle = window.getComputedStyle(caller.element!);
    tmpDomElement.style.width = computedStyle.width;
    tmpDomElement.style.height = computedStyle.height;
    tmpDomElement.style.margin = computedStyle.margin;
    tmpDomElement.style.padding = computedStyle.padding;
    tmpDomElement.style.boxSizing = computedStyle.boxSizing;

    console.log("addGhostItem", caller.element);
    this._spacerDomElement = tmpDomElement;
    this.spacerIndex = itemIndex;
    let item =
      itemIndex > this.itemList.length - 1 ? null : this.itemList[itemIndex];

    // this._inputLock = true;

    this._containerDomElement?.insertBefore(
      tmpDomElement,
      item ? item.dom.element : null,
    );
    // caller.dom.element.innerHTML = `Spacer index: ${item?.gid}, GID: ${caller.gid}`;
    this.reorderItemList();

    // for (const item of this.itemList) {
    //   item.requestPreRead(true, false);
    // }
    // this.requestRead().then(() => {
    //   this._inputLock = false;
    // });
  }

  removeGhostItem() {
    // return;
    if (this._spacerDomElement) {
      this._spacerDomElement.remove();
      this._spacerDomElement = null;
    }
  }

  addExpandAnimationBeforeItem(
    caller: ItemObject,
    itemIndex: number,
    differentRow: boolean,
  ) {
    console.log("addExpandAnimationBeforeItem", itemIndex, differentRow);

    this._inputLock = true;

    if (differentRow) {
      console.log("differentRow");
      // Save the DOM positions of all items
      this.requestPreRead().before(() => {
        for (const item of this.itemList) {
          item.dom.preRead();
        }
        // this.setItemRows(caller);
      });
      // Remove the ghost item
      this.requestWrite().before(() => {
        this.removeGhostItem();
      });
      // Save the DOM positions after the ghost item is removed
      this.requestRead().then(() => {
        for (const item of this.itemList) {
          item.dom.read(false);
          item.generateCache(true);
        }
        this.setItemRows(caller);
        // Determine where the caller should be dropped
        let { dropIndex, localDropIndex, closestRowIndex } =
          caller.determineDropIndex();
        if (dropIndex != this.spacerIndex) {
          console.log("modified drop index", dropIndex);
          // this.removeGhostItem();
          this.addGhostItem(caller, dropIndex);
          caller._dropIndex = dropIndex;
          caller.localDropIndex = localDropIndex;
        } else {
          console.log("no change in drop index");
        }
      });
      this.requestPostWrite().then(() => {
        for (const item of this.itemList) {
          item.dom.read(false);
          item.generateCache(true);
          item.animateZeroTransform();
        }
        this.setItemRows(caller);
        this._inputLock = false;
      });

      // console.log("differentRow");
      // for (const item of this.itemList) {
      //   let flip = item.requestFLIP();
      //   flip[3].then(() => {
      //     item.animateZeroTransform();
      //     item.requestRead(true, false);
      //   });
      // }
      // this.requestPostWrite()
      //   .before(() => {
      //     this.setItemRows(caller);
      //   })
      //   .then(() => {
      //     let { dropIndex, localDropIndex, closestRowIndex } =
      //       caller.determineDropIndex();
      //     if (dropIndex != this.spacerIndex) {
      //       this.removeGhostItem();
      //       this.addGhostItem(caller, dropIndex);
      //       caller._dropIndex = dropIndex;
      //       caller.localDropIndex = localDropIndex;
      //       // caller.requestRead(true, false);
      //       // this.#currentRow = closestRowIndex;
      //       // console.log("addExpandAnimationBeforeItem", dropIndex);
      //     }
      //   });
    } else {
      this.requestWrite(() => {
        this.removeGhostItem();
        this.addGhostItem(caller, itemIndex);
      });
      this.requestRead().then(() => {
        for (const item of this.itemList) {
          item.dom.read(false);
          item.generateCache(true);
        }
        this.setItemRows(caller);
        this._inputLock = false;
      });
      for (const item of this.itemList) {
        let flip = item.requestFLIP();
        flip[3].before(() => {
          item.animateZeroTransform();
        });
      }
    }

    // this.requestPostWrite();
  }

  removeAllExpandAnimation() {
    // this._awaitingRemove = true;
    this.requestWrite(() => {
      this.removeGhostItem();
    }).then(() => {
      console.debug("Finished removeAllExpandAnimation");
      // this._awaitingRemove = false;
    });
    this.requestRead().then(() => {
      for (const item of this.itemList) {
        item.dom.read(false);
        item.generateCache(true);
      }
      this.setItemRows(null);
    });
    // for (const item of this.itemList) {
    //   let flip = item.requestFLIP();
    //   flip[3].before(() => {
    //     item.animateZeroTransform();
    //   });
    // }
    this.spacerIndex = -1;
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
