import pg from "pg";
import * as dotenv from "dotenv";

dotenv.config({ path: "./.env.local" });

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkSessions() {
  try {
    const result = await pool.query(
      "SELECT * FROM sessions ORDER BY created_at DESC",
    );

    console.log(`Total sessions: ${result.rows.length}\n`);

    result.rows.forEach((session, index) => {
      console.log(`Session ${index + 1}:`);
      console.log(`  Device ID: ${session.device_id}`);
      console.log(`  Created At: ${session.created_at}`);
      console.log(`  Last Active: ${session.last_active}\n`);
      console.log("-----------------------------------\n");
    });

    await pool.end();
  } catch (error) {
    console.error("Error fetching sessions:", error);
  }
}

checkSessions()