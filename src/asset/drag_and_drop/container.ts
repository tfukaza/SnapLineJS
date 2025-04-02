import { BaseObject } from "@/object";
import { GlobalManager } from "@/global";
import { ItemObject } from "./item";

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
