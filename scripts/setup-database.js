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

console.log('Dropping existing tables...')
  await pool.query('DROP TABLE IF EXISTS usage_tracking CASCADE')
  await pool.query('DROP TABLE IF EXISTS book_cache CASCADE')
  await pool.query('DROP TABLE IF EXISTS recommendations CASCADE')
  await pool.query('DROP TABLE IF EXISTS preferences CASCADE')
  await pool.query('DROP TABLE IF EXISTS scans CASCADE')
  await pool.query('DROP TABLE IF EXISTS sessions CASCADE')
  console.log('All tables dropped.\n');

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
  scan_date TIMESTAMP default CURRENT_TIMESTAMP,
  recognized_books JSONB --array of recognized books with details (now includes enriched Google Books metadata)
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
  cache_id UUID PRIMARY KEY,
  title TEXT NOT NULL,                --original casing from AI (for display)
  author TEXT,                        --original casing from AI (for display)
  title_lower TEXT NOT NULL,          --lowercase for case-insensitive cache lookups
  author_lower TEXT,                  --lowercase for case-insensitive cache lookups
  isbn VARCHAR(20),                   --from Google Books response (nullable, not always available)
  cover_url TEXT,                     --book cover image URL from Google Books
  description TEXT,                   --book synopsis from Google Books
  categories TEXT[],                  --genre/category array from Google Books (e.g. {'Fiction', 'Classics'})
  cached_at TIMESTAMP default CURRENT_TIMESTAMP
);

-- Usage tracking table (track API usage per device)
CREATE TABLE IF NOT EXISTS api_usage_tracking (
    date DATE PRIMARY KEY,    
    total_requests INT default 0,
    total_cost NUMERIC(10,4) default 0,
    daily_limit_hit BOOLEAN default FALSE
);

--Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_sessions_last_active ON sessions(last_active);
CREATE INDEX IF NOT EXISTS idx_scans_device_id ON scans(device_id);
CREATE INDEX IF NOT EXISTS idx_scans_scan_date ON scans(scan_date);
CREATE INDEX IF NOT EXISTS idx_recommendations_device_id ON recommendations(device_id);
CREATE INDEX IF NOT EXISTS idx_recommendations_saved ON recommendations(saved);
CREATE INDEX IF NOT EXISTS idx_api_usage_tracking_date ON api_usage_tracking(date);

--Book cache indexes
--Unique composite index: enables fast cache lookups by title+author and prevents duplicate entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_book_cache_lookup ON book_cache(title_lower, author_lower);
--ISBN index: for future lookups by ISBN (e.g. barcode scanner feature)
CREATE INDEX IF NOT EXISTS idx_book_cache_isbn ON book_cache(isbn);
`;

async function setupDatabase() {
  try {
    console.log("Connecting to the database...");

    //test connection
    const client = await pool.connect();
    console.log("Connected to the database successfully!");
    
    //run schema
    console.log("Creating database tables...");
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
