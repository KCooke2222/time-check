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
import { IoSettingsSharp, IoGrid, IoBarChart } from "react-icons/io5";
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
  const tone = !stats || ageH < 2 ? "text-gray-400" : ageH < 24 ? "text-amber-500" : "text-red-500";
  const s = stats?.last_sync_stats;
  const title = last
    ? `Last sync ${last.toLocaleString()}` + (s ? ` · +${s.events_added} ~${s.events_updated} −${s.events_deleted}` : "")
    : "Never synced";

  return (
    <button
      onClick={syncNow}
      disabled={syncing}
      title={title}
      className={`flex items-center gap-1 h-9 px-2 rounded-xl text-xs font-medium tabular-nums hover:bg-gray-100 transition ${tone}`}
    >
      <MdSync size={17} className={syncing ? "animate-spin-reverse" : ""} />
      {last ? ago(last) : "—"}
    </button>
  );
}

function TabLink({ to, icon: Icon, label }) {
  const location = useLocation();
  const active = location.pathname === to;
  return (
    <Link
      to={to}
      aria-label={label}
      className={`flex-1 flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium ${
        active ? "text-blue-600" : "text-gray-400"
      }`}
    >
      <Icon size={21} />
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
      className={`px-3 py-1.5 rounded-xl text-sm font-medium transition ${
        active
          ? "bg-gray-100 text-gray-900"
          : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
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
      <div className="min-h-screen flex items-center justify-center bg-gray-100">
        <div className="text-gray-500">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated)
    return <Login onLoginSuccess={checkAuthStatus} needsReauth={needsReauth} />;

  return (
    <Router basename={import.meta.env.BASE_URL.replace(/\/$/, '') || undefined}>
      <div className="min-h-screen bg-gray-100 relative pb-[calc(64px+env(safe-area-inset-bottom))] sm:pb-0">
        <div className="sticky top-0 z-40 sm:static flex justify-center px-3 sm:px-4 pt-[calc(env(safe-area-inset-top)+8px)] sm:pt-4 pb-2 bg-gray-100">
          <nav className="relative bg-white rounded-2xl shadow-sm border border-gray-100 pl-4 pr-2 sm:px-5 py-2 sm:py-3 flex items-center justify-between w-full max-w-[1400px]">
            {DEMO_MODE && (
              <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
                <span className="text-xs font-medium text-gray-300 tracking-widest uppercase">Demo</span>
              </div>
            )}
            <div className="flex items-center gap-8">
              <img src={logo} alt="Time Check" className="h-5" />
              <div className="hidden sm:flex gap-1">
                <NavLink to="/dashboard">Dashboard</NavLink>
                <NavLink to="/reports">Reports</NavLink>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <SyncStamp />
              <Link
                to="/settings"
                className="hidden sm:block p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                title="Settings"
              >
                <IoSettingsSharp size={17} />
              </Link>

              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="w-9 h-9 sm:w-8 sm:h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600 transition"
                >
                  {user?.email?.[0]?.toUpperCase()}
                </button>

                {dropdownOpen && (
                  <div className="absolute right-0 top-full mt-2 w-40 bg-white border border-gray-200 rounded-xl shadow-lg z-50">
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-4 py-2.5 text-sm text-red-600 hover:bg-red-50 rounded-xl transition"
                    >
                      Log out
                    </button>
                  </div>
                )}
              </div>

              <HubLink className="text-gray-500 bg-gray-100 hover:bg-gray-200" />
            </div>
          </nav>
        </div>

        <nav className="sm:hidden fixed bottom-0 inset-x-0 z-40 bg-white/95 backdrop-blur border-t border-gray-200 flex pb-[env(safe-area-inset-bottom)]">
          <TabLink to="/dashboard" icon={IoGrid} label="Dashboard" />
          <TabLink to="/reports" icon={IoBarChart} label="Reports" />
          <TabLink to="/settings" icon={IoSettingsSharp} label="Settings" />
        </nav>

        <main className="max-w-[1400px] mx-auto py-3 sm:py-6 px-3 sm:px-4">
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
