import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, Loader2, RefreshCw } from "lucide-react";

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [facingMode, setFacingMode] = useState("environment");

  const startCamera = (mode) => {
    setReady(false);
    setError(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    navigator.mediaDevices.getUserMedia({ video: { facingMode: mode }, audio: false })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setReady(true);
        }
      })
      .catch((err) => setError(err.message));
  };

  useEffect(() => {
    startCamera(facingMode);
    return () => { streamRef.current?.getTracks().forEach((t) => t.stop()); };
  }, []);

  const handleFlip = () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    startCamera(next);
  };

  const handleCapture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
      onCapture(file);
    }, "image/jpeg", 0.92);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center">
      <div className="bg-card rounded-xl overflow-hidden shadow-2xl flex flex-col max-w-lg w-full mx-4">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <p className="font-semibold text-sm">Camera</p>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-muted text-muted-foreground">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="relative bg-black aspect-video flex items-center justify-center">
          {error ? (
            <p className="text-white text-sm px-4 text-center">{error}</p>
          ) : (
            <>
              {!ready && <Loader2 className="w-6 h-6 animate-spin text-white absolute" />}
              <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            </>
          )}
        </div>
        <div className="px-4 py-3 flex items-center justify-center gap-3">
          <Button variant="outline" size="icon" onClick={handleFlip} disabled={!ready} title="Flip camera">
            <RefreshCw className="w-4 h-4" />
          </Button>
          <Button onClick={handleCapture} disabled={!ready} className="gap-2">
            <Camera className="w-4 h-4" /> Capture
          </Button>
        </div>
      </div>
    </div>
  );
}