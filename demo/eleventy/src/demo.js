import SnapLine from "./lib/snapline.js";

const sl = new SnapLine("node-editor");

let addNodeMenu = null;
let themeMenu = null;

document.addEventListener("DOMContentLoaded", function () {
    addNodeMenu = document.getElementById("addNodeButton");
    themeMenu = document.getElementById("themeButton");

    document.getElementById("addNodeButton").addEventListener("click", (e) => toggleMenu(e, "addNodeMenu"));
    document.getElementById("themeButton").addEventListener("click", (e) => toggleMenu(e, "themeMenu"));

    document.getElementById("mathButton").addEventListener("mouseup", (e) => addNode(e, "node-math"));
    document.getElementById("lerpButton").addEventListener("mouseup", (e) => addNode(e, "node-lerp"));
    document.getElementById("printButton").addEventListener("mouseup", (e) => addNode(e, "node-print"));
    document.getElementById("constantButton").addEventListener("mouseup", (e) => addNode(e, "node-constant"));

    document.getElementById("standardButton").addEventListener("mouseup", (e) => setTheme(e, "theme-standard"));
    document.getElementById("darkButton").addEventListener("mouseup", (e) => setTheme(e, "theme-dark"));
    document.getElementById("retroButton").addEventListener("mouseup", (e) => setTheme(e, "theme-retro"));
});


document.addEventListener("click", function (e) {

    console.debug("click", e.target);

    addNodeMenu.classList.remove("show-menu");
    themeMenu.classList.remove("show-menu");



});

function toggleMenu(e, id) {
    console.debug("toggleMenu", id);
    if (id === "addNodeMenu") {
        addNodeMenu.classList.add("show-menu");
        themeMenu.classList.remove("show-menu");
    } else if (id === "themeMenu") {
        themeMenu.classList.add("show-menu");
        addNodeMenu.classList.remove("show-menu");
    }

    e.stopPropagation();

}

function addNode(e, node) {
    let dom = document.getElementById(node).content.firstElementChild;
    dom = dom.cloneNode(true);
    let n = sl.createNodeAuto(dom);

    sl.addNodeAtMouse(n, e);

    toggleMenu(e, "addNodeMenu");
}


function setTheme(e, theme) {

    let themes = document.querySelectorAll('.theme');
    for (let i = 0; i < themes.length; i++) {
        themes[i].media = "none";
    }
    let node = document.getElementById(theme);
    node.media = "";

    toggleMenu(e, "themeMenu");
}

