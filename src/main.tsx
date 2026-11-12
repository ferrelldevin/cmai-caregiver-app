import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { askToKeepData } from "./data/persist";
import { loadLoggingCaregiver } from "./data/caregivers";
import { loadSession } from "./data/session";
import { ErrorBoundary } from "./ui/ErrorScreen";
import { listenForErrors } from "./ui/diagnostics";
import { listenForDisplay } from "./ui/display";
import { listenForInstall } from "./ui/install";
import "@fontsource/atkinson-hyperlegible-next/latin-400.css";
import "@fontsource/atkinson-hyperlegible-next/latin-600.css";
import "@fontsource/atkinson-hyperlegible-next/latin-700.css";
import "./styles.css";

registerSW({ immediate: true });
listenForInstall();
listenForDisplay();
listenForErrors();

// Who is logging, and the shift's sign-in, live in the database; read them before the first draw.
// If the database cannot be read, the app opens with nobody chosen and shows its own error.
void Promise.all([loadLoggingCaregiver(), loadSession()]).finally(() =>
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </StrictMode>,
  ),
);

// After the first paint, and never blocking it.
void askToKeepData();
