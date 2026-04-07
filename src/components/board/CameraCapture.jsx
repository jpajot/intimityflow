import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Camera, X, Loader2, FlipHorizontal } from "lucide-react";

export default function CameraCapture({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(null);
  const [devices, setDevices] = useState([]); // list of video input devices
  const [deviceIndex, setDeviceIndex] = useState(0); // current device index

  // Enumerate cameras once on mount
  useEffect(() => {
    // Request permission first, then enumerate
    navigator.mediaDevices.getUserMedia({ video: true, audio: false })
      .then((tempStream) => {
        tempStream.getTracks().forEach((t) => t.stop());
        return navigator.mediaDevices.enumerateDevices();
      })
      .then((all) => {
        const videoDevices = all.filter((d) => d.kind === "videoinput");
        setDevices(videoDevices);
        // Try to default to rear camera (label contains "back" or "rear", or last device)
        const rearIdx = videoDevices.findIndex((d) =>
          /back|rear|environment/i.test(d.label)
        );
        setDeviceIndex(rearIdx >= 0 ? rearIdx : videoDevices.length - 1);
      })
      .catch((err) => setError(err.message));

    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  // Start stream whenever deviceIndex or devices change
  useEffect(() => {
    if (devices.length === 0) return;
    let cancelled = false;

    setReady(false);
    setError(null);
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    const deviceId = devices[deviceIndex]?.deviceId;
    const constraints = deviceId
      ? { video: { deviceId: { exact: deviceId } }, audio: false }
      : { video: true, audio: false };

    navigator.mediaDevices.getUserMedia(constraints)
      .then((stream) => {
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setReady(true);
        }
      })
      .catch((err) => { if (!cancelled) setError(err.message); });

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [devices, deviceIndex]);

  const handleFlip = () => {
    setDeviceIndex((prev) => (prev + 1) % devices.length);
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
          {devices.length > 1 && (
            <Button variant="outline" size="icon" onClick={handleFlip} disabled={!ready} title="Switch camera">
              <FlipHorizontal className="w-4 h-4" />
            </Button>
          )}
          <Button onClick={handleCapture} disabled={!ready} className="gap-2">
            <Camera className="w-4 h-4" /> Capture
          </Button>
        </div>
      </div>
    </div>
  );
}