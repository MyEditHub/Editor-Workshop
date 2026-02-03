// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod smelter;
mod telemetry;

use smelter::{AudioMetadata, DuplicateInfo, OrganizeResult, SourceDuplicateGroup};
use std::collections::HashMap;

// ============ The Smelter Commands ============

/// Scan audio files for metadata (ID3 tags)
#[tauri::command]
async fn scan_audio_files(paths: Vec<String>) -> Result<Vec<AudioMetadata>, String> {
    // Initialize database on first scan
    smelter::cache::init_database()?;

    let mut results = Vec::new();

    for path in paths {
        // Check cache first
        if let Ok(Some(cached)) = smelter::cache::get_cached_metadata(&path) {
            results.push(cached);
            continue;
        }

        // Read metadata from file
        match smelter::metadata::read_audio_metadata_full(&path) {
            Ok(metadata) => {
                // Cache the result
                let _ = smelter::cache::cache_metadata(&metadata);
                results.push(metadata);
            }
            Err(e) => {
                eprintln!("Error scanning {}: {}", path, e);
                // Return partial result with error info
                results.push(AudioMetadata {
                    path: path.clone(),
                    filename: std::path::Path::new(&path)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("Unknown")
                        .to_string(),
                    title: None,
                    artist: None,
                    genre: None,
                    mood: None,
                    energy: None,
                    bpm: None,
                    duration_secs: None,
                    category_override: None,
                });
            }
        }
    }

    Ok(results)
}

/// Scan a directory recursively for audio files
#[tauri::command]
async fn scan_directory(path: String) -> Result<Vec<AudioMetadata>, String> {
    smelter::cache::init_database()?;
    smelter::metadata::scan_directory(&path)
}

/// Preview organization without moving files
#[tauri::command]
async fn preview_organization(
    files: Vec<AudioMetadata>,
    organize_by: String,
) -> Result<HashMap<String, Vec<String>>, String> {
    Ok(smelter::organize::preview_organization(&files, &organize_by))
}

/// Organize files into folders
#[tauri::command]
async fn organize_files(
    files: Vec<AudioMetadata>,
    output_folder: String,
    organize_by: String,
    operation: String,
) -> Result<OrganizeResult, String> {
    smelter::organize::organize_files(&files, &output_folder, &organize_by, &operation)
}

/// Clear the metadata cache
#[tauri::command]
async fn clear_metadata_cache() -> Result<u32, String> {
    smelter::cache::clear_cache()
}

/// Find duplicate files that already exist in target folders
#[tauri::command]
async fn find_duplicates(
    files: Vec<AudioMetadata>,
    output_folder: String,
    organize_by: String,
) -> Result<Vec<DuplicateInfo>, String> {
    Ok(smelter::organize::find_duplicates(&files, &output_folder, &organize_by))
}

/// Delete duplicate files
#[tauri::command]
async fn delete_duplicates(paths: Vec<String>) -> Result<(u32, Vec<String>), String> {
    smelter::organize::delete_duplicates(&paths)
}

/// Find source files with same filename going to same category (before organizing)
#[tauri::command]
async fn find_source_duplicates(
    files: Vec<AudioMetadata>,
    organize_by: String,
) -> Vec<SourceDuplicateGroup> {
    smelter::organize::find_source_duplicates(&files, &organize_by)
}

/// Rescan files - clears cache for specified files and re-reads metadata
#[tauri::command]
async fn rescan_files(paths: Vec<String>) -> Result<Vec<AudioMetadata>, String> {
    // Clear cache for these files
    smelter::cache::clear_cache_for_files(&paths)?;

    // Re-read metadata from disk
    let mut results = Vec::new();
    for path in paths {
        match smelter::metadata::read_audio_metadata_full(&path) {
            Ok(metadata) => {
                // Cache the fresh result
                let _ = smelter::cache::cache_metadata(&metadata);
                results.push(metadata);
            }
            Err(e) => {
                eprintln!("Error rescanning {}: {}", path, e);
                // Return partial result with error info
                results.push(AudioMetadata {
                    path: path.clone(),
                    filename: std::path::Path::new(&path)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or("Unknown")
                        .to_string(),
                    title: None,
                    artist: None,
                    genre: None,
                    mood: None,
                    energy: None,
                    bpm: None,
                    duration_secs: None,
                    category_override: None,
                });
            }
        }
    }

    Ok(results)
}

// ============ Telemetry Commands ============

/// Queue a telemetry event for later sending
#[tauri::command]
async fn queue_telemetry_event(
    event_type: String,
    payload: serde_json::Value,
) -> Result<(), String> {
    telemetry::queue_event(&telemetry::QueuedEvent { event_type, payload })
}

/// Get pending telemetry events
#[tauri::command]
async fn get_pending_telemetry() -> Result<Vec<(i64, telemetry::QueuedEvent)>, String> {
    telemetry::get_pending_events()
}

/// Mark telemetry events as sent
#[tauri::command]
async fn mark_telemetry_sent(ids: Vec<i64>) -> Result<(), String> {
    telemetry::mark_sent(&ids)
}

fn main() {
    // Initialize database (migrations handle one-time cache clears)
    let _ = smelter::cache::init_database();

    // Initialize Sentry for crash reporting (only in release builds with DSN set)
    let _sentry_guard = std::env::var("SENTRY_DSN").ok().map(|dsn| {
        sentry::init((
            dsn,
            sentry::ClientOptions {
                release: sentry::release_name!(),
                environment: Some(
                    if cfg!(debug_assertions) {
                        "development"
                    } else {
                        "production"
                    }
                    .into(),
                ),
                ..Default::default()
            },
        ))
    });

    // Set up panic hook to report panics to Sentry
    let default_panic = std::panic::take_hook();
    std::panic::set_hook(Box::new(move |info| {
        // Report to Sentry
        sentry::capture_event(sentry::protocol::Event {
            message: Some(info.to_string()),
            level: sentry::Level::Fatal,
            ..Default::default()
        });
        // Call the default handler
        default_panic(info);
    }));

    tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            scan_audio_files,
            scan_directory,
            preview_organization,
            organize_files,
            clear_metadata_cache,
            find_duplicates,
            delete_duplicates,
            find_source_duplicates,
            rescan_files,
            queue_telemetry_event,
            get_pending_telemetry,
            mark_telemetry_sent,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}