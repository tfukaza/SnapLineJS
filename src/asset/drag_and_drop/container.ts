import { BaseObject, ElementObject } from "../../object";
import { GlobalManager } from "../../global";
import { ItemObject } from "./item";

export class ItemContainer extends ElementObject {
  #itemList: ItemObject[] = [];
  #itemRows: ItemObject[][] = [];
  #dragItem: ItemObject | null = null;
  #spacerDomElement: HTMLElement | null = null;
  #spacerIndex: number = 0;
  #direction: "column" | "row";

  constructor(global: GlobalManager, parent: BaseObject | null) {
    super(global, parent);
    this.#itemList = [];
    this.#direction = "column";
    this.#spacerIndex = 0;

    this.style = {
      position: "relative",
    };
  }

  get direction() {
    return this.#direction;
  }

  set direction(value: "column" | "row") {
    this.#direction = value;
  }

  get spacerIndex() {
    return this.#spacerIndex;
  }

  set spacerIndex(value: number) {
    this.#spacerIndex = value;
  }

  get itemList() {
    return this.#itemList;
  }

  get itemRows() {
    return this.#itemRows;
  }

  set dragItem(item: ItemObject | null) {
    this.#dragItem = item;
  }

  get dragItem() {
    return this.#dragItem;
  }

  addItem(item: ItemObject) {
    this.#itemList.push(item);
    item.setContainer(this);
  }

  removeItem(item: ItemObject) {
    this.#itemList = this.#itemList.filter((i) => i !== item);
  }

  readAllItems() {
    return this.queueUpdate("READ_1", () => {
      for (const item of this.#itemList) {
        item.readDom(false);
      }
    });
  }

  /**
   * Reorder the item list based on the document position of the items.
   * This is used to determine the order of the items when they are dropped.
   */
  reorderItemList() {
    this.#itemList = this.#itemList.sort((a, b) => {
      return a.element!.compareDocumentPosition(b.element!) &
        Node.DOCUMENT_POSITION_PRECEDING
        ? 1
        : -1;
    });
  }

  /**
   * Set the item rows based on the document position of the items.
   * It assumes the latest DOM positions has already been saved.
   */
  setItemRows(caller: ItemObject | null) {
    let rowList: ItemObject[][] = [];
    let prevHeight = undefined;
    for (const item of this.#itemList) {
      let row = Math.floor(item.transform.y ?? 0);
      item.rowIndex = rowList.length;
      if (item == caller) {
        continue;
      }
      if (row != prevHeight) {
        rowList.push([]);
        prevHeight = row;
      }
      rowList[rowList.length - 1].push(item);
    }
    this.#itemRows = rowList;
  }

  addGhostItem(caller: ItemObject, itemIndex: number) {
    if (this.#spacerDomElement) {
      this.#spacerDomElement.remove();
      this.#spacerDomElement = null;
      return;
    }

    if (itemIndex == -1) {
      return;
    }
    let tmpDomElement = document.createElement("div");
    tmpDomElement.id = "spacer";
    // tmpDomElement.style.width = `${caller.dom.property.width}px`;
    // tmpDomElement.style.height = `${caller.dom.property.height}px`;
    // tmpDomElement.style.margin = caller.element!.style.margin;
    // tmpDomElement.style.padding = caller.element!.style.padding;

    const computedStyle = window.getComputedStyle(caller.element!);
    tmpDomElement.style.width = computedStyle.width;
    tmpDomElement.style.height = computedStyle.height;
    tmpDomElement.style.margin = computedStyle.margin;
    tmpDomElement.style.padding = computedStyle.padding;
    tmpDomElement.style.boxSizing = computedStyle.boxSizing;
    // tmpDomElement.style.backgroundColor = "#ff0000A0";

    this.#spacerDomElement = tmpDomElement;
    this.#spacerIndex = itemIndex;
    let item =
      itemIndex > this.#itemList.length - 1 ? null : this.#itemList[itemIndex];

    this.element?.insertBefore(tmpDomElement, item ? item.element : null);
    this.reorderItemList();
  }

  removeGhostItem() {
    if (this.#spacerDomElement) {
      this.#spacerDomElement.remove();
      this.#spacerDomElement = null;
    }
  }

  addGhostBeforeItem(
    caller: ItemObject,
    itemIndex: number,
    differentRow: boolean,
  ) {
    if (differentRow) {
      // Save the DOM positions of all items
      this.queueUpdate("READ_1", () => {
        for (const item of this.#itemList) {
          item.readDom(false);
        }
      });
      // Remove the ghost item
      this.queueUpdate("WRITE_1", () => {
        this.removeGhostItem();
      });
      // Save the DOM positions after the ghost item is removed
      this.queueUpdate("READ_2", () => {
        for (const item of this.#itemList) {
          item.readDom(false);
          item.saveDomPropertyToTransform("READ_2");
        }
        this.reorderItemList();
        this.setItemRows(caller);
        this.updateItemIndexes();
        // Determine where the caller should be dropped
        let { dropIndex, localDropIndex, closestRowIndex } =
          caller.determineDropIndex();
        this.queueUpdate("WRITE_2", () => {
          // console.log("different row WRITE_2");
          this.addGhostItem(caller, dropIndex);
          caller.dropIndex = dropIndex;
          caller.localDropIndex = localDropIndex;
        });
      });
      this.queueUpdate("READ_3", () => {
        for (const item of this.#itemList) {
          item.readDom(false, "READ_3");
          item.saveDomPropertyToTransform("READ_3");
        }
        this.reorderItemList();
        this.setItemRows(caller);
        this.updateItemIndexes();
      });
    } else {
      this.queueUpdate("WRITE_1", () => {
        this.removeGhostItem();
        this.addGhostItem(caller, itemIndex);
      });
      this.queueUpdate("READ_2", () => {
        for (const item of this.#itemList) {
          item.readDom(false, "READ_2");
          item.saveDomPropertyToTransform("READ_2");
        }
        this.reorderItemList();
        this.setItemRows(caller);
        this.updateItemIndexes();
      });
    }
  }

  removeAllExpandAnimation() {
    this.queueUpdate("WRITE_1", () => {
      this.removeGhostItem();
    });
    this.queueUpdate("READ_2", () => {
      for (const item of this.#itemList) {
        item.readDom(false, "READ_2");
        item.saveDomPropertyToTransform("READ_2");
        // item.calculateLocalFromTransform();
      }
      this.setItemRows(null);
      this.reorderItemList();
    });
    this.#spacerIndex = -1;
  }

  pickUpItem(item: ItemObject) {
    this.#dragItem = item;
    this.removeItem(item);
  }

  addItemAfter(item: ItemObject, afterItem: ItemObject) {
    const index = this.#itemList.indexOf(afterItem);
    this.#itemList.splice(index + 1, 0, item);
    item.setContainer(this);
    this.#dragItem = null;
  }

  updateItemIndexes() {
    this.#itemList.forEach((item, index) => {
      item.indexInList = index;
    });
  }

  updateItemPositions() {
    this.#itemList.forEach((item) => {
      item.requestRead();
    });
  }
}
