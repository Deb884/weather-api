// db/database.js
// SQLite using sql.js (pure JavaScript / WebAssembly — no native build tools needed,
// unlike better-sqlite3 which requires Visual Studio Build Tools on Windows).
// The database is stored as a single file at data/weather.db and re-saved on every write.
import initSqlJs from "sql.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Setup for ES Modules (__dirname equivalent)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SQL = await initSqlJs({
  locateFile: (file) => path.join(__dirname, "../node_modules/sql.js/dist", file),
});

// Allow overriding via .env, default to data/weather.db
const dbPath = process.env.DB_PATH || path.join(__dirname, "../data/weather.db");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

// Load existing DB file if present, otherwise create a new one
const db = fs.existsSync(dbPath)
  ? new SQL.Database(fs.readFileSync(dbPath))
  : new SQL.Database();

// Create tables if they don't exist (runs on every start, safe)
db.run(`
  CREATE TABLE IF NOT EXISTS favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    city TEXT NOT NULL,
    country TEXT DEFAULT '',
    admin1 TEXT DEFAULT '',
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(city, latitude, longitude)
  );
`);

// Migration for existing databases: add updated_at if it's missing (safe to run every start)
try {
  db.run("ALTER TABLE favorites ADD COLUMN updated_at DATETIME DEFAULT NULL");
} catch {
  /* column already exists — ignore */
}

// Persist the in-memory database back to the .db file
export function saveDb() {
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}
saveDb();

export default db;
