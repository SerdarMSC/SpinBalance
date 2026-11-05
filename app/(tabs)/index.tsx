import { BarlowCondensed_500Medium, BarlowCondensed_600SemiBold, BarlowCondensed_700Bold } from "@expo-google-fonts/barlow-condensed";
import { Ionicons } from "@expo/vector-icons";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type LayoutChangeEvent,
  type GestureResponderEvent,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { CameraPreview, type CameraConnectionState } from "@/components/camera/camera-preview";
import { estimateOrbit, type NormalizedPoint, type OrbitEstimate, type VisionFrame } from "@/lib/vision/rotor-analysis";

const LIME = "#B6F23A";
const MUTED = "#95A0AA";
const MINIMUM_SAMPLES = 14;

function formatAngle(radians: number) {
  return `${Math.round(((radians * 180) / Math.PI + 360) % 360)}°`;
}

function StatCell({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statValueRow}>
        <Text style={styles.statValue}>{value}</Text>
        {unit ? <Text style={styles.statUnit}>{unit}</Text> : null}
      </View>
    </View>
  );
}

function StepRow({ number, title, caption, complete }: { number: string; title: string; caption: string; complete?: boolean }) {
  return (
    <View style={styles.stepRow}>
      <View style={[styles.stepNumber, complete && styles.stepNumberComplete]}>
        {complete ? <Ionicons name="checkmark" size={14} color="#15191D" /> : <Text style={styles.stepNumberText}>{number}</Text>}
      </View>
      <View style={styles.stepCopy}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepCaption}>{caption}</Text>
      </View>
    </View>
  );
}

