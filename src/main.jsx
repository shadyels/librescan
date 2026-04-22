import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";
import { SessionProvider } from "./contexts/SessionContext.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SessionProvider>
      <AuthProvider>
        <App />
      </AuthProvider>
    </SessionProvider>
  </React.StrictMode>
);