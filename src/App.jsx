import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/Home";
import Preferences from "./pages/Preferences";
import Results from "./pages/Results";
import Saved from "./pages/Saved";

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-gray-50">
        {/* Navigation Header */}
        <nav className="bg-white shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <Link to="/" className="text-2xl font-bold text-blue-600">
                LibreScan
              </Link>
              <div className="flex gap-6">
                <Link to="/" className="text-gray-700 hover:text-blue-600">
                  Home
                </Link>
                <Link
                  to="/preferences"
                  className="text-gray-700 hover:text-blue-600"
                >
                  Preferences
                </Link>
                <Link to="/saved" className="text-gray-700 hover:text-blue-600">
                  Saved
                </Link>
              </div>
            </div>
          </div>
        </nav>

        {/* Page Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/preferences" element={<Preferences />} />
            <Route path="/results/:scanId" element={<Results />} />
            <Route path="/saved" element={<Saved />} />
          </Routes>
        </main>
      </div>
    </BrowserRouter>
  );
}

export default App;
