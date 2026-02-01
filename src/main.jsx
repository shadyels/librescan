import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/index.css";
import { SessionProvider } from "./contexts/SessionContext.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SessionProvider> {/*wrapping the app with SessionProvider to provide session context (all components can access deviceId)*/}
      <App />
    </SessionProvider>
  </React.StrictMode>
);