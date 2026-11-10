import { useNavigate } from "react-router-dom";
import CameraCapture from "../components/CameraCapture";
import { useSession } from "../contexts/SessionContext";

export default function Home() {
  const navigate = useNavigate();
  const { deviceId } = useSession();

  return (
    <CameraCapture
      onUploadSuccess={(scanId) => navigate(`/results/${scanId}${deviceId ? `?device_id=${deviceId}` : ""}`)}
    />
  );
}
