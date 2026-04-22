import { useNavigate } from "react-router-dom";
import CameraCapture from "../components/CameraCapture";
import AuthPrompt from "../components/AuthPrompt";
import { useSession } from "../contexts/SessionContext";

function Home() {
  const navigate = useNavigate();
  const { deviceId } = useSession();

  const handleUploadSuccess = (scanId) => {
    const query = deviceId ? `?device_id=${deviceId}` : "";
    navigate(`/results/${scanId}${query}`);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <div className="pt-8 pb-10 md:pt-14 md:pb-12">
        <p className="text-text-muted text-xs font-medium tracking-widest uppercase mb-4">
          AI-Powered Discovery
        </p>
        <h1 className="font-display text-5xl md:text-7xl font-bold text-text-primary leading-[1.05] mb-6">
          Discover Your<br />
          <span className="text-accent">Next Great Read</span>
        </h1>
        <p className="text-text-secondary text-lg md:text-xl max-w-xl leading-relaxed">
          Photograph your bookshelf. Our AI identifies every spine and crafts
          personalized recommendations just for you.
        </p>
        <div className="w-14 h-px bg-accent mt-10 mb-12" />
      </div>

      <div className="glass-card p-8 md:p-10 mb-8">
        <h2 className="font-display text-2xl font-semibold text-text-primary mb-2">
          Scan Your Shelf
        </h2>
        <p className="text-text-secondary text-sm mb-8">
          Take a photo or upload an image — we'll do the rest.
        </p>
        <CameraCapture onUploadSuccess={handleUploadSuccess} />
      </div>

      <AuthPrompt />
    </div>
  );
}

export default Home;
