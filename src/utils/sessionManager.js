import { openDB } from "idb";
import { v4 as uuidv4 } from "uuid";

const DB_NAME = "librescan-app";
const STORE_NAME = "session";
const DB_VERSION = 1;

function initDB() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) db.createObjectStore(STORE_NAME);
    },
  });
}

/**
 * Return this device's anonymous id from IndexedDB, creating one on first
 * visit. Returns null if IndexedDB is unavailable.
 */
export async function initializeSession() {
  try {
    const db = await initDB();
    let deviceId = await db.get(STORE_NAME, "device_id");
    if (!deviceId) {
      deviceId = uuidv4();
      await db.put(STORE_NAME, deviceId, "device_id");
    }
    db.close();
    return deviceId;
  } catch (error) {
    console.error("Error initializing session:", error);
    return null;
  }
}
