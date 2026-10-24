import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { authAPI, calendarAPI, setReauthHandler } from "./services/api";
import { MdSync } from "react-icons/md";
import logo from "./assets/logo.svg";
import { SYNCED_EVENT } from "./utils/syncEvents";

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
import Dashboard from "./components/Dashboard";
import Reports from "./components/Reports";
import Settings from "./components/Settings";
import Login from "./components/Login";
import HubLink from "./components/HubLink";

function ago(date) {
  const min = Math.max(0, Math.round((Date.now() - date.getTime()) / 60000));
  if (min < 60) return `${min}m`;
  if (min < 48 * 60) return `${Math.round(min / 60)}h`;
  return `${Math.round(min / 1440)}d`;
}

// Age of the last successful sync; tap to sync now. Detail in the hover title.
function SyncStamp() {
  const [stats, setStats] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [, tick] = useState(0);

  const load = () => calendarAPI.syncStats().then(setStats).catch(() => {});
  useEffect(() => {
    load();
    const poll = setInterval(load, 5 * 60 * 1000);
    const clock = setInterval(() => tick((n) => n + 1), 60 * 1000);
    window.addEventListener(SYNCED_EVENT, load);
    return () => {
      clearInterval(poll);
      clearInterval(clock);
      window.removeEventListener(SYNCED_EVENT, load);
    };
  }, []);

  const syncNow = async () => {
    setSyncing(true);
    try {
      await calendarAPI.sync();
      window.dispatchEvent(new Event(SYNCED_EVENT));
    } catch (e) {
      console.error("Sync failed:", e);
    } finally {
      setSyncing(false);
    }
  };

  const last = stats?.latest_sync_time ? new Date(stats.latest_sync_time) : null;
  const ageH = last ? (Date.now() - last.getTime()) / 3600000 : Infinity;
  const dot = !stats ? "bg-line" : ageH < 2 ? "bg-good" : ageH < 24 ? "bg-[#c39a45]" : "bg-warn";
  const s = stats?.last_sync_stats;
  const title = last
    ? `Last sync ${last.toLocaleString()}` + (s ? ` · +${s.events_added} ~${s.events_updated} −${s.events_deleted}` : "")
    : "Never synced";

  return (
    <button
      onClick={syncNow}
      disabled={syncing}
      title={title}
      className="flex items-center gap-1.5 h-9 px-2 rounded-lg text-xs text-muted num hover:bg-soft transition"
    >
      {syncing ? <MdSync size={14} className="animate-spin-reverse" /> : <i className={`w-[7px] h-[7px] rounded-full ${dot}`} />}
      {last ? ago(last) : "—"}
    </button>
  );
}

const ico = { width: 20, height: 20, viewBox: "0 0 20 20", fill: "none", stroke: "currentColor", strokeWidth: 1.7 };
const DashIcon = () => (
  <svg {...ico}><rect x="3" y="3" width="6" height="6" rx="1.5" /><rect x="11" y="3" width="6" height="6" rx="1.5" /><rect x="3" y="11" width="6" height="6" rx="1.5" /><rect x="11" y="11" width="6" height="6" rx="1.5" /></svg>
);
const RepIcon = () => <svg {...ico}><path d="M4 16V9M10 16V4M16 16v-5" /></svg>;
const SetIcon = () => (
  <svg {...ico}><circle cx="10" cy="10" r="2.6" /><path d="M10 2.5v2.2M10 15.3v2.2M2.5 10h2.2M15.3 10h2.2M4.7 4.7l1.6 1.6M13.7 13.7l1.6 1.6M4.7 15.3l1.6-1.6M13.7 6.3l1.6-1.6" /></svg>
);

function TabLink({ to, icon: Icon, label }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      aria-label={label}
      className={`flex-1 flex flex-col items-center gap-0.5 pt-1.5 pb-1 text-[11px] ${
        active ? "text-ink font-semibold" : "text-muted"
      }`}
    >
      <Icon />
      {label}
    </Link>
  );
}

