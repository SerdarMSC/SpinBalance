import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

export function CameraGate({
  onRequest,
  status,
  style,
}: {
  onRequest: () => void;
  status?: "idle" | "opening" | "denied" | "error";
  style?: StyleProp<ViewStyle>;
}) {
  const isOpening = status === "opening";
  const isDenied = status === "denied" || status === "error";

  return (
    <View style={[styles.container, style]}>
      <View style={styles.targetIcon}>
        <Ionicons name="scan-outline" size={31} color="#B6F23A" />
      </View>
      <Text style={styles.eyebrow}>KAMERA / OPTİK İZLEME</Text>
      <Text style={styles.title}>{isDenied ? "Kameraya erişilemiyor" : "Canlı görüntü için hazır"}</Text>
      <Text style={styles.description}>
        {isDenied
          ? "Tarayıcı veya telefon ayarlarından kamera iznini açıp yeniden deneyin."
          : "Rotoru güvenli mesafeden kadraja alın. Balans Bul yalnızca görüntüyü işler."}
      </Text>
      <Pressable
        accessibilityRole="button"
        onPress={onRequest}
        disabled={isOpening}
        style={({ pressed }) => [styles.button, pressed && !isOpening && styles.buttonPressed]}
      >
        <Ionicons name={isOpening ? "hourglass-outline" : "camera-outline"} size={17} color="#15191D" />
        <Text style={styles.buttonText}>{isOpening ? "KAMERA AÇILIYOR" : "KAMERAYI AÇ"}</Text>
      </Pressable>
      <Text style={styles.privacy}>Video kaydedilmez veya sunucuya gönderilmez.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    paddingVertical: 24,
    backgroundColor: "#171C21",
  },
  targetIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#465337",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#222A1D",
    marginBottom: 15,
  },
  eyebrow: {
    color: "#B6F23A",
    fontSize: 10,
    fontFamily: "BarlowCondensed_600SemiBold",
    letterSpacing: 2,
    marginBottom: 6,
  },
  title: {
    color: "#F2F5F7",
    fontSize: 21,
    fontFamily: "BarlowCondensed_700Bold",
    letterSpacing: 0.4,
    textAlign: "center",
  },
  description: {
    color: "#9AA4AE",
    fontSize: 12,
    lineHeight: 18,
    textAlign: "center",
    marginTop: 5,
    maxWidth: 270,
  },
  button: {
    height: 42,
    paddingHorizontal: 17,
    borderRadius: 12,
    backgroundColor: "#B6F23A",
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 17,
  },
  buttonPressed: { opacity: 0.76 },
  buttonText: {
    color: "#15191D",
    fontSize: 12,
    fontFamily: "BarlowCondensed_700Bold",
    letterSpacing: 1.1,
  },
  privacy: { color: "#68737E", fontSize: 10, marginTop: 12, textAlign: "center" },
});
