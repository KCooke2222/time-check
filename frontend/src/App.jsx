import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
  Link,
  useLocation,
} from "react-router-dom";
import { useState, useEffect, useRef } from "react";
import { authAPI, setReauthHandler } from "./services/api";
import { IoSettingsSharp } from "react-icons/io5";
import { IoChevronDown } from "react-icons/io5";
import logo from "./assets/logo.svg";

const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';
import Dashboard from "./components/Dashboard";
import Reports from "./components/Reports";
import Settings from "./components/Settings";
import Login from "./components/Login";

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
      <div className="min-h-screen bg-gray-100 relative">
        <div className="flex justify-center px-4 pt-4 pb-2">
          <nav className="relative bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-3 flex items-center justify-between w-full max-w-[1400px]">
            {DEMO_MODE && (
              <div className="absolute left-1/2 -translate-x-1/2 pointer-events-none">
                <span className="text-xs font-medium text-gray-300 tracking-widest uppercase">Demo</span>
              </div>
            )}
            <div className="flex items-center gap-8">
              <img src={logo} alt="Time Check" className="h-5" />
              <div className="flex gap-1">
                <NavLink to="/dashboard">Dashboard</NavLink>
                <NavLink to="/reports">Reports</NavLink>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <Link
                to="/settings"
                className="p-2 rounded-xl text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition"
                title="Settings"
              >
                <IoSettingsSharp size={17} />
              </Link>

              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setDropdownOpen((o) => !o)}
                  className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-sm font-semibold text-gray-600 transition"
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
            </div>
          </nav>
        </div>


        <main className="max-w-[1400px] mx-auto py-6 px-4">
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
