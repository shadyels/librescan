import {useNavigate} from "react-router-dom"
import CameraCapture from "../components/CameraCapture"

function Home() {
  const navigate = useNavigate();

  /**
   * Handle successful upload
   * Navigate to Results page with scanId
   */
  const handleUploadSuccess = (scanId) => {
    console.log("Upload successful, navigating to results::", scanId);
    navigate(`/results/${scanId}`);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-4xl font-bold text-gray-900 mb-4">
        Welcome to LibreScan
      </h1>
      <p className="text-gray-600">
        Scan your bookshelf and get AI-powered book recommendations tailored to
        your reading preferences.
      </p>

      <div className="bg-white rounded-lg shadow-md p-8">
        <h2 className="text-2xl font-semibold text-gray-800 mb-4">
          Get Started
        </h2>
        <p className="text-gray-600 mb-4">
          Take a photo of your bookshelf or upload an image to discover your
          next favorite book.
        </p>

        {/*  upload/scan functionality */}
        <CameraCapture onUploadSuccess={handleUploadSuccess} />
      </div>
    </div>
  );
}

export default Home;