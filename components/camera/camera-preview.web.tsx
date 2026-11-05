import { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";

import { detectLimeMarker } from "@/lib/vision/rotor-analysis";
import type { VisionFrame } from "@/lib/vision/rotor-analysis";

import { CameraGate } from "./camera-gate";
import type { CameraConnectionState } from "./camera-preview";

export function CameraPreview({
  active,
  onFrame,
  onCameraState,
  onCameraMessage,
}: {
  active: boolean;
  onFrame: (frame: VisionFrame) => void;
  onCameraState: (state: CameraConnectionState) => void;
  onCameraMessage: (message: string) => void;
}) {
  const hostRef = useRef<View>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [permissionStatus, setPermissionStatus] = useState<"idle" | "opening" | "denied" | "error">("idle");

  const requestCamera = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPermissionStatus("error");
      onCameraState("error");
      onCameraMessage("Bu tarayıcı güvenli bağlantıda kamera erişimini desteklemiyor.");
      return;
    }
    setPermissionStatus("opening");
    onCameraState("opening");
    onCameraMessage("");
    try {
      const nextStream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
      });
      setStream(nextStream);
      setPermissionStatus("idle");
    } catch (error) {
      const denied = error instanceof DOMException && (error.name === "NotAllowedError" || error.name === "SecurityError");
      setPermissionStatus(denied ? "denied" : "error");
      onCameraState(denied ? "denied" : "error");
      onCameraMessage(denied ? "Tarayıcı ayarlarından kamera iznini açıp yeniden deneyin." : "Kamera başlatılamadı; bağlantıyı ve başka uygulamaların kamerayı kullanmadığını kontrol edin.");
    }
  }, [onCameraMessage, onCameraState]);

  useEffect(() => {
    onCameraState(stream ? "opening" : permissionStatus === "denied" ? "denied" : permissionStatus === "error" ? "error" : "idle");
  }, [onCameraState, permissionStatus, stream]);

  useEffect(() => {
    if (!stream) return;
    const host = hostRef.current as unknown as HTMLDivElement | null;
    if (!host) return;

    const video = document.createElement("video");
    video.autoplay = true;
    video.muted = true;
    video.playsInline = true;
    video.style.position = "absolute";
    video.style.inset = "0";
    video.style.width = "100%";
    video.style.height = "100%";
    video.style.objectFit = "cover";
    video.style.background = "#111519";
    video.srcObject = stream;
    host.appendChild(video);

    let cancelled = false;
    let animationFrame = 0;
    let lastSampleAt = 0;
    const canvas = document.createElement("canvas");
    canvas.width = 160;
    canvas.height = 120;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    const onReady = () => {
      void video.play().then(() => {
        if (!cancelled) {
          onCameraState("ready");
          onCameraMessage("");
        }
      }).catch(() => {
        if (!cancelled) {
          onCameraState("error");
          onCameraMessage("Kamera önizlemesi oynatılamadı.");
        }
      });
    };
    video.addEventListener("loadedmetadata", onReady);
    if (video.readyState >= 2) onReady();

    const tick = (now: number) => {
      if (cancelled) return;
      if (active && context && video.readyState >= 2 && now - lastSampleAt > 150) {
        lastSampleAt = now;
        const videoWidth = video.videoWidth;
        const videoHeight = video.videoHeight;
        const box = host.getBoundingClientRect();
        const targetAspect = box.height > 0 ? box.width / box.height : videoWidth / videoHeight;
        const sourceAspect = videoWidth / videoHeight;
        let sourceX = 0;
        let sourceY = 0;
        let sourceWidth = videoWidth;
        let sourceHeight = videoHeight;
        if (sourceAspect > targetAspect) {
          sourceWidth = videoHeight * targetAspect;
          sourceX = (videoWidth - sourceWidth) / 2;
        } else if (sourceAspect < targetAspect) {
          sourceHeight = videoWidth / targetAspect;
          sourceY = (videoHeight - sourceHeight) / 2;
        }
        try {
          context.drawImage(video, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, canvas.width, canvas.height);
          const image = context.getImageData(0, 0, canvas.width, canvas.height);
          const detected = detectLimeMarker(image.data, canvas.width, canvas.height);
          const frame: VisionFrame = {
            capturedAt: Date.now(),
            marker: detected.marker,
            brightness: detected.brightness,
          };
          onFrame(frame);
        } catch {
          // Browsers can temporarily block canvas reads while a camera track initializes.
        }
      }
      animationFrame = requestAnimationFrame(tick);
    };
    animationFrame = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(animationFrame);
      video.removeEventListener("loadedmetadata", onReady);
      video.pause();
      video.srcObject = null;
      if (video.parentElement === host) host.removeChild(video);
    };
  }, [active, onCameraMessage, onCameraState, onFrame, stream]);

  useEffect(
    () => () => {
      stream?.getTracks().forEach((track) => track.stop());
    },
    [stream],
  );

  return (
    <View style={styles.fill}>
      <View ref={hostRef} style={styles.feed} />
      {!stream ? <CameraGate onRequest={requestCamera} status={permissionStatus} style={StyleSheet.absoluteFill} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, width: "100%", height: "100%", overflow: "hidden", backgroundColor: "#111519" },
  feed: { ...StyleSheet.absoluteFill, overflow: "hidden" },
});