function NavLink({ to, children }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      className={`px-3 py-1 rounded-lg text-sm transition border ${
        active
          ? "bg-panel text-ink font-semibold border-line"
          : "text-muted border-transparent hover:text-ink"
      }`}
    >
      {children}
    </Link>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);
  const [needsReauth, setNeedsReauth] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    // A grant that dies mid-session shows up as a 401 on whichever call runs
    // next, not on the startup status check, so take that answer too.
    setReauthHandler(() => {
      setNeedsReauth(true);
      setIsAuthenticated(false);
      setUser(null);
    });
    return () => setReauthHandler(null);
  }, []);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const checkAuthStatus = async () => {
    if (DEMO_MODE) {
      const authed = localStorage.getItem('demo_authed') === 'true';
      setIsAuthenticated(authed);
      if (authed) setUser({ email: 'demo@timecheck.app', id: 1 });
      setIsLoading(false);
      return;
    }
    try {
      const status = await authAPI.getStatus();
      // A live session with a dead Google grant is not usable: every calendar
      // call would fail. Treat it as signed out so the user is offered the
      // OAuth flow instead of a dashboard that only returns errors.
      setNeedsReauth(Boolean(status.authenticated && status.reauth_required));
      setIsAuthenticated(status.authenticated && !status.reauth_required);
      if (status.authenticated && !status.reauth_required) setUser(status.user);
    } catch (error) {
      console.error("Auth check failed:", error);
      setIsAuthenticated(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    if (DEMO_MODE) {
      localStorage.removeItem('demo_authed');
      setIsAuthenticated(false);
      setUser(null);
      return;
    }
    try {
      await authAPI.logout();
      setIsAuthenticated(false);
      setUser(null);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-oat">
        <div className="text-muted">…</div>
      </div>
    );
  }

  if (!isAuthenticated)
    return <Login onLoginSuccess={checkAuthStatus} needsReauth={needsReauth} />;

  return (
    <Router basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      <div className="min-h-screen bg-oat relative pb-[calc(64px+env(safe-area-inset-bottom))] sm:pb-0">
        <header className="sticky top-0 z-40 bg-oat/95 backdrop-blur pt-[env(safe-area-inset-top)]">
          <nav className="relative flex items-center gap-2 max-w-[1100px] mx-auto px-4 py-2.5">
            <img src={logo} alt="Time Check" className="h-[18px]" />
            {DEMO_MODE && (
              <span className="text-[10px] font-medium text-muted/60 tracking-widest uppercase">Demo</span>
            )}
            <div className="hidden sm:flex gap-1 ml-4">
              <NavLink to="/dashboard">Dashboard</NavLink>
              <NavLink to="/reports">Reports</NavLink>
              <NavLink to="/settings">Settings</NavLink>
            </div>

            <div className="flex items-center gap-1 ml-auto">
              <SyncStamp />
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="w-8 h-8 rounded-lg bg-soft hover:bg-line flex items-center justify-center text-sm font-semibold text-muted transition"
                  title={user?.email}
                >
                  {user?.email?.[0]?.toUpperCase()}
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-36 panel shadow-lg z-50 overflow-hidden">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3.5 py-2.5 text-sm text-warn hover:bg-soft transition"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>

              <HubLink className="text-muted bg-soft hover:bg-line" />
            </div>
          </nav>
        </header>

        <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-panel border-t border-line flex pb-[env(safe-area-inset-bottom)]">
          <TabLink to="/dashboard" icon={DashIcon} label="Dashboard" />
          <TabLink to="/reports" icon={RepIcon} label="Reports" />
          <TabLink to="/settings" icon={SetIcon} label="Settings" />
        </nav>

        <main className="max-w-[1100px] mx-auto pt-1 pb-6 px-4">
          <Routes>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;
