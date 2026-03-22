import { useState, useRef } from "react";
import { useSession } from "../contexts/SessionContext.jsx";

function CameraCapture({ onUploadSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const { deviceId } = useSession();

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setError("File size exceeds 10MB limit.");
      return;
    }

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/heic"];
    if (!allowedTypes.includes(file.type)) {
      setError("Invalid file type. Only JPEG, PNG, and HEIC are allowed.");
      return;
    }

    setError(null);
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError("No file selected for upload.");
      return;
    }
    if (!deviceId) {
      setError("Session not initialized. Please refresh the page.");
      return;
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("device_id", deviceId);

      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Upload failed");
      }

      const data = await response.json();

      if (onUploadSuccess) {
        onUploadSuccess(data.scan_id);
      }

      setSelectedFile(null);
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  const handleChooseFile = () => {
    fileInputRef.current?.click();
  };

  const handleClear = () => {
    setSelectedFile(null);
    setPreview(null);
    setError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  return (
    <div className="w-full">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg, image/jpg, image/png, image/heic"
        onChange={handleFileSelect}
        className="hidden"
        capture="environment"
      />

      <div className="border border-dashed border-border hover:border-border-accent transition-colors duration-300 rounded-xl p-8 bg-bg-surface/30">
        {preview ? (
          <div className="space-y-5">
            <img
              src={preview}
              alt="Preview"
              className="max-h-96 mx-auto rounded-lg ring-1 ring-border"
            />
            <div className="flex justify-center gap-3">
              <button
                onClick={handleClear}
                disabled={uploading}
                className="px-5 py-2.5 bg-bg-surface text-text-secondary border border-border hover:border-border-accent hover:text-text-primary rounded-lg transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium"
              >
                Choose Different
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="px-6 py-2.5 bg-accent text-white rounded-lg hover:bg-accent-hover font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed text-sm shadow-sm"
              >
                {uploading ? "Uploading..." : "Upload & Scan"}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center space-y-4">
            <div className="mx-auto w-12 h-12 rounded-full bg-bg-surface flex items-center justify-center">
              <svg className="w-6 h-6 text-text-muted" stroke="currentColor" fill="none" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
            </div>
            <div>
              <button
                onClick={handleChooseFile}
                disabled={uploading}
                className="px-7 py-3 bg-accent text-white rounded-lg hover:bg-accent-hover font-medium transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
              >
                Take Photo or Choose from Library
              </button>
            </div>
            <p className="text-xs text-text-muted">JPEG, PNG or HEIC · Up to 10 MB</p>
          </div>
        )}
      </div>

      {error && !uploading && (
        <div className="mt-4 p-4 bg-danger-muted border border-danger/30 rounded-lg">
          <p className="text-danger text-sm">{error}</p>
        </div>
      )}

      {selectedFile && !uploading && (
        <div className="mt-3 text-xs text-text-muted">
          {selectedFile.name} · {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
        </div>
      )}
    </div>
  );
}

export default CameraCapture;
