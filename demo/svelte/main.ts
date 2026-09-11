import "../../css/snapdesign.scss";
import App from "./src/App.svelte";
import { mount } from "svelte";

const app = mount(App, {
  target: document.body,
});

export default app;
