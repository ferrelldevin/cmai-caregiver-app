// The last line of defence: a crash anywhere in the app shows one plain screen instead of a blank
// page, and a save that failed outside a button (an unhandled promise) shows the same alert the
// storage error uses. Nothing here touches stored data.

import { Component, useEffect, useState, type ReactNode } from "react";
import { record } from "./diagnostics";

/** Shows an alert when a promise fails and nothing caught it. */
function RejectionBanner() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const onReject = () => setFailed(true);
    window.addEventListener("unhandledrejection", onReject);
    return () => window.removeEventListener("unhandledrejection", onReject);
  }, []);
  if (!failed) return null;
  return (
    <div className="banner" role="alert">
      <b>That did not save.</b> Check the phone has free space, then try again. If it keeps happening, close the app and
      open it again.
    </div>
  );
}

export class ErrorBoundary extends Component<{ children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };

  static getDerivedStateFromError() {
    return { crashed: true };
  }

  componentDidCatch(error: Error) {
    record(error);
  }

  render() {
    if (this.state.crashed) {
      return (
        <main className="crash" role="alert">
          <h1>Something went wrong</h1>
          <p>Your saved logs are safe. Close the app and open it again.</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </main>
      );
    }
    return (
      <>
        <RejectionBanner />
        {this.props.children}
      </>
    );
  }
}
