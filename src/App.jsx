import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Preferences from "./pages/Preferences";
import Results from "./pages/Results";
import Saved from "./pages/Saved";
import Recommendations from './pages/Recommendations';

function NavLink({ to, children }) {
  return (
    <Link
      to={to}
      className="relative group text-text-secondary hover:text-accent transition-colors duration-200 text-sm font-medium"
    >
      {children}
      <span className="absolute -bottom-0.5 left-0 w-0 h-px bg-accent group-hover:w-full transition-all duration-300" />
    </Link>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-bg-primary">
        <nav className="sticky top-0 z-40 bg-bg-primary/90 backdrop-blur-sm border-b border-border">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <Link to="/" className="font-display text-2xl font-semibold text-accent tracking-wide">
                LibreScan
              </Link>
              <div className="flex gap-8">
                <NavLink to="/">Home</NavLink>
                <NavLink to="/preferences">Preferences</NavLink>
                <NavLink to="/saved">Saved</NavLink>
              </div>
            </div>
          </div>
        </nav>

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/preferences" element={<Preferences />} />
            <Route path="/recommendations/:scanId" element={<Recommendations />} />
            <Route path="/results/:scanId" element={<Results />} />
            <Route path="/saved" element={<Saved />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
