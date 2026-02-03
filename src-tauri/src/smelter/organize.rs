// File organization logic
use std::collections::HashMap;
use std::fs;
use std::io::ErrorKind;
use std::path::Path;

use super::{AudioMetadata, DuplicateInfo, OrganizeResult, SourceDuplicateFile, SourceDuplicateGroup};

/// Format a filesystem error with user-friendly messages
fn format_fs_error(e: &std::io::Error, path: &str, operation: &str) -> String {
    match e.kind() {
        ErrorKind::PermissionDenied => {
            format!(
                "Permission denied: Cannot {} '{}'. Try choosing a different folder or check folder permissions.",
                operation, path
            )
        }
        ErrorKind::NotFound => {
            format!("File not found: '{}' may have been moved or deleted.", path)
        }
        ErrorKind::AlreadyExists => {
            format!("File already exists at destination: '{}'", path)
        }
        ErrorKind::StorageFull | ErrorKind::QuotaExceeded => {
            format!("Not enough disk space to {} '{}'.", operation, path)
        }
        _ => format!("Failed to {} '{}': {}", operation, path, e),
    }
}

/// Organize files into folders based on a category
pub fn organize_files(
    files: &[AudioMetadata],
    output_folder: &str,
    organize_by: &str,
    operation: &str, // "move" or "copy"
) -> Result<OrganizeResult, String> {
    let output_path = Path::new(output_folder);

    // Create output folder if it doesn't exist
    fs::create_dir_all(output_path).map_err(|e| {
        format_fs_error(&e, output_folder, "create output folder")
    })?;

    let mut success_count = 0u32;
    let mut error_count = 0u32;
    let skipped_count = 0u32;
    let mut errors = Vec::new();

    // Track filenames per category to handle duplicates
    let mut used_names: HashMap<String, HashMap<String, u32>> = HashMap::new();

    for file in files {
        // Get the category (handles SFX detection automatically)
        let category = get_file_category(file, organize_by);

        // Sanitize category name for filesystem
        let safe_category = sanitize_folder_name(&category);

        // Create category folder
        let category_path = output_path.join(&safe_category);
        if let Err(e) = fs::create_dir_all(&category_path) {
            errors.push(format_fs_error(&e, &safe_category, "create folder"));
            error_count += 1;
            continue;
        }

        // Generate unique filename
        let filename = generate_unique_filename(
            &category_path,
            &file.filename,
            &mut used_names,
            &safe_category,
        );

        let dest_path = category_path.join(&filename);

        // Perform the operation
        let result = match operation {
            "move" => fs::rename(&file.path, &dest_path)
                .or_else(|_| {
                    // rename fails across filesystems, try copy+delete
                    fs::copy(&file.path, &dest_path)?;
                    fs::remove_file(&file.path)
                }),
            "copy" => fs::copy(&file.path, &dest_path).map(|_| ()),
            _ => {
                errors.push(format!("Unknown operation: {}", operation));
                error_count += 1;
                continue;
            }
        };

        match result {
            Ok(_) => success_count += 1,
            Err(e) => {
                errors.push(format_fs_error(&e, &file.filename, operation));
                error_count += 1;
            }
        }
    }

    Ok(OrganizeResult {
        success_count,
        error_count,
        skipped_count,
        errors,
    })
}

/// Check if a file is SFX (not an Epidemic Sound file)
/// Epidemic Sound files start with "ES_" prefix (case-sensitive)
fn is_sfx_file(filename: &str) -> bool {
    !filename.starts_with("ES_")
}

/// Determine the category for a file, considering SFX detection
fn get_file_category(file: &AudioMetadata, organize_by: &str) -> String {
    // SFX files (without ES_ prefix) always go to SFX folder
    if is_sfx_file(&file.filename) {
        return "SFX".to_string();
    }

    // For ES_ files, use normal category resolution
    let category = if let Some(ref override_cat) = file.category_override {
        Some(override_cat.clone())
    } else {
        match organize_by {
            "genre" => file.genre.clone(),
            "mood" => file.mood.as_ref().map(|m| {
                m.split(',')
                    .next()
                    .unwrap_or("Unknown")
                    .trim()
                    .to_string()
            }),
            _ => None,
        }
    };

    category.unwrap_or_else(|| "Unknown".to_string())
}

/// Sanitize a string for use as a folder name
fn sanitize_folder_name(name: &str) -> String {
    name.chars()
        .map(|c| match c {
            '/' | '\\' | ':' | '*' | '?' | '"' | '<' | '>' | '|' => '_',
            _ => c,
        })
        .collect::<String>()
        .trim()
        .to_string()
}

