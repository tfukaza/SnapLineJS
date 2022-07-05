import {ComponentBase} from './base';
import { ComponentConfig, GlobalStats} from '../types';
import { NodeUI } from "../node"
import { addLabel } from '../helper';
import { InputConnector, OutputConnector } from './connector';
import { InputUI, InputUiBool, InputUiFloat, InputUiText } from './input_ui';

/*  
    A general class tio contain all elements in a node
*/
class Interface extends ComponentBase {

    name:string;

    constructor(config: ComponentConfig, parent: NodeUI, globals:GlobalStats) {
        super(config, parent, globals);
        this.name = config.name;
        this.parent!.elements[this.name] = this;
    }

}

class InputInterface extends Interface {

    input: InputConnector;
    inputUI: InputUI | null;
    name: string;

    constructor(config: ComponentConfig, parent: NodeUI, globals: GlobalStats){

        super(config, parent, globals);

        const input = document.createElement('div');
        input.classList.add('sl-input');

        this.input = new InputConnector(config, parent, globals);

        input.appendChild(<Node>this.input.dom);
        this.dom = input;

        this.name = config.name;
        this.parent!.elements[this.name] = this;

        switch (config.type) {
            case 'input-text':
                this.inputUI = new InputUiText(config, parent, globals, this);
                break; 
            case 'input-bool':
                this.inputUI = new InputUiBool(config, parent, globals, this);
                break; 
            case 'input-float':
                this.inputUI = new InputUiFloat(config, parent, globals, this);
                break;
            default:
                this.inputUI = null;
            }
        
        this.bindFunction(this.dom);
    }

    // updateConnectorPosition() {
    //     this.connector_x = this.parent!.position_x + this.c_total_offset_x;
    //     this.connector_y = this.parent!.position_y + this.c_total_offset_y;
    // }
    
    // disconnectFromOutput() {
    //     this.peerOutput = null;
    //     this.dom?.classList.remove("connected");
    // }
    
    // connectToOutput(output: OutputComponent) {
    //     this.peerOutput = output;
    //     this.dom?.classList.add("connected");
    // }
    
    // nodeDrag() {
    //     this.updateConnectorPosition();
    //     if (!this.peerOutput) {
    //         return;
    //     }
    //     this.peerOutput.nodeDrag();
    // }

    getValue() {
        if (this.input.peerOutput) {
            return this.input.peerOutput.getValue();
        } else if (this.inputUI){
            return this.inputUI.getInputValue();
        }
        return null;
    }

}


class OutputInterface extends Interface {

    output: OutputConnector;
    name: string;

    constructor(config: ComponentConfig, parent: NodeUI, globals:GlobalStats) {
        super(config, parent, globals);
        
        const out = document.createElement('div');
        out.classList.add('sl-output');

        addLabel(out, config);
        
        this.output = new OutputConnector(config, parent, globals);
        out.appendChild(<Node>this.output.dom);
        
        this.dom = out;
        this.name = config.name;

        this.parent!.elements[this.name] = this;
    }

    getValue() {
        this.parent!.exec();
        return this.output.val;
    }
    
    setValue(val: any) {
        this.output.val = val;
    }
    
  
}


class uiComponent extends ComponentBase {

    parentContent: HTMLElement;
    getUIvalue: Function;
    setUIvalue: Function;
    
    name: string;

    constructor(config: ComponentConfig, parent: NodeUI, globals:GlobalStats, content: HTMLElement) {

        super(config, parent, globals);

        this.parentContent = content;
        this.name = config.name;
        this.getUIvalue = () => { return null };
        this.setUIvalue = (v: any) => { console.debug(v); };

        const cont = document.createElement('div');
        cont.classList.add('sl-ui');
    
        const uiType = config.type;
        switch (uiType) {
            case 'ui-paragraph':
                const ui = document.createElement('p');
                ui.style.pointerEvents = 'none';
                ui.innerText = config.text;
                cont.appendChild(ui);
                break;
            case 'ui-display':
                const display = document.createElement('p');
                display.style.pointerEvents = 'none';
                display.innerText = "Output";
                cont.appendChild(display);
                this.setSetFunction((v: any) => { display.innerText = v})
                break;
            case 'ui-dropdown':
                const dropdown = document.createElement('select');
                dropdown.classList.add('sl-ui-dropdown');
                for (const option of config.values) {
                    const opt = document.createElement('option');
                    opt.innerText = option.label;
                    opt.value = option.value;
                    dropdown.appendChild(opt);
                }
                cont.appendChild(dropdown);
                this.setGetFunction(() => { return dropdown.value });
                this.setExecTrigger(dropdown, 'change');
                break;
        }
        this.dom = cont;
        if (this.name) {
            this.parent!.elements[this.name] = this;
        }
    }

    setExecTrigger(dom: HTMLElement, event: string){
        dom.addEventListener(event, () => {
            this.parent?.findLeaf();
        });
        console.debug(dom, event);
    }

    setGetFunction(f: Function) {
        this.getUIvalue = f;
    }

    setSetFunction(f: Function) {
        this.setUIvalue = f;
    }

    getValue() {
        return this.getUIvalue();
    }

    setValue(val: any) {
        return this.setUIvalue(val);
    }
}

class customComponent extends ComponentBase {

    parentContent: HTMLElement;
    getUIvalue: Function;
    setUIvalue: Function;

    constructor(config: ComponentConfig, parent: NodeUI, globals:GlobalStats, content: HTMLElement) {

        super(config, parent, globals);

        this.parentContent = content;

        this.getUIvalue = () => { return null };
        this.setUIvalue = (v:any) => { console.debug(v) };

        const template = document.createElement('template');
        template.innerHTML = config.html.trim();
        this.dom = <HTMLElement>template.content.firstChild
    }

    setExecTrigger(dom: HTMLElement, event:string){
        console.debug(dom, event);
    }

    setGetFunction(f: Function) {
        this.getUIvalue = f;
    }

    setSetFunction(f: Function) {
        this.setUIvalue = f;
    }

    getValue() {
        return this.getUIvalue();
    }

    setValue(val:any) {
        return this.setUIvalue(val);
    }
}


export {
    uiComponent,
    customComponent,
    InputInterface,
    OutputInterface
}
