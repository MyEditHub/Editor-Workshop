import { useState } from 'react';
import { FileIcon, CheckCircle, AlertCircle } from '../icons';
import { useAnalytics } from '../hooks/useAnalytics';

interface TheAnvilProps {
  onUpdateCount: (count: number) => void;
}

interface FileObject {
  file: File;
  status: 'pending' | 'processing' | 'completed' | 'error';
  currentVersion: string | null;
  error: string | null;
}

interface ProcessedFile {
  name: string;
  data: Uint8Array;
}

interface VersionMap {
  version: string;
  year: string;
  name: string;
}

const TheAnvil = ({ onUpdateCount }: TheAnvilProps) => {
  const [files, setFiles] = useState<FileObject[]>([]);
  const [processing, setProcessing] = useState(false);
  const [targetVersion, setTargetVersion] = useState('43');
  const [processedFiles, setProcessedFiles] = useState<ProcessedFile[]>([]);
  const [showVersionList, setShowVersionList] = useState(false);
  const analytics = useAnalytics();

  const versionMap: VersionMap[] = [
    { version: '1', year: '2018', name: 'CC 2018 (12.0)' },
    { version: '2', year: '2018', name: 'CC 2018 (12.1)' },
    { version: '36', year: '2022', name: '2022 (22.0)' },
    { version: '37', year: '2022', name: '2022 (22.1-22.6)' },
    { version: '38', year: '2023', name: '2023 (23.0-23.5)' },
    { version: '39', year: '2023', name: '2023 (23.6)' },
    { version: '40', year: '2024', name: '2024 (24.0-24.2)' },
    { version: '41', year: '2024', name: '2024 (24.3-24.5)' },
    { version: '42', year: '2024', name: '2024 (24.6)' },
    { version: '43', year: '2025', name: '2025 (25.0)' },
  ];

  const decompressGzip = async (data: ArrayBuffer): Promise<string> => {
    const ds = new DecompressionStream('gzip');
    const decompressedStream = new Blob([data]).stream().pipeThrough(ds);
    const decompressed = await new Response(decompressedStream).arrayBuffer();
    return new TextDecoder().decode(decompressed);
  };

  const compressGzip = async (text: string): Promise<Uint8Array> => {
    const cs = new CompressionStream('gzip');
    const stream = new Blob([text]).stream().pipeThrough(cs);
    const compressed = await new Response(stream).arrayBuffer();
    return new Uint8Array(compressed);
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files).filter((file) =>
      file.name.endsWith('.prproj')
    );
    if (droppedFiles.length > 0) {
      analytics.trackAnvilFilesAdded(droppedFiles.length);
    }
    setFiles((prev) => [
      ...prev,
      ...droppedFiles.map((f) => ({
        file: f,
        status: 'pending' as const,
        currentVersion: null,
        error: null,
      })),
    ]);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []).filter((file) =>
      file.name.endsWith('.prproj')
    );
    if (selectedFiles.length > 0) {
      analytics.trackAnvilFilesAdded(selectedFiles.length);
    }
    setFiles((prev) => [
      ...prev,
      ...selectedFiles.map((f) => ({
        file: f,
        status: 'pending' as const,
        currentVersion: null,
        error: null,
      })),
    ]);
  };

  const processFile = async (fileObj: FileObject, index: number): Promise<boolean> => {
    try {
      const arrayBuffer = await fileObj.file.arrayBuffer();
      const decompressed = await decompressGzip(arrayBuffer);

      const versionRegex = /<Project[^>]*Version="(\d+)"/;
      const match = decompressed.match(versionRegex);

      if (!match) {
        throw new Error('Could not find version number in file');
      }

      const currentVersion = match[1];

      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, currentVersion, status: 'processing' as const } : f))
      );

      const upgraded = decompressed.replace(
        versionRegex,
        `<Project ObjectID="1" ClassID="62ad66dd-0dcd-42da-a660-6d8fbde94876" Version="${targetVersion}"`
      );

      const compressed = await compressGzip(upgraded);

      const fileName = fileObj.file.name.replace('.prproj', `_upgraded_v${targetVersion}.prproj`);
      setProcessedFiles((prev) => [...prev, { name: fileName, data: compressed }]);

      setFiles((prev) =>
        prev.map((f, i) => (i === index ? { ...f, status: 'completed' as const } : f))
      );

      return true;
    } catch (error) {
      setFiles((prev) =>
        prev.map((f, i) =>
          i === index
            ? { ...f, status: 'error' as const, error: (error as Error).message }
            : f
        )
      );
      return false;
    }
  };

  const processAllFiles = async () => {
    setProcessing(true);
    setProcessedFiles([]);
    let successCount = 0;

    for (let i = 0; i < files.length; i++) {
      if (files[i].status === 'pending') {
        const success = await processFile(files[i], i);
        if (success) successCount++;
      }
    }

    // Update lifetime count
    const stored = localStorage.getItem('premiere-upgrader-lifetime-count');
    const currentCount = stored ? parseInt(stored, 10) : 0;
    const newCount = currentCount + successCount;
    localStorage.setItem('premiere-upgrader-lifetime-count', newCount.toString());
    onUpdateCount(newCount);

    // Track successful upgrades
    if (successCount > 0) {
      analytics.trackAnvilUpgrade(successCount, targetVersion);
    }

    setProcessing(false);
  };

  const downloadAllAsZip = async () => {
    class ZipWriter {
      files: Array<{ name: Uint8Array; data: Uint8Array }> = [];

      async addFile(name: string, data: Uint8Array) {
        this.files.push({ name: new TextEncoder().encode(name), data });
      }

      crc32(data: Uint8Array): number {
        let crc = 0xffffffff;
        for (let i = 0; i < data.length; i++) {
          crc = crc ^ data[i];
          for (let j = 0; j < 8; j++) {
            crc = (crc >>> 1) ^ (0xedb88320 & (-(crc & 1)));
          }
        }
        return (crc ^ 0xffffffff) >>> 0;
      }

      async generateBlob(): Promise<Blob> {
        const chunks: Uint8Array[] = [];
        let offset = 0;
        const centralDir: Array<{
          name: Uint8Array;
          offset: number;
          size: number;
          crc: number;
        }> = [];

        for (const file of this.files) {
          const localHeader = new Uint8Array(30 + file.name.length);
          const view = new DataView(localHeader.buffer);

          view.setUint32(0, 0x04034b50, true);
          view.setUint16(4, 20, true);
          view.setUint16(6, 0, true);
          view.setUint16(8, 0, true);
          view.setUint16(10, 0, true);
          view.setUint16(12, 0, true);
          view.setUint32(14, this.crc32(file.data), true);
          view.setUint32(18, file.data.length, true);
          view.setUint32(22, file.data.length, true);
          view.setUint16(26, file.name.length, true);
          view.setUint16(28, 0, true);

          localHeader.set(file.name, 30);

          chunks.push(localHeader);
          chunks.push(file.data);

          centralDir.push({
            name: file.name,
            offset: offset,
            size: file.data.length,
            crc: this.crc32(file.data),
          });

          offset += localHeader.length + file.data.length;
        }

        const centralDirStart = offset;

        for (const entry of centralDir) {
          const centralHeader = new Uint8Array(46 + entry.name.length);
          const view = new DataView(centralHeader.buffer);

          view.setUint32(0, 0x02014b50, true);
          view.setUint16(4, 20, true);
          view.setUint16(6, 20, true);
          view.setUint16(8, 0, true);
          view.setUint16(10, 0, true);
          view.setUint16(12, 0, true);
          view.setUint16(14, 0, true);
          view.setUint32(16, entry.crc, true);
          view.setUint32(20, entry.size, true);
          view.setUint32(24, entry.size, true);
          view.setUint16(28, entry.name.length, true);
          view.setUint16(30, 0, true);
          view.setUint16(32, 0, true);
          view.setUint16(34, 0, true);
          view.setUint16(36, 0, true);
          view.setUint32(38, 0, true);
          view.setUint32(42, entry.offset, true);

          centralHeader.set(entry.name, 46);

          chunks.push(centralHeader);
          offset += centralHeader.length;
        }

        const endRecord = new Uint8Array(22);
        const endView = new DataView(endRecord.buffer);

        endView.setUint32(0, 0x06054b50, true);
        endView.setUint16(4, 0, true);
        endView.setUint16(6, 0, true);
        endView.setUint16(8, centralDir.length, true);
        endView.setUint16(10, centralDir.length, true);
        endView.setUint32(12, offset - centralDirStart, true);
        endView.setUint32(16, centralDirStart, true);
        endView.setUint16(20, 0, true);

        chunks.push(endRecord);

        return new Blob(chunks, { type: 'application/zip' });
      }
    }

    const zipWriter = new ZipWriter();

    for (const file of processedFiles) {
      await zipWriter.addFile(file.name, file.data);
    }

    const zipBlob = await zipWriter.generateBlob();
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `premiere_upgraded_v${targetVersion}.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const clearAll = () => {
    setFiles([]);
    setProcessedFiles([]);
  };

  return (
    <div className="anvil-container-dark">
      {/* Header */}
      <div className="anvil-header">
        <h2>The Anvil</h2>
        <p>Upgrade Adobe Premiere Pro project files to newer versions</p>
      </div>

      {/* Version Selection */}
      <div className="anvil-section">
        <div className="anvil-version-selector">
          <label className="anvil-label-dark">Target Version</label>
          <div className="anvil-version-input-row">
            <input
              type="number"
              value={targetVersion}
              onChange={(e) => setTargetVersion(e.target.value)}
              className="anvil-input-dark"
              placeholder="e.g., 43"
            />
            <button
              onClick={() => setShowVersionList(!showVersionList)}
              className="anvil-button-secondary"
            >
              {showVersionList ? 'Hide' : 'Show'} Versions
            </button>
          </div>
          <p className="anvil-hint">Most common: Version 43 (Premiere Pro 2025)</p>
        </div>

        {showVersionList && (
          <div className="anvil-version-list">
            <h4>Version Reference</h4>
            <div className="anvil-version-grid">
              {versionMap.map((v) => (
                <button
                  key={v.version}
                  onClick={() => {
                    setTargetVersion(v.version);
                    setShowVersionList(false);
                  }}
                  className="anvil-version-button"
                >
                  <span className="version-number">v{v.version}</span>
                  <span className="version-arrow">→</span>
                  <span className="version-name">{v.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Drop Zone */}
      {files.length === 0 && (
        <div
          className="anvil-drop-zone"
          onDrop={handleFileDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <FileIcon className="drop-zone-icon" />
          <p className="drop-zone-text">Drag & drop .prproj files here</p>
          <p className="drop-zone-hint">or</p>
          <label className="browse-button">
            Browse Files or Folders
            <input
              type="file"
              multiple
              // @ts-expect-error - webkitdirectory is not in TypeScript types
              webkitdirectory=""
              directory=""
              accept=".prproj"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      )}

      {/* File List */}
      {files.length > 0 && (
        <div className="anvil-files-section">
          <div className="section-header">
            <h3>Files ({files.length})</h3>
            <div className="section-actions">
              <label className="add-more-button">
                + Add Files
                <input
                  type="file"
                  multiple
                  // @ts-expect-error - webkitdirectory is not in TypeScript types
                  webkitdirectory=""
                  directory=""
                  accept=".prproj"
                  onChange={handleFileSelect}
                  style={{ display: 'none' }}
                />
              </label>
              <button onClick={clearAll} className="clear-button">
                Clear All
              </button>
            </div>
          </div>

          <div className="anvil-file-list">
            {files.map((fileObj, index) => (
              <div key={index} className={`anvil-file-row status-${fileObj.status}`}>
                <div className="file-info">
                  <span className="file-name">{fileObj.file.name}</span>
                  {fileObj.currentVersion && (
                    <span className="file-version">
                      v{fileObj.currentVersion} → v{targetVersion}
                    </span>
                  )}
                  {fileObj.error && <span className="file-error">{fileObj.error}</span>}
                </div>
                <div className="file-actions">
                  {fileObj.status === 'pending' && <span className="status-badge pending">Pending</span>}
                  {fileObj.status === 'processing' && <span className="status-badge processing">Processing...</span>}
                  {fileObj.status === 'completed' && <CheckCircle className="status-icon success" />}
                  {fileObj.status === 'error' && <AlertCircle className="status-icon error" />}
                  <button onClick={() => removeFile(index)} className="remove-button" title="Remove">
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="anvil-action-bar">
            {processedFiles.length > 0 && (
              <button onClick={downloadAllAsZip} className="anvil-button-secondary">
                Download ZIP ({processedFiles.length})
              </button>
            )}
            <button
              onClick={processAllFiles}
              disabled={processing || files.every((f) => f.status !== 'pending')}
              className="organize-button"
            >
              {processing ? 'Processing...' : `Upgrade ${files.filter(f => f.status === 'pending').length} Files`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TheAnvil;
