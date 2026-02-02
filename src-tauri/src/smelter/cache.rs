// SQLite caching for audio metadata
use rusqlite::{Connection, Result as SqliteResult};
use std::path::PathBuf;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use super::AudioMetadata;

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

    // Get file modification time
    let file_modified = std::fs::metadata(file_path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    let result: SqliteResult<AudioMetadata> = conn.query_row(
        "SELECT file_path, title, artist, genre, mood, energy, bpm, duration_secs, file_modified
         FROM audio_metadata WHERE file_path = ?1",
        [file_path],
        |row| {
            let cached_modified: i64 = row.get(8)?;

            // Check if cache is still valid
            if cached_modified != file_modified {
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

    let file_modified = std::fs::metadata(&metadata.path)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    let now = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    conn.execute(
        "INSERT OR REPLACE INTO audio_metadata
         (file_path, file_modified, title, artist, genre, mood, energy, bpm, duration_secs, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)",
        rusqlite::params![
            metadata.path,
            file_modified,
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
