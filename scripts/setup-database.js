import pg from "pg";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const { Pool } = pg;

//create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

// SQL schema
const schema = `
--Session table (device based sessions)
CREATE TABLE IF NOT EXISTS sessions (
  device_id UUID PRIMARY KEY,
  created_at TIMESTAMP default CURRENT_TIMESTAMP,
  last_active TIMESTAMP default CURRENT_TIMESTAMP
);

--Scans table (image upload records)
CREATE TABLE IF NOT EXISTS scans (
  scan_id UUID UNIQUE NOT NULL,
  device_id UUID references sessions(device_id) ON DELETE CASCADE, --fk to sessions, if session deleted, delete all scans
  image_url TEXT NOT NULL,
  scan_date TIMESTAMP default CURRENT_TIMESTAMP,
  recognized_books JSONB --array of recognized books with details
);

--Preferences table (user reading preferences)
CREATE TABLE IF NOT EXISTS preferences (
  device_id UUID PRIMARY KEY references sessions(device_id) ON DELETE CASCADE, --pk and fk to sessions, preferences strored per device
  genres TEXT[] DEFAULT '{}',
  authors TEXT[] DEFAULT '{}',
  language VARCHAR(50),
  reading_level VARCHAR(50)
);

--Recommendations table (saved AI generated book recommendations)
CREATE TABLE IF NOT EXISTS recommendations (
  recommendation_id UUID PRIMARY KEY,
  device_id UUID references sessions(device_id) ON DELETE CASCADE, --fk to sessions
  scan_id UUID references scans(scan_id) ON DELETE CASCADE, --fk to scans
  book_data JSONB,
  create_at TIMESTAMP default CURRENT_TIMESTAMP,
  saved BOOLEAN default FALSE
);

--Book cache table (caching book details to minimize API calls)
CREATE TABLE IF NOT EXISTS book_cache (
  isbn VARCHAR(20) PRIMARY KEY,
  title TEXT NOT NULL,
  authors TEXT,
  cover_url TEXT,
  description TEXT,
  amazon_link TEXT,
  cached_at TIMESTAMP default CURRENT_TIMESTAMP,
  last_updated TIMESTAMP default CURRENT_TIMESTAMP
);

-- Usage tracking table (track API usage per device)
CREATE TABLE IF NOT EXISTS api_usage_tracking (
    date DATE PRIMARY KEY,    
    total_requests INT default 0,
    total_cost NUMERIC(10,4) default 0,
    daily_limit_hit BOOLEAN default FALSE
);

--Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_scans_device_id ON scans(device_id);
CREATE INDEX IF NOT EXISTS idx_scans_scan_date ON scans(scan_date);
CREATE INDEX IF NOT EXISTS idx_recommendations_device_id ON recommendations(device_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_saved ON recommendations(saved);
CREATE INDEX IF NOT EXISTS idx_book_cache_last_updated ON book_cache(last_updated);
CREATE INDEX IF NOT EXISTS idx_api_usage_tracking_date ON api_usage_tracking(date);
`;

async function setupDatabase() {
  try {
    console.log("Connecting to the database...");

    //test connection
    const client = await pool.connect();
    console.log("Connected to the database successfully!");
    
    //run schema
    console.log("Creating database tables...");
    console.log("Executing SQL at position 1618:", schema.substring(1550, 1650)); //DEBUGGING
    await client.query(schema);
    console.log("Tables created successfully!");

    //verify tables exist
    const result = await client.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema='public'
        `);

    console.log("\nCreated tables:");
    result.rows.forEach((row) => {
      console.log(`- ${row.table_name}`);
    });

    client.release();
    await pool.end();
    console.log("\nDatabase setup completed");
  } catch (err) {
    console.error("Database setup error: ", err);
    process.exit(1);
  }
}

//run setup
setupDatabase();
