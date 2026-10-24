import { useState, useEffect } from "react";
import { authAPI } from "../services/api";
import HubLink from "./HubLink";

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";

// The OAuth state lives in a cookie bound to the hostname this page was opened
// on, but Google only ever redirects to the one registered callback origin. A
// sign-in started anywhere else (127.0.0.1, time.localhost, ...) comes back
// without its cookie and fails. So before redirecting to Google, hop to that
// origin and let it start the flow itself (`?signin=1`).
//
// Module-level so React StrictMode's double-run of effects cannot start two
// flows: each would set its own state cookie and only one can win.
let autoSigninStarted = false;

// Read the query hints once and strip them from the URL. Cached at module
// level for the same reason: StrictMode runs state initializers twice, and
// the second run would see the already-cleaned URL and drop the hints.
let cachedHints = null;

function readHints() {
  if (cachedHints) return cachedHints;
  const params = new URLSearchParams(window.location.search);
  cachedHints = {
    autoSignin: params.get("signin") === "1",
    movedOrigin: params.get("auth_error") === "origin",
  };
  if (cachedHints.autoSignin || cachedHints.movedOrigin) {
    window.history.replaceState(null, "", window.location.pathname);
  }
  return cachedHints;
}

function Login({ onLoginSuccess, needsReauth = false }) {
  const [isLoading, setIsLoading] = useState(false);
  const hints = readHints();

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const response = await authAPI.login();
      const canonical = response.canonical_origin;
      if (canonical && canonical !== window.location.origin) {
        const base = import.meta.env.BASE_URL.replace(/\/$/, "");
        window.location.href = `${canonical}${base}/?signin=1`;
        return;
      }
      window.location.href = response.authorization_url;
    } catch {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (DEMO_MODE || !hints.autoSignin || autoSigninStarted) return;
    autoSigninStarted = true;
    handleLogin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDemoLogin = () => {
    localStorage.setItem("demo_authed", "true");
    onLoginSuccess();
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-oat gap-8">
      <div className="fixed right-3 top-[calc(env(safe-area-inset-top)+12px)]">
        <HubLink className="text-muted bg-soft hover:bg-line" />
      </div>
      <span className="text-ink text-2xl font-semibold tracking-tight">
        Time Check
      </span>

      {needsReauth && !DEMO_MODE && (
        <p className="text-warn text-sm -mt-4 text-center max-w-xs">
          Your Google access expired. Sign in again to keep syncing your
          calendar.
        </p>
      )}

      {hints.movedOrigin && !DEMO_MODE && (
        <p className="text-warn text-sm -mt-4 text-center max-w-xs">
          Sign-in has to run from {window.location.host}, so you were brought
          here. Starting it again.
        </p>
      )}

      {DEMO_MODE ? (
        <div className="flex flex-col items-center gap-3">
          <button
            onClick={handleDemoLogin}
            className="flex items-center gap-2 bg-ink text-white px-6 py-2.5 rounded-lg font-medium hover:bg-ink/90 transition"
          >
            View Demo
          </button>
        </div>
      ) : (
        <button
          onClick={handleLogin}
          disabled={isLoading}
          className="flex items-center gap-3 bg-panel border border-line text-ink px-5 py-2.5 rounded-lg font-medium hover:bg-soft transition disabled:opacity-50"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            />
          </svg>
          {isLoading ? "Redirecting..." : "Sign in with Google"}
        </button>
      )}
    </div>
  );
}

export default Login;
