import { render } from "preact";
import "./styles/fonts.css";
import "./styles/tokens.css";
import "./styles/base.css";
import "./styles/components.css";
import { prefetchRoute } from "./api";
import { App } from "./app";
import { ToastProvider } from "./toast";

// Before the first render, so the view's data is already in flight by the time
// it mounts.
prefetchRoute(location.hash);

const root = document.getElementById("app");
if (root) {
  render(
    <ToastProvider>
      <App />
    </ToastProvider>,
    root,
  );
}
