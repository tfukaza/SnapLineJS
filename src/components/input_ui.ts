import { addLabel } from "../helper";
import { NodeUI } from "./node";
import { ComponentConfig, GlobalStats } from "../types";
import { ComponentBase } from "./base";
import { InputInterface } from "./component";

abstract class InputUI extends ComponentBase {

    inputDOM: HTMLElement | null;
    inputItf: InputInterface;

    constructor(config: ComponentConfig, parent: NodeUI, globals: GlobalStats, inputItf: InputInterface) {
        super(config, parent, globals);
        this.inputDOM = null;
        this.inputItf = inputItf;
    }

    triggerExec(_: Event): void {
        this.inputItf.parent?.run();
    }

    abstract getInputValue(): any;
}

class InputUiText extends InputUI {
    constructor(config: ComponentConfig, parent: NodeUI, globals: GlobalStats, inputItf: InputInterface) {
        super(config, parent, globals, inputItf);
        addLabel(inputItf.dom!, config);
        const inp = document.createElement('input');
        inp.classList.add('sl-input-text');
        inp.type = 'text';
        inputItf.dom!.appendChild(inp);
        this.inputDOM = inp;

        inp.onkeyup = this.triggerExec.bind(this);
    }

    getInputValue() {
        return (<HTMLInputElement>this.inputDOM!).value;
    }
}

class InputUiBool extends InputUI {
    constructor(config: ComponentConfig, parent: NodeUI, globals: GlobalStats, inputItf: InputInterface) {
        super(config, parent, globals, inputItf);
        addLabel(inputItf.dom!, config);
        const inp = document.createElement('input');
        inp.classList.add('sl-input-bool');
        inp.type = 'checkbox';
        inputItf.dom!.appendChild(inp);
        this.inputDOM = inp;

        inp.onkeyup = this.triggerExec.bind(this);
    }

    getInputValue() {
        return (<HTMLInputElement>this.inputDOM!).checked;
    }
}

class InputUiFloat extends InputUI {
    cur_w: number;
    x_cur: number;
    x_min: number;
    x_max: number;
    slider_w: number;
    floatSliderContainer: HTMLElement;
    floatSlider: HTMLElement;
    floatEditor: HTMLInputElement;
    floatContainer: HTMLElement;

    constructor(config: ComponentConfig, parent: NodeUI, globals: GlobalStats, inputItf: InputInterface) {
        super(config, parent, globals, inputItf);

        this.x_cur = 0;
        this.x_min = ('x_min' in config) ? config.x_min : 0;
        this.x_max = ('x_max' in config) ? config.x_max : this.x_min + 1;
        this.slider_w = 0;
        this.cur_w = 0;


        const floatContainer = document.createElement('div');
        const floatEditor = document.createElement('input');
        const floatSliderContainer = document.createElement('div');
        const floatSlider = document.createElement('div');
        floatContainer.classList.add('sl-input-float-container');
        floatContainer.style.position = "relative";
        floatContainer.style.overflow = "hidden";
        floatContainer.style.flexGrow = "1";
        floatContainer.style.display = "flex";

        floatEditor.classList.add('sl-input-float-editor');
        floatEditor.style.backgroundColor = "transparent";
        floatEditor.style.position = "relative";
        floatEditor.style.width = "100%";
        //floatEditor.style.height = "100%";
        floatEditor.type = 'text';
        floatEditor.style.textAlign = "right";
        floatEditor.style.zIndex = "10";

        floatSliderContainer.classList.add('sl-input-float-slider-container');
        floatSliderContainer.style.position = "relative";
        floatSliderContainer.style.zIndex = "1";
        //floatSliderContainer.style.height = "100%";
        floatSliderContainer.style.overflow = "hidden";
        //floatSliderContainer.style.width = "100%";
        //floatSliderContainer.style.top = '0px';

        floatSlider.classList.add('sl-input-float-slider');
        floatSlider.style.width = "10px";
        floatSlider.style.height = "100%";
        floatSlider.style.top = "0px";
        floatSlider.style.left = "0";
        floatSlider.style.position = "absolute";
        floatSlider.style.zIndex = "10";

        floatSliderContainer.appendChild(floatSlider);
        addLabel(floatContainer, config);
        floatContainer.appendChild(floatSliderContainer);
        floatSliderContainer.appendChild(floatEditor);

        inputItf.dom!.appendChild(floatContainer);

        this.inputDOM = floatEditor;

        floatEditor.onchange = this.triggerExec.bind(this);
        floatSlider.onmousedown = this.triggerExec.bind(this);

        this.floatSlider = floatSlider;
        this.floatEditor = floatEditor;
        this.floatContainer = floatContainer;
        this.floatSliderContainer = floatSliderContainer;

        this.bindFunction(floatContainer);

    }

