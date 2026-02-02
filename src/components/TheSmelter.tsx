import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { readFile } from "@tauri-apps/plugin-fs";
import { MusicIcon, FolderIcon, CheckCircle, AlertCircle } from "../icons";
import { useAnalytics } from "../hooks/useAnalytics";

// Types matching the Rust backend
interface AudioMetadata {
  path: string;
  filename: string;
  title: string | null;
  artist: string | null;
  genre: string | null;
  mood: string | null;
  energy: string | null;
  bpm: number | null;
  duration_secs: number | null;
}

interface OrganizeResult {
  success_count: number;
  error_count: number;
  skipped_count: number;
  errors: string[];
}

interface DuplicateInfo {
  source_path: string;
  source_filename: string;
  existing_path: string;
  category: string;
}

type FileStatus = "pending" | "scanning" | "scanned" | "organizing" | "done" | "error";

interface MusicFile extends AudioMetadata {
  status: FileStatus;
  error?: string;
  organizeByOverride?: OrganizeBy; // Per-file override for organize-by
}

type OrganizeBy = "genre" | "mood";
type Operation = "move" | "copy";

// Editable cell component
interface EditableCellProps {
  value: string | null;
  placeholder: string;
  onSave: (value: string) => void;
  className?: string;
}

const EditableCell = ({ value, placeholder, onSave, className }: EditableCellProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");

  const handleDoubleClick = () => {
    setEditValue(value || "");
    setIsEditing(true);
  };

  const handleBlur = () => {
    setIsEditing(false);
    const trimmed = editValue.trim();
    if (trimmed !== (value || "")) {
      onSave(trimmed || "Unknown");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleBlur();
    } else if (e.key === "Escape") {
      setEditValue(value || "");
      setIsEditing(false);
    }
  };

  if (isEditing) {
    return (
      <input
        type="text"
        className="editable-cell-input"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        autoFocus
      />
    );
  }

  return (
    <span
      className={`editable-cell ${className || ""} ${value ? "" : "empty"}`}
      onDoubleClick={handleDoubleClick}
      title="Double-click to edit"
    >
      {value || placeholder}
    </span>
  );
};

interface TheSmelterProps {
  isActive?: boolean;
}

