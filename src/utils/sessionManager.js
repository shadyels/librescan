import { openDB } from "idb";
import { v4 as uuidv4 } from "uuid";

const DB_NAME = "librescan-app";
const STORE_NAME = "session";
const DB_VERSION = 1;

/**
 * Initialize IndexedDB
 * Creates database and object store if they don't exist
 */
async function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        // Create store WITHOUT keyPath - we'll use explicit keys
        db.createObjectStore(STORE_NAME)
      }
    },
  })
}

/**
 * Get deviced ID from IndexedDB
 * Returns existing device_id or null if not found
 */
export async function getDeviceId() {
  try {
    const db = await initDB();
    const deviceId = await db.get(STORE_NAME, "device_id");
    await db.close();
    return deviceId || null;
  } catch (error) {
    console.error("Error getting device ID:", error);
    return null;
  }
}

/**
 * Create a device_id and store in IndexedDB
 * Generates a new UUID v4 and saves to database
 */
export async function createDeviceId() {
  try {
    const deviceId = uuidv4();
    const db = await initDB();
    await db.put(STORE_NAME, deviceId,"device_id");
    await db.close();
    return deviceId;
  } catch (error) {
    console.error("Error creating device ID:", error);
    return null;
  }
}

/**
 * Initialize session
 * Gets existing device_id or creates a new one
 * Registers session with backend
 */
export async function initializeSession() {
  try {
    let deviceId = await getDeviceId();

    if (!deviceId) {
      deviceId = await createDeviceId();
      console.log("New device ID created: ", deviceId);
    } else {
      console.log("Existing device ID found: ", deviceId);
    }

    // Register session with backend
    const response = await fetch("/api/sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ device_id: deviceId }),
    });

    if (!response.ok) {
      console.error("Failed to register session with backend");
    }

    return deviceId;
  } catch (error) {
    console.error("Error initializing session:", error);
    return null;
  }
}

/**
 * Clear session (testing or logout)
 * Removes device_id from IndexedDB
 */
export async function clearSession() {
  try {
    const db = await initDB();
    await db.delete(STORE_NAME, "device_id");
    await db.close();
    console.log("Session cleared successfully");
    return true;
  } catch (error) {
    console.error("Error clearing session:", error);
    return false;
  }
}
