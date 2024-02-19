const sl = new SnapLine("node-editor");

const addNodeMenu = document.getElementById("addNodeMenu");
const themeMenu = document.getElementById("themeMenu");

function toggleMenu(id) {
    if (id === "addNodeMenu") {
        addNodeMenu.classList.toggle("hide");
        themeMenu.classList.add("hide");
    } else if (id === "themeMenu") {
        themeMenu.classList.toggle("hide");
        addNodeMenu.classList.add("hide");
    }
}

function addNode(node, e) {
    toggleMenu("addNodeMenu");
    sl.addNodeAtMouse(node, e);
}

function setTheme(theme) {
    toggleMenu("themeMenu");
    let themes = document.querySelectorAll('.theme');
    for (let i = 0; i < themes.length; i++) {
        themes[i].media = "none";
    }
    let node = document.getElementById(theme);
    node.media = "";
}