const TheSmelter = ({ isActive = true }: TheSmelterProps) => {
  // State
  const [files, setFiles] = useState<MusicFile[]>([]);
  const [isScanning, setIsScanning] = useState(false);
  const analytics = useAnalytics();
  const [isOrganizing, setIsOrganizing] = useState(false);
  const [outputFolder, setOutputFolder] = useState<string | null>(null);
  const [organizeBy, setOrganizeBy] = useState<OrganizeBy>("genre");
  const [operation, setOperation] = useState<Operation>("copy");
  const [preview, setPreview] = useState<Record<string, string[]> | null>(null);
  const [result, setResult] = useState<OrganizeResult | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateInfo[]>([]);
  const [showDuplicates, setShowDuplicates] = useState(false);
  const [selectedDuplicates, setSelectedDuplicates] = useState<Set<string>>(new Set());
  const [showBrowseMenu, setShowBrowseMenu] = useState(false);
  const [showUnknownWarning, setShowUnknownWarning] = useState(false);
  const [isRescanning, setIsRescanning] = useState(false);

  // Audio playback state
  const [playingFile, setPlayingFile] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const blobUrlRef = useRef<string | null>(null);

  // Play/pause audio file
  const playFile = async (path: string) => {
    // If clicking the same file, toggle pause/play
    if (playingFile === path && audioRef.current) {
      if (audioRef.current.paused) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
      return;
    }

    // Stop previous audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }

    try {
      // Read file as bytes using Tauri FS plugin
      const contents = await readFile(path);
      const mimeType = path.toLowerCase().endsWith(".wav") ? "audio/wav" : "audio/mpeg";
      const blob = new Blob([contents], { type: mimeType });
      const url = URL.createObjectURL(blob);
      blobUrlRef.current = url;

      // Create and play audio
      const audio = new Audio(url);
      audio.onended = () => setPlayingFile(null);
      audio.onerror = () => {
        console.error("Audio playback error");
        setPlayingFile(null);
      };
      await audio.play();
      audioRef.current = audio;
      setPlayingFile(path);
    } catch (error) {
      console.error("Failed to play audio:", error);
      setPlayingFile(null);
    }
  };

  // Stop audio when tab becomes inactive
  useEffect(() => {
    if (!isActive && audioRef.current) {
      audioRef.current.pause();
      setPlayingFile(null);
    }
  }, [isActive]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (blobUrlRef.current) {
        URL.revokeObjectURL(blobUrlRef.current);
      }
    };
  }, []);

  // Count files with Unknown category (respecting per-file overrides)
  const unknownFiles = files.filter((f) => {
    const effective = f.organizeByOverride || organizeBy;
    const value = effective === "genre" ? f.genre : f.mood;
    return !value || value === "Unknown";
  });

  // Set up Tauri native drag-drop listener
  useEffect(() => {
    let unlisten: (() => void) | undefined;

    const setupDragDrop = async () => {
      const window = getCurrentWindow();
      unlisten = await window.onDragDropEvent(async (event) => {
        if (event.payload.type === "enter") {
          setDragOver(true);
        } else if (event.payload.type === "leave") {
          setDragOver(false);
        } else if (event.payload.type === "drop") {
          setDragOver(false);
          const allPaths = event.payload.paths;

          // Separate files from folders
          const audioFiles = allPaths.filter(
            (p) => p.toLowerCase().endsWith(".mp3") || p.toLowerCase().endsWith(".wav")
          );
          const folders = allPaths.filter(
            (p) => !p.toLowerCase().endsWith(".mp3") && !p.toLowerCase().endsWith(".wav")
          );

          // Scan individual audio files
          if (audioFiles.length > 0) {
            scanFiles(audioFiles);
          }

          // Scan folders recursively
          for (const folder of folders) {
            setIsScanning(true);
            try {
              const results: AudioMetadata[] = await invoke("scan_directory", { path: folder });
              const newFiles: MusicFile[] = results.map((m) => ({
                ...m,
                status: "scanned" as FileStatus,
              }));
              // Add only unique files (deduplicate by path)
              setFiles((prev) => {
                const uniqueNew = addFilesWithDedup(newFiles, prev);
                if (uniqueNew.length > 0) {
                  analytics.trackSmelterFilesAdded(uniqueNew.length, "drag_drop");
                }
                return [...prev, ...uniqueNew];
              });
            } catch (error) {
              console.error("Failed to scan folder:", error);
            }
            setIsScanning(false);
          }
        }
      });
    };

    setupDragDrop();

    return () => {
      if (unlisten) unlisten();
    };
  }, []);

  // Close browse menu when clicking outside
  useEffect(() => {
    if (!showBrowseMenu) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.browse-dropdown')) {
        setShowBrowseMenu(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showBrowseMenu]);

  // Auto-update preview when files or organizeBy changes
  useEffect(() => {
    if (files.length > 0 && files.some((f) => f.status === "scanned")) {
      updatePreview(files, organizeBy);
    } else {
      setPreview(null);
    }
  }, [files, organizeBy]);

  // Browse for files (uses Tauri dialog - provides full paths)
  const browseFiles = async () => {
    setShowBrowseMenu(false);
    const selected = await open({
      multiple: true,
      filters: [{ name: "Audio", extensions: ["mp3", "wav", "MP3", "WAV"] }],
      title: "Select audio files",
    });

    if (selected && Array.isArray(selected) && selected.length > 0) {
      analytics.trackSmelterFilesAdded(selected.length, "browse");
      await scanFiles(selected);
    }
  };

  // Browse for folder (uses Tauri dialog - provides full paths, scans recursively)
  const browseFolder = async () => {
    setShowBrowseMenu(false);
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select folder with music files",
    });

    if (selected && typeof selected === "string") {
      setIsScanning(true);
      try {
        const results: AudioMetadata[] = await invoke("scan_directory", { path: selected });
        const newFiles: MusicFile[] = results.map((m) => ({
          ...m,
          status: "scanned" as FileStatus,
        }));
        // Add only unique files (deduplicate by path)
        setFiles((prev) => {
          const uniqueNew = addFilesWithDedup(newFiles, prev);
          if (uniqueNew.length > 0) {
            analytics.trackSmelterFilesAdded(uniqueNew.length, "browse");
          }
          return [...prev, ...uniqueNew];
        });
      } catch (error) {
        console.error("Failed to scan directory:", error);
      }
      setIsScanning(false);
    }
  };

  // Scan files for metadata
  const scanFiles = async (paths: string[]) => {
    // Filter out paths that are already in the file list
    const existingPaths = new Set(files.map((f) => f.path));
    const newPaths = paths.filter((p) => !existingPaths.has(p));

    if (newPaths.length === 0) {
      return; // All files already added
    }

    // Add files as pending
    const pendingFiles: MusicFile[] = newPaths.map((path) => ({
      path,
      filename: path.split("/").pop() || path,
      title: null,
      artist: null,
      genre: null,
      mood: null,
      energy: null,
      bpm: null,
      duration_secs: null,
      status: "pending" as FileStatus,
    }));

    setFiles((prev) => [...prev, ...pendingFiles]);
    setIsScanning(true);

    try {
      const results: AudioMetadata[] = await invoke("scan_audio_files", { paths: newPaths });

      // Update files with metadata
      setFiles((prev) => {
        const updated = [...prev];
        for (const result of results) {
          const idx = updated.findIndex((f) => f.path === result.path);
          if (idx !== -1) {
            updated[idx] = {
              ...result,
              status: "scanned",
            };
          }
        }
        return updated;
      });

      // Update preview
      const allFiles = files.concat(
        results.map((r) => ({ ...r, status: "scanned" as FileStatus }))
      );
      updatePreview(allFiles, organizeBy);
    } catch (error) {
      console.error("Failed to scan files:", error);
    }

    setIsScanning(false);
  };

  // Update organization preview
  // Prepare files with category_override for backend (respecting per-file overrides)
  const prepareFilesForBackend = (fileList: MusicFile[], defaultOrganizeBy: OrganizeBy) => {
    return fileList.map((f) => {
      const effective = f.organizeByOverride || defaultOrganizeBy;
      // Set category_override to the effective category value
      const categoryValue = effective === "genre"
        ? (f.genre || "Unknown")
        : (f.mood ? f.mood.split(",")[0].trim() : "Unknown");

      return {
        ...f,
        category_override: f.organizeByOverride ? categoryValue : undefined,
      };
    });
  };

  const updatePreview = async (fileList: MusicFile[], by: OrganizeBy) => {
    if (fileList.length === 0) {
      setPreview(null);
      return;
    }

    try {
      const preparedFiles = prepareFilesForBackend(fileList, by);
      const previewResult: Record<string, string[]> = await invoke("preview_organization", {
        files: preparedFiles,
        organizeBy: by,
      });
      setPreview(previewResult);
    } catch (error) {
      console.error("Failed to generate preview:", error);
    }
  };

  // Select output folder
  const selectOutputFolder = async () => {
    const selected = await open({
      directory: true,
      multiple: false,
      title: "Select Output Folder",
    });

    if (selected && typeof selected === "string") {
      setOutputFolder(selected);
    }
  };

  // Check for Unknown files before organizing
  const handleOrganizeClick = () => {
    if (!outputFolder || files.length === 0) return;

    // If there are Unknown files, show warning first
    if (unknownFiles.length > 0) {
      setShowUnknownWarning(true);
    } else {
      checkForDuplicates();
    }
  };

  // Proceed after Unknown warning
  const proceedWithUnknowns = () => {
    setShowUnknownWarning(false);
    checkForDuplicates();
  };

  // Check for duplicates before organizing
  const checkForDuplicates = async () => {
    if (!outputFolder || files.length === 0) return;

    try {
      const scannedFiles = files.filter((f) => f.status === "scanned");
      const preparedFiles = prepareFilesForBackend(scannedFiles, organizeBy);
      const found: DuplicateInfo[] = await invoke("find_duplicates", {
        files: preparedFiles,
        outputFolder,
        organizeBy,
      });

      if (found.length > 0) {
        setDuplicates(found);
        setSelectedDuplicates(new Set(found.map((d) => d.existing_path)));
        setShowDuplicates(true);
      } else {
        // No duplicates, proceed with organizing
        await doOrganize();
      }
    } catch (error) {
      console.error("Failed to check duplicates:", error);
      // Proceed anyway
      await doOrganize();
    }
  };

  // Delete selected duplicates and then organize
  const handleDeleteDuplicates = async () => {
    if (selectedDuplicates.size > 0) {
      try {
        await invoke("delete_duplicates", {
          paths: Array.from(selectedDuplicates),
        });
      } catch (error) {
        console.error("Failed to delete duplicates:", error);
      }
    }
    setShowDuplicates(false);
    setDuplicates([]);
    await doOrganize();
  };

  // Skip duplicates and organize (will rename files)
  const handleSkipDuplicates = async () => {
    setShowDuplicates(false);
    setDuplicates([]);
    await doOrganize();
  };

  // Cancel duplicate handling
  const handleCancelDuplicates = () => {
    setShowDuplicates(false);
    setDuplicates([]);
    setSelectedDuplicates(new Set());
  };

  // Toggle duplicate selection
  const toggleDuplicateSelection = (path: string) => {
    setSelectedDuplicates((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  // Select/deselect all duplicates
  const toggleAllDuplicates = () => {
    if (selectedDuplicates.size === duplicates.length) {
      setSelectedDuplicates(new Set());
    } else {
      setSelectedDuplicates(new Set(duplicates.map((d) => d.existing_path)));
    }
  };

  // Actually organize files
  const doOrganize = async () => {
    if (!outputFolder || files.length === 0) return;

    setIsOrganizing(true);
    setResult(null);

    try {
      const scannedFiles = files.filter((f) => f.status === "scanned");
      const preparedFiles = prepareFilesForBackend(scannedFiles, organizeBy);
      const organizeResult: OrganizeResult = await invoke("organize_files", {
        files: preparedFiles,
        outputFolder,
        organizeBy,
        operation,
      });

      setResult(organizeResult);

      // Track successful organization
      if (organizeResult.success_count > 0) {
        analytics.trackSmelterOrganize(organizeResult.success_count, organizeBy, operation);
      }

      // Update file statuses
      setFiles((prev) =>
        prev.map((f) => ({
          ...f,
          status: "done" as FileStatus,
        }))
      );
    } catch (error) {
      console.error("Failed to organize files:", error);
      setResult({
        success_count: 0,
        error_count: files.length,
        skipped_count: 0,
        errors: [String(error)],
      });
    }

    setIsOrganizing(false);
  };

  // Clear all files
  const clearFiles = () => {
    setFiles([]);
    setPreview(null);
    setResult(null);
    setDuplicates([]);
    setShowDuplicates(false);
    setSelectedDuplicates(new Set());
  };

  // Remove a single file
  const removeFile = (path: string) => {
    setFiles((prev) => prev.filter((f) => f.path !== path));
  };

  // Rescan all files - clears cache and re-reads metadata from disk
  const rescanFiles = async () => {
    if (files.length === 0) return;

    setIsRescanning(true);
    try {
      const paths = files.map((f) => f.path);
      const results: AudioMetadata[] = await invoke("rescan_files", { paths });

      // Update files with fresh metadata
      setFiles((prev) =>
        prev.map((f) => {
          const fresh = results.find((r) => r.path === f.path);
          if (fresh) {
            return {
              ...fresh,
              status: "scanned" as FileStatus,
              organizeByOverride: f.organizeByOverride, // Preserve user overrides
            };
          }
          return f;
        })
      );
    } catch (error) {
      console.error("Failed to rescan files:", error);
    }
    setIsRescanning(false);
  };

  // Update file metadata (in-memory only, for organization)
  const updateFileMetadata = (path: string, field: "genre" | "mood", value: string) => {
    setFiles((prev) => {
      const updated = prev.map((f) => {
        if (f.path === path) {
          return { ...f, [field]: value === "Unknown" ? null : value };
        }
        return f;
      });
      return updated;
    });
  };

  // Toggle per-file organize-by override
  const toggleFileOrganizeBy = (path: string, useField: OrganizeBy) => {
    setFiles((prev) =>
      prev.map((f) => {
        if (f.path === path) {
          // If clicking the same as global default and no override, do nothing
          // If clicking different from current effective, set override
          const currentEffective = f.organizeByOverride || organizeBy;
          if (currentEffective === useField) {
            // Clicking same field - clear override to use global
            return { ...f, organizeByOverride: undefined };
          } else {
            // Set override to use this field
            return { ...f, organizeByOverride: useField };
          }
        }
        return f;
      })
    );
  };

  // Get effective organize-by for a file (override or global)
  const getEffectiveOrganizeBy = (file: MusicFile): OrganizeBy => {
    return file.organizeByOverride || organizeBy;
  };

  // Format duration
  const formatDuration = (secs: number | null) => {
    if (!secs) return "-";
    const mins = Math.floor(secs / 60);
    const remainingSecs = Math.floor(secs % 60);
    return `${mins}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  // Handle organize-by change
  const handleOrganizeByChange = (value: OrganizeBy) => {
    setOrganizeBy(value);
    updatePreview(files, value);
  };

  const scannedCount = files.filter((f) => f.status === "scanned" || f.status === "done").length;

  // Helper to add files without duplicates (deduplication by path)
  const addFilesWithDedup = (newFiles: MusicFile[], currentFiles?: MusicFile[]) => {
    const existing = currentFiles || files;
    const existingPaths = new Set(existing.map((f) => f.path));
    const uniqueNew = newFiles.filter((f) => !existingPaths.has(f.path));
    return uniqueNew;
  };

  return (
    <div className="smelter-container">
      {/* Header */}
      <div className="smelter-header">
        <h2>The Smelter</h2>
        <p>Organize your music library by genre or mood</p>
      </div>

      {/* Drop Zone - Tauri native drag-drop handles the actual drop via onDragDropEvent */}
      {files.length === 0 && !result && (
        <div
          className={`smelter-drop-zone ${dragOver ? "drag-over" : ""}`}
        >
          <MusicIcon className="drop-zone-icon" />
          <p className="drop-zone-text">Drag music files or folders here</p>
          <p className="drop-zone-hint">Supports MP3 and WAV files</p>
          <div className="drop-zone-buttons">
            <div className="browse-dropdown">
              <button
                className="browse-button"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowBrowseMenu(!showBrowseMenu);
                }}
              >
                Browse ▾
              </button>
              {showBrowseMenu && (
                <div className="browse-menu">
                  <button onClick={browseFiles}>Select Files</button>
                  <button onClick={browseFolder}>Select Folder</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && !result && (
        <div className="smelter-content">
          {/* File Table */}
          <div className="smelter-files-section">
            <div className="section-header">
              <h3>Files ({files.length})</h3>
              <div className="section-actions">
                <button
                  className="rescan-button"
                  onClick={rescanFiles}
                  disabled={isRescanning || files.length === 0}
                  title="Re-read metadata from files (clears cache)"
                >
                  {isRescanning ? "↻ Rescanning..." : "↻ Rescan"}
                </button>
                <div className="browse-dropdown small">
                  <button
                    className="add-more-button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowBrowseMenu(!showBrowseMenu);
                    }}
                  >
                    + Add More ▾
                  </button>
                  {showBrowseMenu && (
                    <div className="browse-menu">
                      <button onClick={browseFiles}>Add Files</button>
                      <button onClick={browseFolder}>Add Folder</button>
                    </div>
                  )}
                </div>
                <button className="clear-button" onClick={clearFiles}>
                  Clear All
                </button>
              </div>
            </div>

            {isScanning && (
              <div className="scanning-indicator">
                <span className="spinner"></span>
                <span>Scanning files...</span>
              </div>
            )}

            <div className="file-table-container">
              <table className="file-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>Filename</th>
                    <th>Genre</th>
                    <th>Mood</th>
                    <th>Duration</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((file) => (
                    <tr key={file.path} className={`file-row status-${file.status}`}>
                      <td className="play-cell">
                        <button
                          className={`play-btn ${playingFile === file.path ? "playing" : ""}`}
                          onClick={() => playFile(file.path)}
                          title={playingFile === file.path ? "Pause" : "Play"}
                        >
                          {playingFile === file.path ? "⏸" : "▶"}
                        </button>
                      </td>
                      <td className="filename-cell">
                        <span className="filename">{file.filename}</span>
                        {file.title && file.title !== file.filename && (
                          <span className="title">{file.title}</span>
                        )}
                      </td>
                      <td>
                        <div
                          className={`organize-by-cell ${getEffectiveOrganizeBy(file) === "genre" ? "selected" : ""}`}
                          onClick={() => toggleFileOrganizeBy(file.path, "genre")}
                          title="Click to use Genre for this file"
                        >
                          <EditableCell
                            value={file.genre}
                            placeholder="Unknown"
                            className="tag genre-tag"
                            onSave={(value) => updateFileMetadata(file.path, "genre", value)}
                          />
                        </div>
                      </td>
                      <td>
                        <div
                          className={`organize-by-cell ${getEffectiveOrganizeBy(file) === "mood" ? "selected" : ""}`}
                          onClick={() => toggleFileOrganizeBy(file.path, "mood")}
                          title="Click to use Mood for this file"
                        >
                          {!file.mood && (
                            <span
                              className="unknown-warning"
                              title="No mood metadata found. Try Rescan or double-click to edit."
                            >
                              ⚠️
                            </span>
                          )}
                          <EditableCell
                            value={file.mood ? file.mood.split(",")[0].trim() : null}
                            placeholder="Unknown"
                            className="tag mood-tag"
                            onSave={(value) => updateFileMetadata(file.path, "mood", value)}
                          />
                        </div>
                      </td>
                      <td className="duration-cell">{formatDuration(file.duration_secs)}</td>
                      <td className="actions-cell">
                        <button
                          className="remove-button"
                          onClick={() => removeFile(file.path)}
                          title="Remove"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Organization Settings */}
          <div className="smelter-settings-section">
            <h3>Organization Settings</h3>

            <div className="setting-group">
              <label>Organize by:</label>
              <div className="radio-group">
                <label className={`radio-option ${organizeBy === "genre" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="organizeBy"
                    value="genre"
                    checked={organizeBy === "genre"}
                    onChange={() => handleOrganizeByChange("genre")}
                  />
                  <span>Genre</span>
                </label>
                <label className={`radio-option ${organizeBy === "mood" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="organizeBy"
                    value="mood"
                    checked={organizeBy === "mood"}
                    onChange={() => handleOrganizeByChange("mood")}
                  />
                  <span>Mood</span>
                </label>
              </div>
            </div>

            <div className="setting-group">
              <label>Operation:</label>
              <div className="radio-group">
                <label className={`radio-option ${operation === "copy" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="operation"
                    value="copy"
                    checked={operation === "copy"}
                    onChange={() => setOperation("copy")}
                  />
                  <span>Copy files</span>
                </label>
                <label className={`radio-option ${operation === "move" ? "selected" : ""}`}>
                  <input
                    type="radio"
                    name="operation"
                    value="move"
                    checked={operation === "move"}
                    onChange={() => setOperation("move")}
                  />
                  <span>Move files</span>
                </label>
              </div>
            </div>

            <div className="setting-group">
              <label>Output folder:</label>
              <div className="folder-selector">
                <button className="select-folder-button" onClick={selectOutputFolder}>
                  <FolderIcon className="folder-icon" />
                  <span>{outputFolder || "Select folder..."}</span>
                </button>
              </div>
            </div>

            {/* Preview */}
            {preview && Object.keys(preview).length > 0 && (
              <div className="preview-section">
                <h4>Preview</h4>
                <div className="preview-folders">
                  {Object.entries(preview).map(([folder, fileList]) => (
                    <div key={folder} className="preview-folder">
                      <FolderIcon className="preview-folder-icon" />
                      <span className="preview-folder-name">{folder}/</span>
                      <span className="preview-folder-count">({fileList.length} files)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Organize Button */}
            <button
              className="organize-button"
              onClick={handleOrganizeClick}
              disabled={!outputFolder || scannedCount === 0 || isOrganizing}
            >
              {isOrganizing ? (
                <>
                  <span className="spinner"></span>
                  <span>Organizing...</span>
                </>
              ) : (
                <>
                  <span>Organize {scannedCount} Files</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="smelter-result">
          <div className="result-icon">
            {result.error_count === 0 ? (
              <CheckCircle className="success-icon" />
            ) : (
              <AlertCircle className="error-icon" />
            )}
          </div>
          <h3>Organization Complete</h3>
          <div className="result-stats">
            <div className="stat success">
              <span className="stat-value">{result.success_count}</span>
              <span className="stat-label">files organized</span>
            </div>
            {result.skipped_count > 0 && (
              <div className="stat skipped">
                <span className="stat-value">{result.skipped_count}</span>
                <span className="stat-label">skipped</span>
              </div>
            )}
            {result.error_count > 0 && (
              <div className="stat error">
                <span className="stat-value">{result.error_count}</span>
                <span className="stat-label">errors</span>
              </div>
            )}
          </div>
          {result.errors.length > 0 && (
            <div className="result-errors">
              <h4>Errors:</h4>
              <ul>
                {result.errors.slice(0, 5).map((err, idx) => (
                  <li key={idx}>{err}</li>
                ))}
                {result.errors.length > 5 && (
                  <li>...and {result.errors.length - 5} more</li>
                )}
              </ul>
            </div>
          )}
          <div className="result-actions">
            <button className="start-over-button" onClick={clearFiles}>
              Start Over
            </button>
          </div>
        </div>
      )}

      {/* Unknown Warning Modal */}
      {showUnknownWarning && (
        <div className="duplicates-overlay">
          <div className="duplicates-modal">
            <h3>Files with Unknown {organizeBy === "genre" ? "Genre" : "Mood"}</h3>
            <p className="duplicates-description">
              {unknownFiles.length} file{unknownFiles.length > 1 ? "s" : ""} will be placed in an "Unknown" folder
              because {unknownFiles.length > 1 ? "they don't have" : "it doesn't have"} {organizeBy} metadata.
            </p>

            <div className="duplicates-list" style={{ maxHeight: "200px" }}>
              {unknownFiles.slice(0, 10).map((file) => (
                <div key={file.path} className="duplicate-item" style={{ cursor: "default" }}>
                  <div className="duplicate-info">
                    <span className="duplicate-filename">{file.filename}</span>
                  </div>
                </div>
              ))}
              {unknownFiles.length > 10 && (
                <div className="duplicate-item" style={{ opacity: 0.6 }}>
                  <div className="duplicate-info">
                    <span className="duplicate-filename">...and {unknownFiles.length - 10} more</span>
                  </div>
                </div>
              )}
            </div>

            <div className="duplicates-actions">
              <button className="cancel-button" onClick={() => setShowUnknownWarning(false)}>
                Cancel
              </button>
              <button className="organize-button" onClick={proceedWithUnknowns}>
                Continue Anyway
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Duplicates Modal */}
      {showDuplicates && duplicates.length > 0 && (
        <div className="duplicates-overlay">
          <div className="duplicates-modal">
            <h3>Duplicates Found</h3>
            <p className="duplicates-description">
              {duplicates.length} file{duplicates.length > 1 ? "s" : ""} already exist in the target folders.
              Select which existing files to delete before organizing.
            </p>

            <div className="duplicates-actions-top">
              <label className="select-all-label">
                <input
                  type="checkbox"
                  checked={selectedDuplicates.size === duplicates.length}
                  onChange={toggleAllDuplicates}
                />
                <span>Select All</span>
              </label>
              <span className="selected-count">
                {selectedDuplicates.size} of {duplicates.length} selected
              </span>
            </div>

            <div className="duplicates-list">
              {duplicates.map((dup) => (
                <label key={dup.existing_path} className="duplicate-item">
                  <input
                    type="checkbox"
                    checked={selectedDuplicates.has(dup.existing_path)}
                    onChange={() => toggleDuplicateSelection(dup.existing_path)}
                  />
                  <div className="duplicate-info">
                    <span className="duplicate-filename">{dup.source_filename}</span>
                    <span className="duplicate-category">{dup.category}/</span>
                  </div>
                </label>
              ))}
            </div>

            <div className="duplicates-actions">
              <button className="cancel-button" onClick={handleCancelDuplicates}>
                Cancel
              </button>
              <button className="skip-button" onClick={handleSkipDuplicates}>
                Skip (Rename New)
              </button>
              <button
                className="delete-button"
                onClick={handleDeleteDuplicates}
                disabled={selectedDuplicates.size === 0}
              >
                Delete Selected & Organize
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TheSmelter;
