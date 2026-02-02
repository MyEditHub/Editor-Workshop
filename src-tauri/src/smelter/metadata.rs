// ID3 tag reading using lofty crate
use lofty::prelude::*;
use lofty::probe::Probe;
use lofty::tag::{ItemKey, TagType};
use std::path::Path;

use super::AudioMetadata;

/// Extract metadata from an audio file (MP3 or WAV)
/// This is the simple version using basic accessors.
/// For full ID3v2 frame access (mood, energy, BPM), use read_audio_metadata_full()
#[allow(dead_code)]
pub fn read_audio_metadata(path: &str) -> Result<AudioMetadata, String> {
    let path_obj = Path::new(path);

    let filename = path_obj
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();

    let tagged_file = Probe::open(path)
        .map_err(|e| format!("Failed to open file: {}", e))?
        .read()
        .map_err(|e| format!("Failed to read file: {}", e))?;

    let duration_secs = tagged_file.properties().duration().as_secs_f64();

    let tag = tagged_file.primary_tag().or_else(|| tagged_file.first_tag());

    let (title, artist, genre) = if let Some(tag) = tag {
        (
            tag.title().map(|s| s.to_string()),
            tag.artist().map(|s| s.to_string()),
            tag.genre().map(|s| s.to_string()),
        )
    } else {
        (None, None, None)
    };

    Ok(AudioMetadata {
        path: path.to_string(),
        filename,
        title,
        artist,
        genre,
        mood: None,   // Use read_audio_metadata_full for mood
        energy: None, // Use read_audio_metadata_full for energy
        bpm: None,    // Use read_audio_metadata_full for BPM
        duration_secs: Some(duration_secs),
        category_override: None,
    })
}

/// Read metadata with full ID3v2 frame access
pub fn read_audio_metadata_full(path: &str) -> Result<AudioMetadata, String> {
    let path_obj = Path::new(path);

    let filename = path_obj
        .file_name()
        .and_then(|n| n.to_str())
        .unwrap_or("Unknown")
        .to_string();

    let tagged_file = Probe::open(path)
        .map_err(|e| {
            let err_str = e.to_string();
            if err_str.contains("Permission denied") || err_str.contains("permission denied") {
                format!("Permission denied: Cannot read '{}'. Check file permissions.", filename)
            } else if err_str.contains("No such file") || err_str.contains("not found") {
                format!("File not found: '{}' may have been moved or deleted.", filename)
            } else {
                format!("Cannot open '{}': {}", filename, e)
            }
        })?
        .read()
        .map_err(|e| format!("Cannot read audio data from '{}': {}", filename, e))?;

    let duration_secs = tagged_file.properties().duration().as_secs_f64();

    // Default values
    let mut title: Option<String> = None;
    let mut artist: Option<String> = None;
    let mut genre: Option<String> = None;
    let mut mood: Option<String> = None;
    let mut energy: Option<String> = None;
    let mut bpm: Option<u32> = None;

    // Try ID3v2 tag first for full frame access
    if let Some(id3v2) = tagged_file.tag(TagType::Id3v2) {
        title = id3v2.title().map(|s| s.to_string());
        artist = id3v2.artist().map(|s| s.to_string());
        genre = id3v2.genre().map(|s| s.to_string());

        // Try multiple sources for mood (in order of priority)
        // 1. TIT1 - Content group (mood tags in Epidemic Sound)
        if let Some(item) = id3v2.get(&ItemKey::ContentGroup) {
            mood = item.value().text().map(|s| s.to_string());
        }
        // 2. TMOO - Standard ID3v2.4 mood frame
        if mood.is_none() {
            if let Some(item) = id3v2.get(&ItemKey::Mood) {
                mood = item.value().text().map(|s| s.to_string());
            }
        }
        // 3. Comment field (some files store mood here)
        if mood.is_none() {
            if let Some(item) = id3v2.get(&ItemKey::Comment) {
                let comment = item.value().text().map(|s| s.to_string());
                // Only use comment if it looks like a mood tag (short, no sentences)
                if let Some(ref c) = comment {
                    if c.len() < 50 && !c.contains('.') {
                        mood = comment;
                    }
                }
            }
        }

        // 4. TXXX custom frames - check for mood-related descriptions
        if mood.is_none() {
            for item in id3v2.items() {
                if let Some(desc) = item.key().map_key(TagType::Id3v2, true) {
                    let desc_lower = desc.to_lowercase();
                    if desc_lower.contains("mood") || desc_lower.contains("style") || desc_lower.contains("vibe") {
                        if let Some(text) = item.value().text() {
                            mood = Some(text.to_string());
                            break;
                        }
                    }
                }
            }
        }

        // 5. InitialKey - sometimes used for categorization
        if mood.is_none() {
            if let Some(item) = id3v2.get(&ItemKey::InitialKey) {
                // Only use if it looks like a mood (not a musical key like "C#m")
                if let Some(text) = item.value().text() {
                    if !text.contains('#') && !text.contains('m') && text.len() > 3 {
                        mood = Some(text.to_string());
                    }
                }
            }
        }

        // TIT3 - Subtitle (energy level in Epidemic Sound)
        if let Some(item) = id3v2.get(&ItemKey::TrackSubtitle) {
            energy = item.value().text().map(|s| s.to_string());
        }

        // TBPM - Tempo
        if let Some(item) = id3v2.get(&ItemKey::Bpm) {
            if let Some(text) = item.value().text() {
                bpm = text.parse::<u32>().ok();
            }
        }
    } else if let Some(tag) = tagged_file.primary_tag() {
        // Fallback to primary tag
        title = tag.title().map(|s| s.to_string());
        artist = tag.artist().map(|s| s.to_string());
        genre = tag.genre().map(|s| s.to_string());
    }

    Ok(AudioMetadata {
        path: path.to_string(),
        filename,
        title,
        artist,
        genre,
        mood,
        energy,
        bpm,
        duration_secs: Some(duration_secs),
        category_override: None,
    })
}

/// Scan a directory for audio files and extract metadata
pub fn scan_directory(dir_path: &str) -> Result<Vec<AudioMetadata>, String> {
    use walkdir::WalkDir;

    let mut results = Vec::new();

    for entry in WalkDir::new(dir_path)
        .follow_links(true)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();

        // Check if it's an audio file
        if let Some(ext) = path.extension() {
            let ext_lower = ext.to_string_lossy().to_lowercase();
            if ext_lower == "mp3" || ext_lower == "wav" {
                if let Some(path_str) = path.to_str() {
                    match read_audio_metadata_full(path_str) {
                        Ok(metadata) => results.push(metadata),
                        Err(e) => {
                            eprintln!("Error reading {}: {}", path_str, e);
                        }
                    }
                }
            }
        }
    }

    Ok(results)
}
