import React, { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { FiUpload, FiX, FiCheck } from "react-icons/fi";
import styles from "./file-upload.module.css";

interface FileUploadResult {
  success: boolean;
  error?: string;
}

interface FileUploadProps {
  onFileUpload: (file: File) => Promise<FileUploadResult>;
  acceptedFormats?: string[];
  maxSizeMB?: number;
}

// react-dropzone's `accept` option is keyed by MIME type, not extension.
// This used to be hardcoded to `{ "text/plain": acceptedFormats }`, which
// silently ignored whatever extensions a caller passed in — anything other
// than a plain-text file was rejected by the dropzone before `onDrop` (and
// therefore `acceptedFormats`) ever ran. Map each accepted extension to the
// MIME type(s) browsers actually report for it so callers can extend
// `acceptedFormats` and have it take effect.
const EXTENSION_MIME_TYPES: Record<string, string[]> = {
  ".txt": ["text/plain"],
  ".zip": ["application/zip", "application/x-zip-compressed", "application/x-zip"],
};

function buildAcceptMap(formats: string[]): Record<string, string[]> {
  const accept: Record<string, string[]> = {};
  for (const format of formats) {
    const mimeTypes = EXTENSION_MIME_TYPES[format.toLowerCase()];
    if (!mimeTypes) {
      // Unrecognized extension — key by the extension itself so
      // react-dropzone still filters by suffix instead of dropping it.
      accept[format] = [...(accept[format] ?? []), format];
      continue;
    }
    for (const mime of mimeTypes) {
      accept[mime] = [...(accept[mime] ?? []), format];
    }
  }
  return accept;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onFileUpload,
  acceptedFormats = [".txt"],
  maxSizeMB = 10,
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) return;

      const file = acceptedFiles[0];

      // Validate file size
      if (file.size > maxSizeMB * 1024 * 1024) {
        setUploadError(`File size exceeds ${maxSizeMB}MB`);
        return;
      }

      try {
        setIsUploading(true);
        setUploadError(null);
        const result = await onFileUpload(file);
        if (!result.success) {
          setUploadError(
            result.error || "Failed to upload file. Please try again.",
          );
          return;
        }
        setUploadSuccess(true);
        // Reset success state after 3 seconds
        setTimeout(() => setUploadSuccess(false), 3000);
      } catch (error) {
        console.error("Upload error:", error);
        setUploadError("Failed to upload file. Please try again.");
      } finally {
        setIsUploading(false);
      }
    },
    [maxSizeMB, onFileUpload],
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: buildAcceptMap(acceptedFormats),
    maxFiles: 1,
    disabled: isUploading,
  });

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
  };

  return (
    <div className={styles.container}>
      <div
        {...getRootProps()}
        className={`${styles.dropzone} ${
          isDragActive ? styles.active : ""
        } ${uploadSuccess ? styles.success : ""} ${
          uploadError ? styles.error : ""
        }`}
      >
        <input {...getInputProps()} />
        {isUploading ? (
          <div className={styles.uploading}>
            <div className={styles.spinner}></div>
            <p>Uploading...</p>
          </div>
        ) : uploadSuccess ? (
          <div className={styles.successContent}>
            <FiCheck className={styles.icon} />
            <p>File uploaded successfully!</p>
          </div>
        ) : (
          <div className={styles.dropzoneContent}>
            <FiUpload className={styles.icon} />
            <p className={styles.dropzoneText}>
              {isDragActive
                ? "Drop the file here..."
                : "Drag & drop a WhatsApp chat export file here, or click to select"}
            </p>
            <p className={styles.smallText}>
              Supported formats: {acceptedFormats.join(", ")} (max {maxSizeMB}
              MB)
            </p>
          </div>
        )}
      </div>
      {uploadError && (
        <div className={styles.errorMessage}>
          <FiX className={styles.errorIcon} />
          <span>{uploadError}</span>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
