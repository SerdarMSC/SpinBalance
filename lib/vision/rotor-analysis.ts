export type NormalizedPoint = { x: number; y: number };

export type VisionFrame = {
  capturedAt: number;
  marker: NormalizedPoint | null;
  brightness: number;
};

export type CameraSample = {
  marker: NormalizedPoint | null;
  brightness: number;
  markerPixels: number;
};

export type OrbitEstimate = {
  sampleCount: number;
  coverageRadians: number;
  meanRadius: number;
  runoutFraction: number;
  runoutPixelsRelative: number;
  deviationAngleRadians: number | null;
  severity: number;
  coverageScore: number;
  noiseRatio: number;
  canReport: boolean;
};

const TWO_PI = Math.PI * 2;

/** Locates one connected high-contrast lime-green marker in an RGBA camera frame. */
export function detectLimeMarker(
  pixels: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
): CameraSample {
  const pixelCount = width * height;
  if (pixelCount === 0 || pixels.length < pixelCount * 4) {
    return { marker: null, brightness: 0, markerPixels: 0 };
  }

  let brightnessTotal = 0;
  let brightnessSamples = 0;
  const brightnessStride = 28;
  for (let index = 0; index < pixelCount; index += brightnessStride) {
    const offset = index * 4;
    brightnessTotal +=
      pixels[offset]! * 0.2126 + pixels[offset + 1]! * 0.7152 + pixels[offset + 2]! * 0.0722;
    brightnessSamples += 1;
  }
  const brightness = brightnessSamples ? brightnessTotal / brightnessSamples : 0;

  const mask = new Uint8Array(pixelCount);
  for (let index = 0; index < pixelCount; index += 1) {
    const offset = index * 4;
    const red = pixels[offset]!;
    const green = pixels[offset + 1]!;
    const blue = pixels[offset + 2]!;
    if (
      green >= 105 &&
      green - red >= 38 &&
      green - blue >= 24 &&
      green >= red * 1.32 &&
      green >= blue * 1.16
    ) {
      mask[index] = 1;
    }
  }

  const visited = new Uint8Array(pixelCount);
  const queue = new Int32Array(pixelCount);
  const minimumCluster = Math.max(4, Math.floor(pixelCount * 0.00025));
  const maximumCluster = Math.floor(pixelCount * 0.16);
  let bestCount = 0;
  let bestX = 0;
  let bestY = 0;

  for (let start = 0; start < pixelCount; start += 1) {
    if (!mask[start] || visited[start]) continue;

    let head = 0;
    let tail = 0;
    let sumX = 0;
    let sumY = 0;
    queue[tail++] = start;
    visited[start] = 1;

    while (head < tail) {
      const index = queue[head++]!;
      const x = index % width;
      const y = Math.floor(index / width);
      sumX += x;
      sumY += y;

      for (let nextY = Math.max(0, y - 1); nextY <= Math.min(height - 1, y + 1); nextY += 1) {
        for (let nextX = Math.max(0, x - 1); nextX <= Math.min(width - 1, x + 1); nextX += 1) {
          const next = nextY * width + nextX;
          if (mask[next] && !visited[next]) {
            visited[next] = 1;
            queue[tail++] = next;
          }
        }
      }
    }

    if (tail >= minimumCluster && tail <= maximumCluster && tail > bestCount) {
      bestCount = tail;
      bestX = sumX / tail;
      bestY = sumY / tail;
    }
  }

  return {
    marker:
      bestCount > 0
        ? { x: Math.min(1, Math.max(0, bestX / Math.max(1, width - 1))), y: Math.min(1, Math.max(0, bestY / Math.max(1, height - 1))) }
        : null,
    brightness,
    markerPixels: bestCount,
  };
}

/**
 * Fits first-harmonic radial runout against a manually calibrated rotation center.
 * This detects visible geometric runout, not hidden mass distribution.
 */
export function estimateOrbit(
  frames: VisionFrame[],
  center: NormalizedPoint,
  previewAspectRatio: number,
): OrbitEstimate | null {
  const aspect = Number.isFinite(previewAspectRatio) && previewAspectRatio > 0 ? previewAspectRatio : 1;
  const track = frames
    .filter((frame): frame is VisionFrame & { marker: NormalizedPoint } => frame.marker !== null)
    .map(({ marker }) => {
      const dx = (marker.x - center.x) * aspect;
      const dy = marker.y - center.y;
      const radius = Math.hypot(dx, dy);
      return { dx, dy, radius, angle: Math.atan2(dy, dx) };
    })
    .filter((point) => point.radius >= 0.025 && point.radius <= 0.72);

  if (track.length < 4) return null;

  const meanRadius = track.reduce((total, point) => total + point.radius, 0) / track.length;
  if (meanRadius <= 0) return null;

  const sorted = track.map((point) => (point.angle + TWO_PI) % TWO_PI).sort((a, b) => a - b);
  let largestGap = sorted[0]! + TWO_PI - sorted[sorted.length - 1]!;
  for (let index = 1; index < sorted.length; index += 1) {
    largestGap = Math.max(largestGap, sorted[index]! - sorted[index - 1]!);
  }
  const coverageRadians = Math.max(0, TWO_PI - largestGap);

  let cosCoefficient = 0;
  let sinCoefficient = 0;
  for (const point of track) {
    const radialDelta = point.radius - meanRadius;
    cosCoefficient += radialDelta * Math.cos(point.angle);
    sinCoefficient += radialDelta * Math.sin(point.angle);
  }
  cosCoefficient = (2 * cosCoefficient) / track.length;
  sinCoefficient = (2 * sinCoefficient) / track.length;

  const runout = Math.hypot(cosCoefficient, sinCoefficient);
  let residualSquares = 0;
  for (const point of track) {
    const predicted = meanRadius + cosCoefficient * Math.cos(point.angle) + sinCoefficient * Math.sin(point.angle);
    const residual = point.radius - predicted;
    residualSquares += residual * residual;
  }
  const noiseRatio = Math.sqrt(residualSquares / track.length) / meanRadius;
  const runoutFraction = runout / meanRadius;
  const countConfidence = Math.min(1, track.length / 36);
  const coverageConfidence = Math.min(1, coverageRadians / (Math.PI * 1.65));
  const stabilityConfidence = Math.max(0.2, 1 - Math.min(0.8, noiseRatio * 1.8));
  const coverageScore = Math.round(100 * countConfidence * coverageConfidence * stabilityConfidence);

  return {
    sampleCount: track.length,
    coverageRadians,
    meanRadius,
    runoutFraction,
    runoutPixelsRelative: runout,
    // A direction is shown only when visible runout clears a small noise floor.
    deviationAngleRadians: runoutFraction >= 0.003 ? Math.atan2(sinCoefficient, cosCoefficient) : null,
    severity: Math.max(0, Math.min(100, Math.round(runoutFraction * 380))),
    coverageScore,
    noiseRatio,
    canReport: track.length >= 14 && coverageRadians >= 2.25,
  };
}
