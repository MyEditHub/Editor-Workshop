// The Smelter - Music file organization module
pub mod cache;
pub mod metadata;
pub mod organize;

use serde::{Deserialize, Serialize};

/// Audio file metadata extracted from ID3 tags
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioMetadata {
    pub path: String,
    pub filename: String,
    pub title: Option<String>,
    pub artist: Option<String>,
    pub genre: Option<String>,
    pub mood: Option<String>,
    pub energy: Option<String>,
    pub bpm: Option<u32>,
    pub duration_secs: Option<f64>,
    /// Optional per-file category override (frontend sets this when user selects a specific field)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub category_override: Option<String>,
}

/// Result of organizing files
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OrganizeResult {
    pub success_count: u32,
    pub error_count: u32,
    pub skipped_count: u32,
    pub errors: Vec<String>,
}

/// Information about a duplicate file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DuplicateInfo {
    pub source_path: String,
    pub source_filename: String,
    pub existing_path: String,
    pub category: String,
}
