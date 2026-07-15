import { render } from "preact";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import { App } from "./app";
import { ToastProvider } from "./toast";

const root = document.getElementById("app");
if (root) {
  render(
    <ToastProvider>
      <App />
    </ToastProvider>,
    root,
  );
}
