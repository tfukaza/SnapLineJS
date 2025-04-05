import { BaseObject } from "../../object";
import { GlobalManager } from "../../global";
import { ItemObject } from "./item";

export class ItemContainer extends BaseObject {
  itemList: ItemObject[] = [];
  dragItem: ItemObject | null = null;
  _containerDomElement: HTMLElement | null = null;
  _dropIndex: number = 0;
  _expandAnimations: HTMLElement[] = [];
  _spacerDomElement: HTMLElement | null = null;
  spacerIndex: number = 0;
  direction: "column" | "row";
  constructor(global: GlobalManager, parent: BaseObject | null) {
    super(global, parent);
    this.itemList = [];
    this.direction = "column";
    this.spacerIndex = 0;
  }

  addItem(item: ItemObject) {
    this.itemList.push(item);
    item._containerObject = this;
    item.direction = this.direction;
  }

  removeItem(item: ItemObject) {
    this.itemList = this.itemList.filter((i) => i !== item);
  }

  reorderItemList() {
    this.itemList = this.itemList.sort((a, b) => {
      return a.dom.element.compareDocumentPosition(b.dom.element) &
        Node.DOCUMENT_POSITION_PRECEDING
        ? 1
        : -1;
    });
  }

  addExpandAnimationBeforeItem(caller: ItemObject, itemIndex: number) {
    this.requestWrite(() => {
      if (this._spacerDomElement) {
        this._spacerDomElement.remove();
        this._spacerDomElement = null;
      }
      if (itemIndex == -1) {
        return;
      }
      let tmpDomElement = document.createElement("div");
      tmpDomElement.id = "spacer";
      tmpDomElement.style.width = `${caller.dom.property.width}px`;
      tmpDomElement.style.height = `${caller.dom.property.height}px`;
      tmpDomElement.style.margin = caller.dom.element.style.margin;
      this._spacerDomElement = tmpDomElement;
      this.spacerIndex = itemIndex;
      let item =
        itemIndex > this.itemList.length - 1 ? null : this.itemList[itemIndex];
      this._containerDomElement?.insertBefore(
        tmpDomElement,
        item ? item.dom.element : null,
      );
      // caller.dom.element.innerHTML = `Spacer index: ${item?.gid}, GID: ${caller.gid}`;
      this.reorderItemList();
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
