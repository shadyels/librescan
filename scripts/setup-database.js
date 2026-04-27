import pg from "pg";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config({ path: ".env.local" });

const { Pool } = pg;

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function setupDatabase() {
  try {
    console.log("Connecting to the database...");

    const client = await pool.connect();
    console.log("Connected to the database successfully!");

    try {
    // Drop tables in reverse FK dependency order
    console.log("Dropping existing tables...");
    await client.query("DROP TABLE IF EXISTS api_usage_tracking CASCADE");
    await client.query("DROP TABLE IF EXISTS book_cache CASCADE");
    await client.query("DROP TABLE IF EXISTS recommendations CASCADE");
    await client.query("DROP TABLE IF EXISTS preferences CASCADE");
    await client.query("DROP TABLE IF EXISTS scans CASCADE");
    await client.query("DROP TABLE IF EXISTS user_sessions CASCADE");
    await client.query("DROP TABLE IF EXISTS anon_sessions CASCADE");
    await client.query("DROP TABLE IF EXISTS users CASCADE");
    console.log("All tables dropped.\n");

    // Enable citext extension
    console.log("Creating extensions...");
    await client.query("CREATE EXTENSION IF NOT EXISTS citext;");

    // Create tables in dependency order (parents before children)
    console.log("Creating database tables...");
    await client.query(`
      CREATE TABLE users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email CITEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE user_sessions (
        token_hash CHAR(64) PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        expires_at TIMESTAMP NOT NULL
      );
    `);

    await client.query(`
      CREATE TABLE anon_sessions (
        device_id UUID PRIMARY KEY,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE scans (
        scan_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        device_id UUID REFERENCES anon_sessions(device_id) ON DELETE CASCADE,
        scan_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        recognized_books JSONB,
        CHECK (
          (user_id IS NOT NULL AND device_id IS NULL) OR
          (user_id IS NULL AND device_id IS NOT NULL)
        )
      );
    `);

    await client.query(`
      CREATE TABLE preferences (
        user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        genres TEXT[] DEFAULT '{}',
        authors TEXT[] DEFAULT '{}',
        language VARCHAR(50),
        reading_level VARCHAR(50)
      );
    `);

    await client.query(`
      CREATE TABLE recommendations (
        recommendation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        scan_id UUID NOT NULL REFERENCES scans(scan_id) ON DELETE CASCADE,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        book_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        saved BOOLEAN DEFAULT FALSE
      );
    `);

    await client.query(`
      CREATE TABLE book_cache (
        cache_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        title TEXT NOT NULL,
        author TEXT,
        title_lower TEXT NOT NULL,
        author_lower TEXT,
        isbn VARCHAR(20),
        cover_url TEXT,
        description TEXT,
        categories TEXT[],
        cached_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await client.query(`
      CREATE TABLE api_usage_tracking (
        date DATE PRIMARY KEY,
        groq_vision_requests INT DEFAULT 0,
        groq_text_requests INT DEFAULT 0,
        google_books_requests INT DEFAULT 0,
        total_cost NUMERIC(10,4) DEFAULT 0,
        daily_limit_hit BOOLEAN DEFAULT FALSE
      );
    `);

    console.log("Tables created successfully!");

    // Create indexes
    console.log("Creating indexes...");
    await client.query("CREATE INDEX IF NOT EXISTS idx_anon_sessions_last_active ON anon_sessions(last_active);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id ON user_sessions(user_id);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at ON user_sessions(expires_at);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_scans_user_id ON scans(user_id);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_scans_device_id ON scans(device_id);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_scans_scan_date ON scans(scan_date);");
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_recommendations_scan_id_unique ON recommendations(scan_id);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_recommendations_saved_created_at ON recommendations(saved, created_at);");
    await client.query("CREATE UNIQUE INDEX IF NOT EXISTS idx_book_cache_lookup ON book_cache(title_lower, author_lower);");
    await client.query("CREATE INDEX IF NOT EXISTS idx_book_cache_isbn ON book_cache(isbn);");
    console.log("Indexes created successfully!");

    // Verify tables exist
    const result = await client.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);

    console.log("\nCreated tables:");
    result.rows.forEach((row) => {
      console.log(`- ${row.table_name}`);
    });

    } finally {
      client.release();
    }
    await pool.end();
    console.log("\nDatabase setup completed");
  } catch (err) {
    console.error("Database setup error: ", err);
    process.exit(1);
  }
}

// Run setup
setupDatabase();
