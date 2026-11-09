import { BrowserRouter, Routes, Route, Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "motion/react";
import { LogOut } from "lucide-react";
import Home from "./pages/Home";
import Preferences from "./pages/Preferences";
import Results from "./pages/Results";
import Saved from "./pages/Saved";
import Recommendations from "./pages/Recommendations";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Button from "./components/ui/Button";
import { useAuth } from "./contexts/AuthContext";
import { ReadingProvider, ReadRule, useShellReading } from "./reading";
import { page, spring } from "./motion";

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `relative flex h-9 items-center rounded-full px-4 text-sm font-semibold transition-colors ${
          isActive ? "text-highlight-ink" : "text-ink-muted hover:text-ink"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="nav-active"
              transition={spring}
              className="absolute inset-0 rounded-full bg-highlight"
            />
          )}
          <span className="relative">{children}</span>
        </>
      )}
    </NavLink>
  );
}

function Account() {
  const { user, loading, logout } = useAuth();
  const navigate = useNavigate();

  if (loading) return <div className="h-10" />;

  if (user) {
    return (
      <div className="flex items-center gap-3">
        <span className="hidden max-w-56 truncate text-sm font-medium text-ink-muted md:block">{user.email}</span>
        <Button
          variant="secondary"
          size="sm"
          icon={LogOut}
          onClick={async () => {
            await logout();
            navigate("/");
          }}
        >
          Log out
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button to="/login" variant="secondary" size="sm">
        Log in
      </Button>
      <Button to="/signup" size="sm">
        Sign up
      </Button>
    </div>
  );
}

function Shell() {
  const location = useLocation();
  const { user } = useAuth();
  const reading = useShellReading();

  const links = (
    <>
      <NavItem to="/">Scan</NavItem>
      {user && <NavItem to="/saved">Saved</NavItem>}
      {user && <NavItem to="/preferences">Preferences</NavItem>}
    </>
  );

  return (
    <div className="min-h-screen">
      <header>
        <div className="mx-auto flex h-18 max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-10">
          <Link to="/" className="type-display text-[27px]">
            LibreScan
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-1 sm:flex">
            {links}
          </nav>
          <div className="ml-auto">
            <Account />
          </div>
        </div>
        {user && (
          <nav aria-label="Main" className="flex gap-1 px-3 pb-2 sm:hidden">
            {links}
          </nav>
        )}
        <ReadRule reading={reading} />
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10 lg:px-10">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={location.pathname} {...page}>
            <Routes location={location}>
              <Route path="/" element={<Home />} />
              <Route path="/preferences" element={<Preferences />} />
              <Route path="/recommendations/:scanId" element={<Recommendations />} />
              <Route path="/results/:scanId" element={<Results />} />
              <Route path="/saved" element={<Saved />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ReadingProvider>
        <Shell />
      </ReadingProvider>
    </BrowserRouter>
  );
}
