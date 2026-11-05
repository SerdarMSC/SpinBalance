import { CameraView, useCameraPermissions } from "expo-camera";
import { toByteArray } from "base64-js";
import { decode } from "jpeg-js";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { detectLimeMarker, type VisionFrame } from "@/lib/vision/rotor-analysis";

import { CameraGate } from "./camera-gate";

export type CameraConnectionState = "idle" | "opening" | "ready" | "denied" | "error";

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
  const cameraRef = useRef<CameraView>(null);
  const readyRef = useRef(false);
  const sizeConfiguredRef = useRef(false);
  const permissionRequestedRef = useRef(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [pictureSize, setPictureSize] = useState<string | undefined>();
  const [permission, requestPermission] = useCameraPermissions();

  const reportReady = useCallback(async () => {
    if (!sizeConfiguredRef.current) {
      sizeConfiguredRef.current = true;
      try {
        const available = await cameraRef.current?.getAvailablePictureSizesAsync();
        const parsed = (available ?? []).flatMap((value) => {
          const match = /^(\d+)x(\d+)$/.exec(value);
          return match ? [{ value, width: Number(match[1]), height: Number(match[2]) }] : [];
        });
        const smallest = parsed.sort((a, b) => a.width * a.height - b.width * b.height)[0];
        const vgaOrSmaller = parsed
          .filter((size) => size.width <= 640 && size.height <= 480)
          .sort((a, b) => b.width * b.height - a.width * a.height)[0];
        const preferred = vgaOrSmaller ?? smallest;
        if (preferred) setPictureSize(preferred.value);
      } catch {
        // Not all devices expose supported picture sizes; keep their default camera mode.
      }
    }
    readyRef.current = true;
    setCameraReady(true);
    onCameraState("ready");
    onCameraMessage("");
  }, [onCameraMessage, onCameraState]);

  useEffect(() => {
    if (!permission) {
      onCameraState("opening");
    } else if (permission.granted) {
      permissionRequestedRef.current = false;
      onCameraState(cameraReady ? "ready" : "opening");
    } else {
      onCameraState(permissionRequestedRef.current ? "denied" : "idle");
    }
  }, [cameraReady, onCameraState, permission]);

  useEffect(() => {
    if (!active || !permission?.granted || !cameraReady) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let capturing = false;

    const capture = async () => {
      if (cancelled || capturing || !readyRef.current) return;
      capturing = true;
      try {
        const picture = await cameraRef.current?.takePictureAsync({ quality: 0.22, base64: true });
        if (picture?.base64 && !cancelled) {
          const image = decode(toByteArray(picture.base64), { useTArray: true });
          const detected = detectLimeMarker(image.data, image.width, image.height);
          const frame: VisionFrame = {
            capturedAt: Date.now(),
            marker: detected.marker,
            brightness: detected.brightness,
          };
          onFrame(frame);
        }
      } catch {
        // A camera can drop a sample while focusing; the next scheduled sample is still useful.
      } finally {
        capturing = false;
        if (!cancelled) timer = setTimeout(capture, 500);
      }
    };

    timer = setTimeout(capture, 200);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [active, cameraReady, onFrame, permission?.granted]);

  if (!permission?.granted) {
    return (
      <CameraGate
        onRequest={() => {
          permissionRequestedRef.current = true;
          onCameraState("opening");
          requestPermission().then((result) => {
            if (!result.granted) {
              onCameraState("denied");
              onCameraMessage("Kamera izni olmadan optik takip başlatılamaz.");
            }
          });
        }}
        status={permission?.canAskAgain === false ? "denied" : "idle"}
        style={styles.fill}
      />
    );
  }

  return (
    <View style={styles.fill}>
      <CameraView
        ref={cameraRef}
        style={styles.fill}
        facing="back"
        mode="picture"
        pictureSize={pictureSize}
        onCameraReady={reportReady}
        onMountError={(event) => {
          onCameraState("error");
          onCameraMessage(event.message || "Kamera açılamadı.");
        }}
      />
      {!cameraReady ? (
        <View pointerEvents="none" style={styles.opening}>
          <ActivityIndicator color="#B6F23A" />
          <Text style={styles.openingText}>KAMERA BAĞLANIYOR</Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { ...StyleSheet.absoluteFill, width: "100%", height: "100%" },
  opening: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "#171C21",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  openingText: { color: "#B6F23A", fontSize: 10, fontFamily: "BarlowCondensed_600SemiBold", letterSpacing: 2 },
});
