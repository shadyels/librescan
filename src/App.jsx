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
import { SpectrumBand, SpectrumProvider, useShellBand } from "./spectrum";
import { page, spring } from "./motion";

function NavItem({ to, children }) {
  return (
    <NavLink
      to={to}
      end={to === "/"}
      className={({ isActive }) =>
        `relative flex h-10 items-center text-sm transition-colors ${
          isActive ? "font-bold text-ink" : "font-medium text-ink-muted hover:text-ink"
        }`
      }
    >
      {({ isActive }) => (
        <>
          {children}
          {isActive && (
            <motion.span layoutId="nav-active" transition={spring} className="absolute inset-x-0 bottom-0.5 h-0.5 bg-ink" />
          )}
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
        <span className="hidden max-w-56 truncate text-sm text-ink-muted md:block">{user.email}</span>
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
  const band = useShellBand();

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
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-8 px-4 sm:px-6 lg:px-10">
          <Link to="/" className="type-display text-[26px] normal-case tracking-normal">
            LibreScan
          </Link>
          <nav aria-label="Main" className="hidden items-center gap-6 sm:flex">
            {links}
          </nav>
          <div className="ml-auto">
            <Account />
          </div>
        </div>
        {user && (
          <nav aria-label="Main" className="flex gap-6 px-4 sm:hidden">
            {links}
          </nav>
        )}
        <SpectrumBand colors={band?.colors} reading={band?.reading} className="h-5 sm:h-7" />
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
      <SpectrumProvider>
        <Shell />
      </SpectrumProvider>
    </BrowserRouter>
  );
}
