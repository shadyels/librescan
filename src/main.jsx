import React from "react";
import ReactDOM from "react-dom/client";
import { MotionConfig } from "motion/react";
import App from "./App";
import "./styles/index.css";
import { SessionProvider } from "./contexts/SessionContext.jsx";
import { AuthProvider } from "./contexts/AuthContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <MotionConfig reducedMotion="user">
      <SessionProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </SessionProvider>
    </MotionConfig>
  </React.StrictMode>
);
