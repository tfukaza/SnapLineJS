import { ComponentConfig, GlobalStats } from "./types";

function isBetween(x: number, a: number, b: number) {
    return (x >= a && x <= b) || (x >= b && x <= a);
}


function worldToCamera(x: number, y: number, g: GlobalStats) {
    const s1 = g.zoom;
    const s2 = g.zoom;
    const t1 = -x * g.zoom + g.cameraWidth / 2;
    const t2 = -y * g.zoom + g.cameraHeight / 2;
    return `${s1},0,0,0,0,${s2},0,0,0,0,1,0,${t1},${t2},0,1`;
}

function addLabel(dom: HTMLElement, config: ComponentConfig) {
    if (config.name === "") {
        return;
    }
    const label = document.createElement('span');
    label.classList.add('sl-label');
    label.innerText = config.name;
    //label.style.position = "relative";
    label.style.zIndex = "99"

    dom.appendChild(label);

    return label
}

export {
    isBetween,
    worldToCamera,
    addLabel
}