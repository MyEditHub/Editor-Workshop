// SQLite caching for audio metadata
use rusqlite::{Connection, Result as SqliteResult};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use super::AudioMetadata;

/// Run one-time migration to clear stale cache data
fn run_cache_clear_migration(conn: &Connection) -> Result<(), String> {
    let migration_name = "clear_stale_cache_v2";

    // Check if migration already ran
    let already_ran: bool = conn
        .query_row(
            "SELECT COUNT(*) > 0 FROM migrations WHERE name = ?1",
            [migration_name],
            |row| row.get(0),
        )
        .unwrap_or(false);

    if already_ran {
        return Ok(());
    }

    // Clear all cached metadata to force fresh reads
    conn.execute("DELETE FROM audio_metadata", [])
        .map_err(|e| format!("Failed to clear cache in migration: {}", e))?;

    // Mark migration as complete
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    conn.execute(
        "INSERT INTO migrations (name, applied_at) VALUES (?1, ?2)",
        rusqlite::params![migration_name, now],
    )
    .map_err(|e| format!("Failed to record migration: {}", e))?;

    eprintln!("Cache cleared for improved metadata reading");
    Ok(())
}

/// Get the database path in the app data directory
fn get_db_path() -> PathBuf {
    // Use a standard location for the database
    let mut path = dirs_next::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."));
    path.push("com.editorworkshop.app");
    std::fs::create_dir_all(&path).ok();
    path.push("smelter_cache.db");
    path
}

// Global database connection (lazy initialized)
lazy_static::lazy_static! {
    static ref DB: Mutex<Option<Connection>> = Mutex::new(None);
}

/// Initialize the database and create tables
pub fn init_database() -> Result<(), String> {
    let db_path = get_db_path();
    let conn = Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS audio_metadata (
            id INTEGER PRIMARY KEY,
            file_path TEXT UNIQUE NOT NULL,
            file_modified INTEGER NOT NULL,
            file_size INTEGER NOT NULL DEFAULT 0,
            title TEXT,
            artist TEXT,
            genre TEXT,
            mood TEXT,
            energy TEXT,
            bpm INTEGER,
            duration_secs REAL,
            created_at INTEGER NOT NULL,
            updated_at INTEGER NOT NULL
        )",
        [],
    )
    .map_err(|e| format!("Failed to create table: {}", e))?;

    // Add file_size column if it doesn't exist (migration)
    let _ = conn.execute("ALTER TABLE audio_metadata ADD COLUMN file_size INTEGER NOT NULL DEFAULT 0", []);

    // Create migration tracking table
    conn.execute(
        "CREATE TABLE IF NOT EXISTS migrations (
            id INTEGER PRIMARY KEY,
            name TEXT UNIQUE NOT NULL,
            applied_at INTEGER NOT NULL
        )",
        [],
    )
    .map_err(|e| format!("Failed to create migrations table: {}", e))?;

    // Run cache clear migration (one-time to clear stale data from old schema)
    run_cache_clear_migration(&conn)?;

    conn.execute(
        "CREATE INDEX IF NOT EXISTS idx_file_path ON audio_metadata(file_path)",
        [],
    )
    .map_err(|e| format!("Failed to create index: {}", e))?;

    // Store connection for reuse
    let mut db = DB.lock().unwrap();
    *db = Some(conn);

    Ok(())
}

/// Get a database connection
fn get_connection() -> Result<Connection, String> {
    let db_path = get_db_path();
    Connection::open(&db_path)
        .map_err(|e| format!("Failed to open database: {}", e))
}

/// Get cached metadata for a file
pub fn get_cached_metadata(file_path: &str) -> Result<Option<AudioMetadata>, String> {
    let conn = get_connection()?;

    // Get file modification time and size
    let file_meta = std::fs::metadata(file_path).ok();
    let file_modified = file_meta
        .as_ref()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let file_size = file_meta.map(|m| m.len() as i64).unwrap_or(0);

    let result: SqliteResult<AudioMetadata> = conn.query_row(
        "SELECT file_path, title, artist, genre, mood, energy, bpm, duration_secs, file_modified, file_size
         FROM audio_metadata WHERE file_path = ?1",
        [file_path],
        |row| {
            let cached_modified: i64 = row.get(8)?;
            let cached_size: i64 = row.get::<_, Option<i64>>(9)?.unwrap_or(0);

            // Check if cache is still valid (both mtime and size must match)
            if cached_modified != file_modified || cached_size != file_size {
                return Err(rusqlite::Error::QueryReturnedNoRows);
            }

            let path: String = row.get(0)?;
            let filename = std::path::Path::new(&path)
                .file_name()
                .and_then(|n| n.to_str())
                .unwrap_or("Unknown")
                .to_string();

            Ok(AudioMetadata {
                path,
                filename,
                title: row.get(1)?,
                artist: row.get(2)?,
                genre: row.get(3)?,
                mood: row.get(4)?,
                energy: row.get(5)?,
                bpm: row.get::<_, Option<i32>>(6)?.map(|v| v as u32),
                duration_secs: row.get(7)?,
                category_override: None,
            })
        },
    );

    match result {
        Ok(metadata) => Ok(Some(metadata)),
        Err(rusqlite::Error::QueryReturnedNoRows) => Ok(None),
        Err(e) => Err(format!("Database error: {}", e)),
    }
}

/// Cache metadata for a file
pub fn cache_metadata(metadata: &AudioMetadata) -> Result<(), String> {
    let conn = get_connection()?;

    let file_meta = std::fs::metadata(&metadata.path).ok();
    let file_modified = file_meta
        .as_ref()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    let file_size = file_meta.map(|m| m.len() as i64).unwrap_or(0);

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    conn.execute(
        "INSERT OR REPLACE INTO audio_metadata
         (file_path, file_modified, file_size, title, artist, genre, mood, energy, bpm, duration_secs, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?11)",
        rusqlite::params![
            metadata.path,
            file_modified,
            file_size,
            metadata.title,
            metadata.artist,
            metadata.genre,
            metadata.mood,
            metadata.energy,
            metadata.bpm.map(|v| v as i32),
            metadata.duration_secs,
            now,
        ],
    )
    .map_err(|e| format!("Failed to cache metadata: {}", e))?;

    Ok(())
}

/// Clear all cached metadata
pub fn clear_cache() -> Result<u32, String> {
    let conn = get_connection()?;

    let count: i32 = conn
        .query_row("SELECT COUNT(*) FROM audio_metadata", [], |row| row.get(0))
        .unwrap_or(0);

    conn.execute("DELETE FROM audio_metadata", [])
        .map_err(|e| format!("Failed to clear cache: {}", e))?;

    Ok(count as u32)
}

/// Clear cached metadata for specific files
pub fn clear_cache_for_files(file_paths: &[String]) -> Result<u32, String> {
    if file_paths.is_empty() {
        return Ok(0);
    }

    let conn = get_connection()?;
    let mut count = 0u32;

    for path in file_paths {
        let result = conn.execute("DELETE FROM audio_metadata WHERE file_path = ?1", [path]);
        if let Ok(n) = result {
            count += n as u32;
        }
    }

    Ok(count)
}