/// Generate a unique filename, handling duplicates
fn generate_unique_filename(
    folder: &Path,
    original_name: &str,
    used_names: &mut HashMap<String, HashMap<String, u32>>,
    category: &str,
) -> String {
    let category_names = used_names.entry(category.to_string()).or_default();

    // Check if this filename was already used in this category
    if let Some(count) = category_names.get(original_name) {
        // Generate numbered variant
        let path = Path::new(original_name);
        let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or(original_name);
        let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");

        let new_name = if ext.is_empty() {
            format!("{}_{}", stem, count + 1)
        } else {
            format!("{}_{}.{}", stem, count + 1, ext)
        };

        category_names.insert(original_name.to_string(), count + 1);
        new_name
    } else {
        // Check if file already exists on disk
        let dest = folder.join(original_name);
        if dest.exists() {
            // Find a free number
            let path = Path::new(original_name);
            let stem = path.file_stem().and_then(|s| s.to_str()).unwrap_or(original_name);
            let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");

            let mut counter = 1u32;
            loop {
                let new_name = if ext.is_empty() {
                    format!("{}_{}", stem, counter)
                } else {
                    format!("{}_{}.{}", stem, counter, ext)
                };

                if !folder.join(&new_name).exists() {
                    category_names.insert(original_name.to_string(), counter);
                    return new_name;
                }
                counter += 1;
            }
        } else {
            category_names.insert(original_name.to_string(), 0);
            original_name.to_string()
        }
    }
}

/// Preview the organization without actually moving files
/// Returns a map of category -> list of files
pub fn preview_organization(
    files: &[AudioMetadata],
    organize_by: &str,
) -> HashMap<String, Vec<String>> {
    let mut preview: HashMap<String, Vec<String>> = HashMap::new();

    for file in files {
        // Get the category (handles SFX detection automatically)
        let category = get_file_category(file, organize_by);
        let safe_category = sanitize_folder_name(&category);

        preview
            .entry(safe_category)
            .or_default()
            .push(file.filename.clone());
    }

    preview
}

/// Find files that already exist in the target folders
pub fn find_duplicates(
    files: &[AudioMetadata],
    output_folder: &str,
    organize_by: &str,
) -> Vec<DuplicateInfo> {
    let output_path = Path::new(output_folder);
    let mut duplicates = Vec::new();

    for file in files {
        // Get the category (handles SFX detection automatically)
        let category = get_file_category(file, organize_by);
        let safe_category = sanitize_folder_name(&category);
        let target_path = output_path.join(&safe_category).join(&file.filename);

        if target_path.exists() {
            duplicates.push(DuplicateInfo {
                source_path: file.path.clone(),
                source_filename: file.filename.clone(),
                existing_path: target_path.to_string_lossy().to_string(),
                category: safe_category,
            });
        }
    }

    duplicates
}

/// Delete duplicate files (the existing ones in target folders)
pub fn delete_duplicates(paths: &[String]) -> Result<(u32, Vec<String>), String> {
    let mut deleted_count = 0u32;
    let mut errors = Vec::new();

    for path in paths {
        match fs::remove_file(path) {
            Ok(_) => deleted_count += 1,
            Err(e) => errors.push(format_fs_error(&e, path, "delete")),
        }
    }

    Ok((deleted_count, errors))
}

/// Find source files with the same filename that would go to the same category folder
/// Returns groups of duplicates where each group has 2+ files with same name + category
pub fn find_source_duplicates(
    files: &[AudioMetadata],
    organize_by: &str,
) -> Vec<SourceDuplicateGroup> {
    // Group files by (filename, category)
    let mut groups: HashMap<(String, String), Vec<SourceDuplicateFile>> = HashMap::new();

    for file in files {
        // Get the category (handles SFX detection automatically)
        let category = get_file_category(file, organize_by);
        let safe_category = sanitize_folder_name(&category);

        // Get parent folder name for display
        let folder = Path::new(&file.path)
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .unwrap_or("Unknown")
            .to_string();

        let key = (file.filename.clone(), safe_category);
        groups.entry(key).or_default().push(SourceDuplicateFile {
            path: file.path.clone(),
            folder,
        });
    }

    // Filter to only groups with 2+ files (actual duplicates)
    groups
        .into_iter()
        .filter(|(_, files)| files.len() > 1)
        .map(|((filename, category), files)| SourceDuplicateGroup {
            filename,
            category,
            files,
        })
        .collect()
}
