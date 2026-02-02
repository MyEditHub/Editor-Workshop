use lazy_static::lazy_static;
use rusqlite::{params, Connection};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;

lazy_static! {
    static ref QUEUE_DB: Mutex<Option<Connection>> = Mutex::new(None);
}

/// Initialize the telemetry database
pub fn init_database() -> Result<(), String> {
    let mut db = QUEUE_DB.lock().map_err(|e| e.to_string())?;
    if db.is_some() {
        return Ok(());
    }

    let db_path = dirs_next::data_dir()
        .ok_or("Could not find data directory")?
        .join("com.editorworkshop.app")
        .join("telemetry.db");

    // Ensure parent directory exists
    if let Some(parent) = db_path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    let conn = Connection::open(&db_path).map_err(|e| e.to_string())?;

    conn.execute(
        "CREATE TABLE IF NOT EXISTS event_queue (
            id INTEGER PRIMARY KEY,
            event_type TEXT NOT NULL,
            payload TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            sent INTEGER DEFAULT 0
        )",
        [],
    )
    .map_err(|e| e.to_string())?;

    *db = Some(conn);
    Ok(())
}

#[derive(Serialize, Deserialize, Clone)]
pub struct QueuedEvent {
    pub event_type: String,
    pub payload: serde_json::Value,
}

/// Queue an event for later sending
pub fn queue_event(event: &QueuedEvent) -> Result<(), String> {
    init_database()?;

    let db = QUEUE_DB.lock().map_err(|e| e.to_string())?;
    let conn = db.as_ref().ok_or("Database not initialized")?;

    conn.execute(
        "INSERT INTO event_queue (event_type, payload, created_at) VALUES (?1, ?2, ?3)",
        params![
            event.event_type,
            serde_json::to_string(&event.payload).map_err(|e| e.to_string())?,
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map_err(|e| e.to_string())?
                .as_secs() as i64
        ],
    )
    .map_err(|e| e.to_string())?;

    Ok(())
}

/// Get pending events that haven't been sent
pub fn get_pending_events() -> Result<Vec<(i64, QueuedEvent)>, String> {
    init_database()?;

    let db = QUEUE_DB.lock().map_err(|e| e.to_string())?;
    let conn = db.as_ref().ok_or("Database not initialized")?;

    let mut stmt = conn
        .prepare(
            "SELECT id, event_type, payload FROM event_queue WHERE sent = 0 ORDER BY created_at LIMIT 100",
        )
        .map_err(|e| e.to_string())?;

    let events = stmt
        .query_map([], |row| {
            let id: i64 = row.get(0)?;
            let event_type: String = row.get(1)?;
            let payload_str: String = row.get(2)?;
            let payload: serde_json::Value =
                serde_json::from_str(&payload_str).unwrap_or(serde_json::Value::Null);

            Ok((
                id,
                QueuedEvent {
                    event_type,
                    payload,
                },
            ))
        })
        .map_err(|e| e.to_string())?
        .filter_map(|r| r.ok())
        .collect();

    Ok(events)
}

/// Mark events as sent
pub fn mark_sent(ids: &[i64]) -> Result<(), String> {
    if ids.is_empty() {
        return Ok(());
    }

    init_database()?;

    let db = QUEUE_DB.lock().map_err(|e| e.to_string())?;
    let conn = db.as_ref().ok_or("Database not initialized")?;

    for id in ids {
        conn.execute("UPDATE event_queue SET sent = 1 WHERE id = ?1", params![id])
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}

/// Clean up old sent events (older than 7 days)
/// Note: Called periodically to prevent database bloat
#[allow(dead_code)]
pub fn cleanup_old_events() -> Result<u32, String> {
    init_database()?;

    let db = QUEUE_DB.lock().map_err(|e| e.to_string())?;
    let conn = db.as_ref().ok_or("Database not initialized")?;

    let cutoff = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map_err(|e| e.to_string())?
        .as_secs() as i64
        - (7 * 24 * 60 * 60); // 7 days ago

    let deleted = conn
        .execute(
            "DELETE FROM event_queue WHERE sent = 1 AND created_at < ?1",
            params![cutoff],
        )
        .map_err(|e| e.to_string())?;

    Ok(deleted as u32)
}