export default function HomeScreen() {
  useFonts({
    BarlowCondensed_500Medium,
    BarlowCondensed_600SemiBold,
    BarlowCondensed_700Bold,
  });
  const [cameraState, setCameraState] = useState<CameraConnectionState>("idle");
  const [cameraMessage, setCameraMessage] = useState("");
  const [calibrationMode, setCalibrationMode] = useState(false);
  const [center, setCenter] = useState<NormalizedPoint | null>(null);
  const [previewSize, setPreviewSize] = useState({ width: 1, height: 1 });
  const [rotorDiameter, setRotorDiameter] = useState("");
  const [isMeasuring, setIsMeasuring] = useState(false);
  const isMeasuringRef = useRef(false);
  const [elapsed, setElapsed] = useState(0);
  const [samples, setSamples] = useState<VisionFrame[]>([]);
  const [latestFrame, setLatestFrame] = useState<VisionFrame | null>(null);
  const [result, setResult] = useState<OrbitEstimate | null>(null);
  const [notice, setNotice] = useState("");
  const stopRef = useRef<() => void>(() => undefined);
  const [pulse] = useState(() => new Animated.Value(0.45));

  const previewAspect = previewSize.width / previewSize.height;
  const cameraReady = cameraState === "ready";
  const latestEstimate = useMemo(
    () => (center ? estimateOrbit(samples, center, previewAspect) : null),
    [center, previewAspect, samples],
  );

  useEffect(() => {
    if (!isMeasuring) {
      pulse.stopAnimation();
      pulse.setValue(0.45);
      return;
    }
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 560, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.45, duration: 560, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [isMeasuring, pulse]);

  useEffect(() => {
    if (!isMeasuring) return;
    const timer = setInterval(() => setElapsed((current) => current + 1), 1000);
    return () => clearInterval(timer);
  }, [isMeasuring]);

  const handleCameraState = useCallback((state: CameraConnectionState) => setCameraState(state), []);
  const handleCameraMessage = useCallback((message: string) => setCameraMessage(message), []);
  const handleFrame = useCallback((frame: VisionFrame) => {
    setLatestFrame(frame);
    if (isMeasuringRef.current && frame.marker) {
      setSamples((current) => [...current.slice(-(MINIMUM_SAMPLES * 5)), frame]);
    }
  }, []);

  const stopMeasurement = useCallback(() => {
    if (!isMeasuringRef.current) return;
    isMeasuringRef.current = false;
    setIsMeasuring(false);
    const estimate = center ? estimateOrbit(samples, center, previewAspect) : null;
    if (!estimate || !estimate.canReport) {
      setResult(null);
      if ((estimate?.sampleCount ?? 0) < MINIMUM_SAMPLES) {
        setNotice("Yeterli referans örneği yok. Yeşil işaret kadrajda kalacak şekilde tekrar deneyin.");
      } else {
        setNotice("İşaret henüz yeterli dönüş açısı çizmedi. Rotoru daha uzun süre izleyip yeniden deneyin.");
      }
      return;
    }
    setResult(estimate);
    setNotice("Optik tarama tamamlandı · tahmini kaçıklık yönü işaretlendi.");
  }, [center, previewAspect, samples]);

  useEffect(() => {
    stopRef.current = stopMeasurement;
  }, [stopMeasurement]);

  useEffect(() => {
    if (!isMeasuring) return;
    const timeout = setTimeout(() => stopRef.current(), 18_000);
    return () => clearTimeout(timeout);
  }, [isMeasuring]);

  const warning = useMemo(() => {
    if (!isMeasuring) return null;
    if (!latestFrame) return { title: "Referans bekleniyor", body: "Flüoresan yeşil işareti kameranın görebileceği şekilde kadraja alın.", tone: "amber" as const };
    if (latestFrame.brightness < 47) return { title: "Işık yetersiz", body: "İşareti aydınlatın; kamerayı flaşa çok yaklaştırmayın.", tone: "amber" as const };
    if (!latestFrame.marker) return { title: "İşaret kadrajda değil", body: "Yeşil referans etiketini görüntünün ortasına yaklaştırın.", tone: "amber" as const };
    if (center) {
      const dx = (latestFrame.marker.x - center.x) * previewAspect;
      const dy = latestFrame.marker.y - center.y;
      const radius = Math.hypot(dx, dy);
      if (radius < 0.055 || radius > 0.55) {
        return { title: "Kadrajı yeniden hizalayın", body: "Mil merkezi ile dönen yeşil işaretin ikisi de görünür alanda olmalı.", tone: "amber" as const };
      }
    }
    if ((latestEstimate?.noiseRatio ?? 0) > 0.22) {
      return { title: "Örnekler kararsız", body: "İşaret yörüngesindeki ölçüm saçılımı yüksek; telefonu sabitleyin ve etiketi net tutun.", tone: "red" as const };
    }
    return { title: "Takip kararlı", body: "İşaret izleniyor. Dönüşü tamamlayana kadar kamerayı sabit tutun.", tone: "green" as const };
  }, [center, isMeasuring, latestEstimate, latestFrame, previewAspect]);

  const startMeasurement = useCallback(() => {
    if (!cameraReady) {
      setNotice(cameraMessage || "Önce kamera erişimini açın ve canlı görüntünün hazır olmasını bekleyin.");
      return;
    }
    if (!center) {
      setNotice("Önce kadraj üzerindeki mil merkezini işaretleyin.");
      setCalibrationMode(true);
      return;
    }
    setSamples([]);
    setResult(null);
    setNotice("Yeşil referans işareti aranıyor…");
    setElapsed(0);
    isMeasuringRef.current = true;
    setIsMeasuring(true);
  }, [cameraMessage, cameraReady, center]);

  const restartMeasurement = useCallback(() => {
    isMeasuringRef.current = false;
    setIsMeasuring(false);
    setSamples([]);
    setResult(null);
    setElapsed(0);
    setNotice("Yeni ölçüm için hazır. İşaretli referans parçanın üzerinde kalmalı.");
  }, []);

  const handlePreviewLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setPreviewSize({ width: Math.max(1, width), height: Math.max(1, height) });
  }, []);

  const handleCalibrationTap = useCallback((event: GestureResponderEvent) => {
    if (!calibrationMode || previewSize.width <= 1 || previewSize.height <= 1) return;
    const x = Math.max(0.04, Math.min(0.96, event.nativeEvent.locationX / previewSize.width));
    const y = Math.max(0.04, Math.min(0.96, event.nativeEvent.locationY / previewSize.height));
    setCenter({ x, y });
    setCalibrationMode(false);
    setNotice("Mil merkezi kaydedildi. Biliniyorsa rotor çapını girin.");
  }, [calibrationMode, previewSize.height, previewSize.width]);

  const deviationMarker = useMemo(() => {
    if (!result || !center || result.deviationAngleRadians === null) return null;
    const radius = Math.min(0.48, Math.max(0.06, result.meanRadius));
    return {
      x: Math.max(0.07, Math.min(0.93, center.x + (Math.cos(result.deviationAngleRadians) * radius) / Math.max(0.7, previewAspect))),
      y: Math.max(0.09, Math.min(0.91, center.y + Math.sin(result.deviationAngleRadians) * radius)),
    };
  }, [center, previewAspect, result]);

  const diameterMm = Number.parseFloat(rotorDiameter.replace(",", "."));
  const runoutMm = result && Number.isFinite(diameterMm) && diameterMm > 0
    ? ((result.runoutFraction * diameterMm) / 2).toFixed(2)
    : null;
  const marker = latestFrame?.marker ?? null;

  return (
    <SafeAreaView style={styles.safeArea} edges={["top", "bottom"]}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <View style={styles.brandMark}>
              <Ionicons name="scan-outline" size={21} color={LIME} />
            </View>
            <View style={styles.brandTextWrap}>
              <Text style={styles.brandText}>BALANS<Text style={styles.brandTextAccent}> / BUL</Text></Text>
              <Text style={styles.brandCaption}>OPTİK SAHA ARACI · 01</Text>
            </View>
            <View style={styles.versionTag}><View style={styles.versionDot} /><Text style={styles.versionText}>BETA</Text></View>
          </View>

          <View style={styles.intro}>
            <Text style={styles.overline}>DÖNEN PARÇA ANALİZİ</Text>
            <Text style={styles.headline}>OPTİK<Text style={styles.headlineAccent}> KAÇIKLIK</Text></Text>
            <Text style={styles.introCopy}>Mil eksenini işaretle; referansın görünür kaçıklık yönünü ve göreli şiddetini izle.</Text>
          </View>

          <View style={styles.cameraCard}>
            <View style={styles.cameraHeader}>
              <View style={styles.cameraHeaderLeft}>
                <Ionicons name="aperture-outline" size={16} color={LIME} />
                <Text style={styles.cameraHeaderTitle}>CANLI KAMERA</Text>
              </View>
              <View style={[styles.liveTag, isMeasuring && styles.liveTagActive]}>
                {isMeasuring ? <Animated.View style={[styles.liveDot, { opacity: pulse }]} /> : <View style={styles.liveDotIdle} />}
                <Text style={[styles.liveTagText, isMeasuring && styles.liveTagTextActive]}>{isMeasuring ? "TAKİPTE" : cameraReady ? "HAZIR" : "BEKLEMEDE"}</Text>
              </View>
            </View>

            <View style={styles.cameraStage} onLayout={handlePreviewLayout}>
              <CameraPreview
                active={isMeasuring}
                onFrame={handleFrame}
                onCameraState={handleCameraState}
                onCameraMessage={handleCameraMessage}
              />
              <View pointerEvents="none" style={styles.overlay}>
                <View style={styles.cornerTopLeft} />
                <View style={styles.cornerTopRight} />
                <View style={styles.cornerBottomLeft} />
                <View style={styles.cornerBottomRight} />
                {center ? (
                  <View style={[styles.crosshair, { left: `${center.x * 100}%`, top: `${center.y * 100}%` }]}>
                    <View style={styles.crosshairH} /><View style={styles.crosshairV} />
                    <View style={styles.crosshairRing} />
                  </View>
                ) : (
                  <View style={[styles.centerHint, { left: "50%", top: "50%" }]}>
                    <Ionicons name="locate-outline" size={30} color="rgba(230,237,241,0.62)" />
                  </View>
                )}
                {isMeasuring && marker ? (
                  <View style={[styles.markerDot, { left: `${marker.x * 100}%`, top: `${marker.y * 100}%` }]}>
                    <View style={styles.markerDotCore} />
                  </View>
                ) : null}
                {deviationMarker ? (
                  <View style={[styles.deviationTarget, { left: `${deviationMarker.x * 100}%`, top: `${deviationMarker.y * 100}%` }]}>
                    <View style={styles.deviationTargetRing}><View style={styles.deviationTargetCore} /></View>
                    <Text style={styles.deviationLabel}>GÖRÜNÜR SAPMA</Text>
                  </View>
                ) : null}
                {isMeasuring ? <View style={styles.scanLine} /> : null}
              </View>
              {calibrationMode ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Mil merkezini kamera görüntüsünde işaretle" style={styles.calibrationTouch} onPress={handleCalibrationTap}>
                  <View pointerEvents="none" style={styles.calibrationHint}>
                    <Ionicons name="locate" size={16} color={LIME} />
                    <Text style={styles.calibrationHintText}>MİL MERKEZİNE DOKUNUN</Text>
                  </View>
                </Pressable>
              ) : null}
              <View pointerEvents="none" style={styles.frameCounter}>
                <Text style={styles.frameCounterText}>{isMeasuring ? `${String(samples.length).padStart(2, "0")} ÖRNEK` : "4:3 / OTOMATİK"}</Text>
              </View>
            </View>

            <View style={styles.cameraFooter}>
              <View style={styles.cameraFooterIcon}><Ionicons name={calibrationMode ? "locate" : "move-outline"} size={15} color={calibrationMode ? LIME : MUTED} /></View>
              <Text style={styles.cameraFooterText}>
                {calibrationMode ? "Dönen parçanın mil merkezine dokunun." : center ? "Eksen kalibre edildi · kamera kadrajı sabit tutun." : "Ölçümden önce mil merkezini görüntü üzerinde kalibre edin."}
              </Text>
            </View>
          </View>

          {cameraMessage ? (
            <View style={styles.cameraMessage}><Ionicons name="information-circle-outline" size={16} color="#FFC857" /><Text style={styles.cameraMessageText}>{cameraMessage}</Text></View>
          ) : null}

          <View style={styles.calibrationCard}>
            <View style={styles.sectionHeadingRow}>
              <View>
                <Text style={styles.sectionOverline}>01 / HAZIRLIK</Text>
                <Text style={styles.sectionTitle}>Ölçümü kalibre et</Text>
              </View>
              <View style={[styles.calibrationStatus, center && styles.calibrationStatusComplete]}>
                <Ionicons name={center ? "checkmark-circle" : "ellipse-outline"} size={14} color={center ? LIME : "#76818C"} />
                <Text style={[styles.calibrationStatusText, center && styles.calibrationStatusTextComplete]}>{center ? "EKSEN KAYITLI" : "KALİBRASYON"}</Text>
              </View>
            </View>

            <View style={styles.steps}>
              <StepRow number="01" title="Rotoru kadraja alın" caption="Dönen yüzeyin ve mil merkezinin tamamı görünür olsun." complete={cameraReady} />
              <StepRow number="02" title="Yeşil referans ekleyin" caption="Hareketli parçaya küçük, mat ve yüksek kontrastlı lime etiket koyun." complete={Boolean(latestFrame?.marker)} />
              <StepRow number="03" title="Mil merkezini işaretleyin" caption="Kamera görüntüsünde dönüş eksenine dokunun." complete={Boolean(center)} />
            </View>

            <Pressable
              accessibilityRole="button"
              onPress={() => {
                if (!cameraReady) {
                  setNotice("Önce kamera iznini verin ve canlı önizlemenin açılmasını bekleyin.");
                  return;
                }
                setCalibrationMode((current) => !current);
                setNotice("Kamera görüntüsünde dönüş milinin merkezine dokunun.");
              }}
              style={({ pressed }) => [styles.calibrateButton, calibrationMode && styles.calibrateButtonActive, pressed && styles.pressed]}
            >
              <Ionicons name={calibrationMode ? "close" : "locate-outline"} size={17} color={LIME} />
              <Text style={styles.calibrateButtonText}>{calibrationMode ? "KALİBRASYONU İPTAL ET" : center ? "MERKEZİ YENİDEN İŞARETLE" : "MİL MERKEZİNİ İŞARETLE"}</Text>
              <Ionicons name="arrow-forward" size={15} color="#77838E" />
            </Pressable>

            <View style={styles.diameterRow}>
              <View style={styles.diameterCopy}>
                <Text style={styles.diameterLabel}>ROTOR ÇAPI <Text style={styles.optional}>(İSTEĞE BAĞLI)</Text></Text>
                <Text style={styles.diameterHint}>Mutlak kaçıklık tahmini için bilinen çapı girin.</Text>
              </View>
              <View style={styles.diameterInputWrap}>
                <TextInput
                  accessibilityLabel="Rotor çapı milimetre"
                  value={rotorDiameter}
                  onChangeText={setRotorDiameter}
                  keyboardType={Platform.OS === "web" ? "decimal-pad" : "decimal-pad"}
                  placeholder="120"
                  placeholderTextColor="#69747F"
                  maxLength={6}
                  style={styles.diameterInput}
                />
                <Text style={styles.diameterUnit}>mm</Text>
              </View>
            </View>
          </View>

          {warning ? (
            <View style={[styles.warningCard, warning.tone === "red" ? styles.warningRed : warning.tone === "green" ? styles.warningGreen : styles.warningAmber]}>
              <View style={styles.warningIcon}>
                <Ionicons name={warning.tone === "green" ? "checkmark-circle-outline" : warning.tone === "red" ? "warning-outline" : "sunny-outline"} size={18} color={warning.tone === "green" ? LIME : warning.tone === "red" ? "#FF7D73" : "#FFC857"} />
              </View>
              <View style={styles.warningCopy}>
                <Text style={styles.warningTitle}>{isMeasuring ? warning.title : "Ölçüm öncesi güvenlik"}</Text>
                <Text style={styles.warningBody}>{isMeasuring ? warning.body : "Koruyucu muhafazayı kapatın. Dönen parçaya, etikete veya şaft alanına yaklaşmayın."}</Text>
              </View>
            </View>
          ) : null}

          <View style={styles.measurePanel}>
            <View style={styles.measureHead}>
              <View>
                <Text style={styles.sectionOverline}>02 / TARAMA</Text>
                <Text style={styles.sectionTitle}>{isMeasuring ? "Dönüş izleniyor" : result ? "Tarama tamamlandı" : "Optik takip"}</Text>
              </View>
              {isMeasuring ? (
                <View style={styles.elapsedPill}><View style={styles.elapsedDot} /><Text style={styles.elapsedText}>{String(elapsed).padStart(2, "0")}s / 18s</Text></View>
              ) : result ? <Text style={styles.resultConfidence}>ÖRNEK KAPSAMI {result.coverageScore}/100</Text> : null}
            </View>

            {result ? (
              <View style={styles.resultCard}>
                <View style={styles.resultTopline}>
                  <View style={styles.resultIcon}><Ionicons name="compass-outline" size={20} color={LIME} /></View>
                  <View style={styles.resultDirectionWrap}>
                    <Text style={styles.resultOverline}>TAHMİNİ GÖRSEL SAPMA YÖNÜ</Text>
                    <Text style={styles.resultDirection}>{result.deviationAngleRadians === null ? "BELİRGİN SAPMA YOK" : formatAngle(result.deviationAngleRadians)} <Text style={styles.resultDirectionSuffix}>· kamera düzlemi</Text></Text>
                  </View>
                  <View style={styles.severityBadge}><Text style={styles.severityLabel}>GÖRSEL İNDEKS</Text><View style={styles.severityValueRow}><Text style={styles.severityNumber}>{result.severity}</Text><Text style={styles.severityUnit}>/100</Text></View></View>
                </View>
                <View style={styles.resultDivider} />
                <View style={styles.resultMetrics}>
                  <StatCell label="GÖRSEL KAÇIKLIK" value={runoutMm ?? `${(result.runoutFraction * 100).toFixed(1)}`} unit={runoutMm ? "mm*" : "%"} />
                  <View style={styles.statDivider} />
                  <StatCell label="İZLENEN ÖRNEK" value={String(result.sampleCount)} unit="kare" />
                  <View style={styles.statDivider} />
                  <StatCell label="AÇISAL KAPSAM" value={String(Math.round((result.coverageRadians * 180) / Math.PI))} unit="°" />
                </View>
                <Text style={styles.resultDisclaimer}>Yalnızca işaret yörüngesindeki görünür radyal değişim gösterilir; gerçek ağır tarafı, kütleyi veya eklenecek ağırlık yönünü belirlemez. Girilen çapla hesaplanan *mm değeri perspektif kalibrasyonu olmayan kaba bir kestirimdir.</Text>
              </View>
            ) : (
              <View style={styles.measureInfo}>
                <View style={styles.measureInfoIcon}><Ionicons name="analytics-outline" size={19} color={LIME} /></View>
                <Text style={styles.measureInfoText}>
                  {isMeasuring
                    ? `${samples.length} görünür örnek toplandı. Dönüşün geniş bir açısını izleyin.`
                    : Platform.OS === "web"
                      ? "Tarayıcı yaklaşık 6 kare/sn örnekler; görüntü cihazda işlenir. Yüksek devirli rotorlar için uygun değildir."
                      : "Telefon kamerası yaklaşık 2 kare/sn örnekler. Yalnızca yavaş dönüşler için; yüksek devirde güvenilir değildir."}
                </Text>
              </View>
            )}

            {notice ? <Text style={styles.noticeText}>{notice}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={!isMeasuring && !result && (!cameraReady || !center)}
              accessibilityState={{ disabled: !isMeasuring && !result && (!cameraReady || !center) }}
              onPress={isMeasuring ? stopMeasurement : result ? restartMeasurement : startMeasurement}
              style={({ pressed }) => [
                styles.primaryButton,
                !isMeasuring && !result && (!cameraReady || !center) && styles.primaryButtonDisabled,
                isMeasuring && styles.stopButton,
                pressed && styles.pressed,
              ]}
            >
              {isMeasuring ? (
                <Ionicons name="stop" size={17} color="#FFF" />
              ) : result ? (
                <Ionicons name="refresh" size={18} color="#15191D" />
              ) : (
                <Ionicons name="scan" size={18} color="#15191D" />
              )}
              <Text style={[styles.primaryButtonText, isMeasuring && styles.stopButtonText]}>
                {isMeasuring ? "ÖLÇÜMÜ BİTİR" : result ? "YENİ ÖLÇÜM BAŞLAT" : "ÖLÇÜMÜ BAŞLAT"}
              </Text>
              {!isMeasuring && !result ? <Ionicons name="arrow-forward" size={17} color="#15191D" /> : null}
            </Pressable>
            {result ? (
              <Pressable accessibilityRole="button" onPress={restartMeasurement} style={styles.secondaryAction}>
                <Ionicons name="refresh-outline" size={15} color={MUTED} /><Text style={styles.secondaryActionText}>Sonucu temizle ve tekrar kalibre et</Text>
              </Pressable>
            ) : null}
          </View>

          <View style={styles.footnote}>
            <Ionicons name="shield-checkmark-outline" size={14} color="#717D87" />
            <Text style={styles.footnoteText}>Görüntü cihazda işlenir · Kayıt veya yükleme yapılmaz</Text>
          </View>
          <View style={styles.disclaimer}>
            <Text style={styles.disclaimerTitle}>ÖNEMLİ SINIR</Text>
            <Text style={styles.disclaimerText}>Tek kamera, yalnızca görünür yüzey hareketini değerlendirir; malzemenin gizli kütle dağılımını belirleyemez. Endüstriyel balans, yüksek devir veya iş güvenliği kararları için kalibre edilmiş balans cihazı kullanın.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  safeArea: { flex: 1, backgroundColor: "#111519" },
  scrollContent: { width: "100%", maxWidth: 600, alignSelf: "center", paddingHorizontal: 18, paddingTop: 8, paddingBottom: 38 },
  header: { height: 50, flexDirection: "row", alignItems: "center", marginBottom: 16 },
  brandMark: { width: 38, height: 38, borderRadius: 13, borderWidth: 1, borderColor: "#3A4730", backgroundColor: "#20271D", alignItems: "center", justifyContent: "center" },
  brandTextWrap: { marginLeft: 10 },
  brandText: { color: "#F1F4F6", fontFamily: "BarlowCondensed_700Bold", fontSize: 20, letterSpacing: 1.2 },
  brandTextAccent: { color: LIME },
  brandCaption: { color: "#73808A", fontFamily: "BarlowCondensed_500Medium", fontSize: 9, letterSpacing: 1.3, marginTop: -1 },
  versionTag: { marginLeft: "auto", height: 25, paddingHorizontal: 9, borderRadius: 20, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "#1B2025", borderWidth: 1, borderColor: "#2B3239" },
  versionDot: { width: 5, height: 5, borderRadius: 4, backgroundColor: LIME },
  versionText: { color: "#ADB6BE", fontFamily: "BarlowCondensed_700Bold", fontSize: 10, letterSpacing: 1.2 },
  intro: { marginBottom: 15 },
  overline: { color: LIME, fontFamily: "BarlowCondensed_600SemiBold", fontSize: 11, letterSpacing: 2.1, marginBottom: 1 },
  headline: { color: "#F2F5F7", fontFamily: "BarlowCondensed_700Bold", fontSize: 35, letterSpacing: 0.45, lineHeight: 39 },
  headlineAccent: { color: LIME },
  introCopy: { color: "#96A1AA", fontSize: 12, lineHeight: 18, marginTop: 3 },
  cameraCard: { overflow: "hidden", borderRadius: 19, borderWidth: 1, borderColor: "#343D45", backgroundColor: "#171C21", marginBottom: 14 },
  cameraHeader: { height: 43, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: "#191F24" },
  cameraHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  cameraHeaderTitle: { color: "#DCE2E6", fontFamily: "BarlowCondensed_600SemiBold", fontSize: 12, letterSpacing: 1.2 },
  liveTag: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 5, paddingHorizontal: 8, borderRadius: 8, backgroundColor: "#252C32" },
  liveTagActive: { backgroundColor: "#28331D" },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: LIME },
  liveDotIdle: { width: 6, height: 6, borderRadius: 3, backgroundColor: "#77818A" },
  liveTagText: { color: "#A7B0B8", fontFamily: "BarlowCondensed_700Bold", fontSize: 10, letterSpacing: 1 },
  liveTagTextActive: { color: LIME },
  cameraStage: { height: 268, position: "relative", overflow: "hidden", backgroundColor: "#111519" },
  overlay: { ...StyleSheet.absoluteFill, overflow: "hidden" },
  cornerTopLeft: { position: "absolute", top: 11, left: 11, width: 17, height: 17, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderColor: "rgba(182,242,58,0.75)" },
  cornerTopRight: { position: "absolute", top: 11, right: 11, width: 17, height: 17, borderTopWidth: 1.5, borderRightWidth: 1.5, borderColor: "rgba(182,242,58,0.75)" },
  cornerBottomLeft: { position: "absolute", bottom: 11, left: 11, width: 17, height: 17, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderColor: "rgba(182,242,58,0.75)" },
  cornerBottomRight: { position: "absolute", bottom: 11, right: 11, width: 17, height: 17, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderColor: "rgba(182,242,58,0.75)" },
  crosshair: { position: "absolute", width: 38, height: 38, marginLeft: -19, marginTop: -19, alignItems: "center", justifyContent: "center" },
  crosshairH: { position: "absolute", width: 38, height: 1, backgroundColor: "rgba(182,242,58,0.86)" },
  crosshairV: { position: "absolute", width: 1, height: 38, backgroundColor: "rgba(182,242,58,0.86)" },
  crosshairRing: { width: 18, height: 18, borderWidth: 1.5, borderColor: LIME, borderRadius: 10, backgroundColor: "rgba(18,22,25,0.62)" },
  centerHint: { position: "absolute", width: 38, height: 38, marginLeft: -19, marginTop: -19, alignItems: "center", justifyContent: "center" },
  markerDot: { position: "absolute", width: 18, height: 18, marginLeft: -9, marginTop: -9, borderRadius: 12, borderWidth: 2, borderColor: LIME, alignItems: "center", justifyContent: "center", shadowColor: LIME, shadowOpacity: 0.8, shadowRadius: 7, elevation: 5 },
  markerDotCore: { width: 5, height: 5, borderRadius: 3, backgroundColor: LIME },
  deviationTarget: { position: "absolute", width: 28, height: 28, marginLeft: -14, marginTop: -14, alignItems: "center", justifyContent: "center" },
  deviationTargetRing: { width: 20, height: 20, borderRadius: 11, borderWidth: 1.5, borderColor: LIME, backgroundColor: "rgba(17,21,25,0.78)", alignItems: "center", justifyContent: "center" },
  deviationTargetCore: { width: 5, height: 5, borderRadius: 3, backgroundColor: LIME },
  deviationLabel: { position: "absolute", top: 23, width: 100, textAlign: "center", color: LIME, fontFamily: "BarlowCondensed_600SemiBold", fontSize: 8, letterSpacing: 0.9 },
  scanLine: { position: "absolute", left: 15, right: 15, top: "52%", height: 1, backgroundColor: "rgba(182,242,58,0.35)" },
  calibrationTouch: { ...StyleSheet.absoluteFill, zIndex: 10, alignItems: "center", justifyContent: "flex-end", paddingBottom: 16 },
  calibrationHint: { height: 32, paddingHorizontal: 11, borderRadius: 9, backgroundColor: "rgba(18,22,25,0.88)", borderWidth: 1, borderColor: "rgba(182,242,58,0.5)", flexDirection: "row", alignItems: "center", gap: 6 },
  calibrationHintText: { color: "#EAF2DE", fontFamily: "BarlowCondensed_700Bold", fontSize: 10, letterSpacing: 1 },
  frameCounter: { position: "absolute", left: 17, bottom: 16, paddingVertical: 5, paddingHorizontal: 7, borderRadius: 6, backgroundColor: "rgba(17,21,25,0.76)" },
  frameCounterText: { color: "#D5DCE1", fontFamily: "BarlowCondensed_600SemiBold", fontSize: 9, letterSpacing: 1 },
  cameraFooter: { minHeight: 39, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#191F24" },
  cameraFooterIcon: { width: 22, alignItems: "center" },
  cameraFooterText: { flex: 1, color: "#909BA5", fontSize: 10, lineHeight: 15 },
  cameraMessage: { flexDirection: "row", alignItems: "flex-start", gap: 8, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 11, backgroundColor: "#2A261B", borderWidth: 1, borderColor: "#4B4024" },
  cameraMessageText: { flex: 1, color: "#E7D3A4", fontSize: 11, lineHeight: 16 },
  calibrationCard: { padding: 15, borderRadius: 18, backgroundColor: "#191F24", borderWidth: 1, borderColor: "#303941", marginBottom: 12 },
  sectionHeadingRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionOverline: { color: "#82909A", fontFamily: "BarlowCondensed_600SemiBold", fontSize: 9, letterSpacing: 1.7, marginBottom: 1 },
  sectionTitle: { color: "#F1F4F5", fontFamily: "BarlowCondensed_700Bold", fontSize: 21, letterSpacing: 0.2 },
  calibrationStatus: { flexDirection: "row", alignItems: "center", gap: 5, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: "#232A30", borderRadius: 7 },
  calibrationStatusComplete: { backgroundColor: "#26311E" },
  calibrationStatusText: { color: "#9AA4AD", fontFamily: "BarlowCondensed_600SemiBold", fontSize: 9, letterSpacing: 0.8 },
  calibrationStatusTextComplete: { color: LIME },
  steps: { borderTopWidth: 1, borderTopColor: "#2A3239", paddingTop: 6, marginBottom: 11 },
  stepRow: { minHeight: 46, flexDirection: "row", alignItems: "center", gap: 10 },
  stepNumber: { width: 25, height: 25, borderRadius: 8, backgroundColor: "#252C32", borderWidth: 1, borderColor: "#343E46", alignItems: "center", justifyContent: "center" },
  stepNumberComplete: { borderColor: "#829E4F", backgroundColor: LIME },
  stepNumberText: { color: "#B9C1C7", fontFamily: "BarlowCondensed_700Bold", fontSize: 10 },
  stepCopy: { flex: 1 },
  stepTitle: { color: "#DCE2E6", fontSize: 11, fontFamily: "BarlowCondensed_600SemiBold", letterSpacing: 0.3 },
  stepCaption: { color: "#7D8993", fontSize: 10, lineHeight: 14, marginTop: 1 },
  calibrateButton: { height: 42, paddingHorizontal: 12, borderRadius: 11, backgroundColor: "#232A30", borderWidth: 1, borderColor: "#374148", flexDirection: "row", alignItems: "center", gap: 8 },
  calibrateButtonActive: { borderColor: "#779342", backgroundColor: "#252E1E" },
  calibrateButtonText: { flex: 1, color: "#DCE4D4", fontFamily: "BarlowCondensed_700Bold", fontSize: 11, letterSpacing: 0.8 },
  pressed: { opacity: 0.72 },
  diameterRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8, paddingTop: 12, marginTop: 12, borderTopWidth: 1, borderTopColor: "#2A3239" },
  diameterCopy: { flex: 1 },
  diameterLabel: { color: "#CDD4D9", fontFamily: "BarlowCondensed_600SemiBold", fontSize: 10, letterSpacing: 0.8 },
  optional: { color: "#7D8993", fontSize: 9 },
  diameterHint: { color: "#76818B", fontSize: 9, marginTop: 2 },
  diameterInputWrap: { width: 90, height: 36, borderRadius: 9, borderWidth: 1, borderColor: "#3A444C", backgroundColor: "#12171B", flexDirection: "row", alignItems: "center", paddingHorizontal: 8 },
  diameterInput: { flex: 1, padding: 0, color: "#F3F5F6", fontFamily: "BarlowCondensed_600SemiBold", fontSize: 15, textAlign: "right" },
  diameterUnit: { color: LIME, fontFamily: "BarlowCondensed_600SemiBold", fontSize: 11, marginLeft: 4 },
  warningCard: { minHeight: 61, padding: 11, borderRadius: 13, borderWidth: 1, flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 13 },
  warningAmber: { borderColor: "#4B4025", backgroundColor: "#242219" },
  warningRed: { borderColor: "#533533", backgroundColor: "#261E1E" },
  warningGreen: { borderColor: "#37452B", backgroundColor: "#1D241A" },
  warningIcon: { width: 28, alignItems: "center" },
  warningCopy: { flex: 1 },
  warningTitle: { color: "#E5E9EA", fontFamily: "BarlowCondensed_600SemiBold", fontSize: 13, letterSpacing: 0.25 },
  warningBody: { color: "#9BA5AC", fontSize: 10, lineHeight: 14, marginTop: 1 },
  measurePanel: { padding: 15, borderRadius: 18, backgroundColor: "#191F24", borderWidth: 1, borderColor: "#303941", marginBottom: 14 },
  measureHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  elapsedPill: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 6, paddingHorizontal: 9, borderRadius: 8, backgroundColor: "#28311E" },
  elapsedDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: LIME },
  elapsedText: { color: LIME, fontFamily: "BarlowCondensed_600SemiBold", fontSize: 10, letterSpacing: 0.7 },
  resultConfidence: { color: LIME, fontFamily: "BarlowCondensed_600SemiBold", fontSize: 10, letterSpacing: 0.7 },
  measureInfo: { minHeight: 62, flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderRadius: 11, backgroundColor: "#20272D", marginBottom: 12 },
  measureInfoIcon: { width: 29, height: 29, borderRadius: 9, backgroundColor: "#2A3422", alignItems: "center", justifyContent: "center" },
  measureInfoText: { flex: 1, color: "#ABB4BA", fontSize: 10, lineHeight: 15 },
  resultCard: { padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#3B4930", backgroundColor: "#1E251C", marginBottom: 12 },
  resultTopline: { flexDirection: "row", alignItems: "center", gap: 9 },
  resultIcon: { width: 37, height: 37, borderRadius: 12, backgroundColor: "#29341F", alignItems: "center", justifyContent: "center" },
  resultDirectionWrap: { flex: 1 },
  resultOverline: { color: "#92A47A", fontFamily: "BarlowCondensed_600SemiBold", fontSize: 9, letterSpacing: 1.1 },
  resultDirection: { color: LIME, fontFamily: "BarlowCondensed_700Bold", fontSize: 25, lineHeight: 28 },
  resultDirectionSuffix: { color: "#A9B19F", fontFamily: "BarlowCondensed_500Medium", fontSize: 11 },
  severityBadge: { alignItems: "flex-end", justifyContent: "center", gap: 0 },
  severityLabel: { color: "#94A086", fontFamily: "BarlowCondensed_600SemiBold", fontSize: 7, letterSpacing: 0.6 },
  severityValueRow: { flexDirection: "row", alignItems: "baseline", gap: 2 },
  severityNumber: { color: "#EDF2E6", fontFamily: "BarlowCondensed_700Bold", fontSize: 25 },
  severityUnit: { color: "#94A086", fontFamily: "BarlowCondensed_500Medium", fontSize: 10, marginBottom: 4 },
  resultDivider: { height: 1, backgroundColor: "#37412F", marginVertical: 11 },
  resultMetrics: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  statCell: { flex: 1, alignItems: "flex-start" },
  statLabel: { color: "#849078", fontFamily: "BarlowCondensed_600SemiBold", fontSize: 8, letterSpacing: 0.8 },
  statValueRow: { flexDirection: "row", alignItems: "baseline", gap: 3, marginTop: 3 },
  statValue: { color: "#F1F3EE", fontFamily: "BarlowCondensed_700Bold", fontSize: 19 },
  statUnit: { color: "#A5AEA0", fontFamily: "BarlowCondensed_500Medium", fontSize: 9 },
  statDivider: { height: 28, width: 1, backgroundColor: "#384231", marginHorizontal: 6 },
  resultDisclaimer: { color: "#9AA394", fontSize: 9, lineHeight: 13, marginTop: 10 },
  noticeText: { color: "#A9B2B9", fontSize: 10, lineHeight: 15, marginBottom: 9 },
  primaryButton: { height: 50, paddingHorizontal: 14, borderRadius: 13, backgroundColor: LIME, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 9 },
  primaryButtonDisabled: { backgroundColor: "#4B5544" },
  stopButton: { backgroundColor: "#632E2D" },
  primaryButtonText: { flex: 1, textAlign: "center", color: "#15191D", fontFamily: "BarlowCondensed_700Bold", fontSize: 14, letterSpacing: 1.2 },
  stopButtonText: { color: "#FFF1EF" },
  secondaryAction: { minHeight: 35, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, marginTop: 4 },
  secondaryActionText: { color: MUTED, fontSize: 10 },
  footnote: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 7, marginTop: 2, marginBottom: 15 },
  footnoteText: { color: "#7D8891", fontSize: 9 },
  disclaimer: { paddingHorizontal: 11, paddingVertical: 10, borderTopWidth: 1, borderTopColor: "#252C32", flexDirection: "row", gap: 9 },
  disclaimerTitle: { color: "#85909A", fontFamily: "BarlowCondensed_700Bold", fontSize: 9, letterSpacing: 0.9, marginTop: 1 },
  disclaimerText: { flex: 1, color: "#737F89", fontSize: 9, lineHeight: 14 },
});
