import { createContext, useContext, useState, useEffect } from "react";
import { initializeSession } from "../utils/sessionManager.js";

const SessionContext = createContext();

/** Provides this device's anonymous id (null until IndexedDB answers). */
export function SessionProvider({ children }) {
  const [deviceId, setDeviceId] = useState(null);

  useEffect(() => {
    initializeSession().then(setDeviceId);
  }, []);

  return <SessionContext.Provider value={{ deviceId }}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession must be used within a SessionProvider");
  return context;
}
