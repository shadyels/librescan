import { useState, useRef } from "react";
import { useSession } from "../contexts/SessionContext.jsx";

/**
 * Handles image upload from the smarthone camera
 */
function CameraCapture({ onUploadSuccess }) {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const { deviceId } = useSession();

  /**
   * Handle file selection
   * Validates file and creates preview
   */
  const handleFileSelect = (event) => {
    const file = event.target.files[0];

    if (!file) {
      return;
    }

    //Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      setError("File size exceeds 10MB limit.");
      return;
    }

    //Validate file type
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/heic"];
    if (!allowedTypes.includes(file.type)) {
      setError("Invalid file type. Only JPEG, PNG, and HEIC are allowed.");
      return;
    }

    // clear previous error
    setError(null);

    //store selected file
    setSelectedFile(file);

    //Create preview URL for display
    const previewUrl = URL.createObjectURL(file);
    setPreview(previewUrl);
  };

  /**
   * Upload file to backend
   * Send file as multipart/form-data
   */
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
      // Create form data for upload
      const formData = new FormData();
      formData.append("image", selectedFile);
      formData.append("device_id", deviceId); // TODO: Include device/session ID --> how does this work?

      // Send POST request to upload endpoint
      const response = await fetch("/api/upload-image", {
        method: "POST",
        body: formData,
        // Note: Do NOT set Content-Type header, browser sets it automatically with boundary
      });

      if (!response.ok) {
        throw new Error(result.error || "Upload failed");
      }

      const data = await response.json();
      console.log("Upload successful:", data);

      // Call parent callback with success data --> also describe this
      if (onUploadSuccess) {
        onUploadSuccess(data.scan_id);
      }

      //Clear form
      setSelectedFile(null);
      setPreview(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError(err.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  /**
   * Triger file input click
   */
  const handleChooseFile = () => {
    fileInputRef.current?.click(); // Programmatically click hidden file input --> opens file picker -> what happens ?
  };

  /**
   * Clear selected file and preview
   */
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
      {/* Hidden file input for capturing images */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg, image/jpg, image/png, image/heic"
        onChange={handleFileSelect}
        className="hidden"
        capture="environment" // Use back camera on mobile devices
      />

      {/* Upload area */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-8">
        {preview ? (
          // Show preview if file selected
          <div className="space-y-4">
            <img
              src={preview}
              alt="Preview"
              className="max-h-96 mx-auto rounded-lg"
            />
            <div className="flex justify-center space-x-4">
              <button
                onClick={handleClear}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
                disabled={uploading}
              >
                Choose Different Photo
              </button>
              <button
                onClick={handleUpload}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400"
                disabled={uploading}
              >
                {uploading ? "Uploading..." : "Upload & Scan"}{" "}
                {/* what is happening here? */}
              </button>
            </div>
          </div>
        ) : (
          // Show upload prompt if no file selected
          <div className="text-center space-y-4">
            <div className="text-gray-500">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                stroke="currentColor"
                fill="none"
                viewBox="0 0 48 48"
              >
                {/* SVG path for camera icon --> describe how to get it */}
                <path
                  d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <div>
              <button
                onClick={handleChooseFile}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                disabled={uploading}
              >
                Take Photo or Choose from Library
              </button>
            </div>
            <p className="text-sm text-gray-500">
              JPEG, PNG or HEIC. Up to 10MB.
            </p>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && !uploading && (
        <div className="mt-4 p-4 bg-red-50 border-red-200 rounded-lg">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      {/* File Info */}
      {selectedFile && !uploading && (
        <div className="mt-4 text-sm text-gray-600">
          <p>File: {selectedFile.name}</p>
          <p>Size: {(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
        </div>
      )}
    </div>
  );
}

export default CameraCapture;