    customMouseDown() {
        this.cur_w = parseInt(this.floatSlider.style.width, 10);
        this.slider_w = this.floatSliderContainer.getBoundingClientRect().width / this.g.zoom;
        console.log(this.slider_w)
        this.floatEditor.blur();
    }

    onDrag() {
        this.floatEditor.blur();
        //const diff = (this.x_max - this.x_min)/this.slider_w;
        const inc = 50;
        const v_inc = (this.x_max - this.x_min) / inc;
        const s_inc = this.slider_w / inc;
        let slider_cur = this.cur_w + this.g.dx / this.g.zoom;
        slider_cur = Math.ceil(slider_cur / s_inc) * s_inc;
        slider_cur = Math.min(Math.max(slider_cur, 0), this.slider_w);

        this.floatSlider.style.width = slider_cur + 'px';
        this.x_cur = Math.min(Math.max(this.x_min + slider_cur / this.slider_w, this.x_min), this.x_max);
        this.x_cur = Math.ceil(this.x_cur / v_inc) * v_inc;
        this.floatEditor.value = this.x_cur.toFixed(3)

        this.inputItf.parent?.run();
    }

    domMouseUp(): void {
        this.floatEditor.focus();
    }

    getInputValue() {
        return parseFloat((<HTMLInputElement>this.inputDOM!).value)
    }
}

class InputUiFloatInfinite extends InputUI {

    x_cur: number;
    floatSliderContainer: HTMLElement;
    floatEditor: HTMLInputElement;
    floatContainer: HTMLElement;

    constructor(config: ComponentConfig, parent: NodeUI, globals: GlobalStats, inputItf: InputInterface) {
        super(config, parent, globals, inputItf);

        this.x_cur = 0;


        const floatContainer = document.createElement('div');
        const floatEditor = document.createElement('input');
        const floatSliderContainer = document.createElement('div');
        floatContainer.classList.add('sl-input-float-container');
        floatContainer.style.position = "relative";
        floatContainer.style.overflow = "hidden";
        floatContainer.style.flexGrow = "1";
        floatContainer.style.display = "flex";

        floatEditor.classList.add('sl-input-float-editor');
        floatEditor.style.backgroundColor = "transparent";
        floatEditor.style.position = "relative";
        floatEditor.style.width = "100%";
        //floatEditor.style.height = "100%";
        floatEditor.type = 'text';
        floatEditor.style.textAlign = "right";
        floatEditor.style.zIndex = "10";

        floatSliderContainer.classList.add('sl-input-float-slider-container');
        floatSliderContainer.style.position = "relative";
        floatSliderContainer.style.zIndex = "1";
        //floatSliderContainer.style.height = "100%";
        floatSliderContainer.style.overflow = "hidden";
        //floatSliderContainer.style.width = "100%";
        //floatSliderContainer.style.top = '0px';

        addLabel(floatContainer, config);
        floatContainer.appendChild(floatSliderContainer);
        floatSliderContainer.appendChild(floatEditor);

        inputItf.dom!.appendChild(floatContainer);

        this.inputDOM = floatEditor;

        floatEditor.onchange = this.triggerExec.bind(this);

        this.floatEditor = floatEditor;
        this.floatContainer = floatContainer;
        this.floatSliderContainer = floatSliderContainer;

        this.bindFunction(floatContainer);

    }

    customMouseDown() {
        this.x_cur = parseFloat(this.floatEditor.value) || 0;
        this.floatEditor.blur();
    }

    onDrag() {
        this.floatEditor.blur();

        const inc = 0.1;

        let cur = Math.ceil((this.x_cur + this.g.dx * 0.1) / inc) * inc;
        this.floatEditor.value = cur.toFixed(3)

        this.inputItf.parent?.run();
    }

    domMouseUp(): void {
        this.floatEditor.focus();
    }

    getInputValue() {
        return parseFloat((<HTMLInputElement>this.inputDOM!).value)
    }
}


export {
    InputUI,
    InputUiText,
    InputUiBool,
    InputUiFloat,
    InputUiFloatInfinite

}