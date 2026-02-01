import { createContext, useContext, useState, useEffect } from "react";
import { initializeSession } from "../utils/sessionManager.js";

const SessionContext = createContext();

/**
 * SessionProvider component
 * Manages user sessions across the app
 */
export function SessionProvider({ children }) {
  const [deviceId, setDeviceId] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function setupSession() {
      const id = await initializeSession();
      setDeviceId(id);
      setLoading(false);
    }

    setupSession();
  }, []);

  return (
    <SessionContext.Provider value={{ deviceId, loading }}>
      {children}
    </SessionContext.Provider>
  );
}

/**
 * Hook to access session context
 */
export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
}
