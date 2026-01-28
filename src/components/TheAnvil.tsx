import { useState } from 'react';
import { FileIcon, CheckCircle, AlertCircle } from '../icons';

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
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      <div className="anvil-container">
        <div style={{ marginBottom: '32px' }}>
          <label className="anvil-label">
            TARGET VERSION NUMBER
          </label>
          <div style={{ display: 'flex', gap: '12px' }}>
            <input
              type="number"
              value={targetVersion}
              onChange={(e) => setTargetVersion(e.target.value)}
              style={{ flex: 1, padding: '12px 16px', fontSize: '16px', border: '2px solid #e0e0e0', borderRadius: '8px', fontFamily: 'Work Sans, sans-serif' }}
              placeholder="e.g., 43"
            />
            <button
              onClick={() => setShowVersionList(!showVersionList)}
              style={{ padding: '12px 24px', backgroundColor: '#267b8e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontFamily: 'Work Sans, sans-serif' }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1f6373')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#267b8e')}
            >
              {showVersionList ? 'Hide' : 'Show'} Versions
            </button>
          </div>
          <p className="anvil-input-hint">
            Most common: Version 43 (Premiere Pro 2025)
          </p>
        </div>

        {showVersionList && (
          <div style={{ marginBottom: '32px', padding: '24px', backgroundColor: '#f9f9f9', borderRadius: '8px', border: '2px solid #e0e0e0' }}>
            <h3 className="version-ref-title">
              VERSION REFERENCE
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '12px' }}>
              {versionMap.map((v) => (
                <button
                  key={v.version}
                  onClick={() => {
                    setTargetVersion(v.version);
                    setShowVersionList(false);
                  }}
                  style={{ padding: '16px', backgroundColor: 'white', border: '2px solid #e0e0e0', borderRadius: '8px', cursor: 'pointer', textAlign: 'left', fontFamily: 'Work Sans, sans-serif' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#267b8e';
                    e.currentTarget.style.color = 'white';
                    e.currentTarget.style.borderColor = '#267b8e';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white';
                    e.currentTarget.style.color = 'inherit';
                    e.currentTarget.style.borderColor = '#e0e0e0';
                  }}
                >
                  <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>v{v.version}</span>
                  <span style={{ margin: '0 8px', color: '#999' }}>→</span>
                  <span>{v.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div
          className="anvil-drag-area"
          onDrop={handleFileDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <FileIcon style={{ width: '64px', height: '64px', margin: '0 auto 24px', color: '#999' }} />
          <p className="anvil-drag-text">
            Drag & drop .prproj files here
          </p>
          <p className="anvil-drag-subtext">or</p>
          <label
            style={{ display: 'inline-block', padding: '12px 32px', backgroundColor: '#267b8e', color: 'white', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontFamily: 'Work Sans, sans-serif' }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1f6373')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#267b8e')}
          >
            Browse Files or Folders
            <input
              type="file"
              multiple
              // @ts-ignore - webkitdirectory is not in TypeScript types
              webkitdirectory=""
              directory=""
              accept=".prproj"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
          </label>
        </div>
      </div>

      {files.length > 0 && (
        <div className="anvil-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
            <h2 className="anvil-section-title">Files ({files.length})</h2>
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              <button
                onClick={clearAll}
                style={{ padding: '10px 20px', backgroundColor: '#e0e0e0', color: '#333', border: 'none', borderRadius: '8px', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}
              >
                Clear All
              </button>
              {processedFiles.length > 0 && (
                <button
                  onClick={downloadAllAsZip}
                  style={{ padding: '10px 20px', backgroundColor: '#267b8e', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600', fontFamily: 'Work Sans, sans-serif' }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1f6373')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#267b8e')}
                >
                  Download ZIP ({processedFiles.length})
                </button>
              )}
              <button
                onClick={processAllFiles}
                disabled={processing || files.every((f) => f.status !== 'pending')}
                style={{ padding: '10px 32px', backgroundColor: processing ? '#ccc' : '#267b8e', color: 'white', border: 'none', borderRadius: '8px', cursor: processing ? 'not-allowed' : 'pointer', fontWeight: '600', fontFamily: 'Work Sans, sans-serif' }}
              >
                {processing ? 'Processing...' : 'Upgrade All'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {files.map((fileObj, index) => (
              <div key={index} className="anvil-file-item">
                <div style={{ flex: 1 }}>
                  <p className="anvil-file-name">{fileObj.file.name}</p>
                  {fileObj.currentVersion && (
                    <p className="anvil-file-version">
                      Version {fileObj.currentVersion} → {targetVersion}
                    </p>
                  )}
                  {fileObj.error && <p className="anvil-file-error">{fileObj.error}</p>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  {fileObj.status === 'pending' && <span className="anvil-status-pending">Pending</span>}
                  {fileObj.status === 'processing' && <span className="anvil-status-processing">Processing...</span>}
                  {fileObj.status === 'completed' && <CheckCircle style={{ width: '24px', height: '24px', color: '#4caf50' }} />}
                  {fileObj.status === 'error' && <AlertCircle style={{ width: '24px', height: '24px', color: '#d32f2f' }} />}
                  <button
                    onClick={() => removeFile(index)}
                    style={{ fontSize: '14px', color: '#d32f2f', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'Work Sans, sans-serif' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TheAnvil;
