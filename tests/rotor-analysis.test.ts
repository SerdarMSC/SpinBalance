import { describe, expect, it } from "vitest";

import { detectLimeMarker, estimateOrbit, type VisionFrame } from "../lib/vision/rotor-analysis";

describe("rotor optical analysis", () => {
  it("finds a connected lime reference marker in an RGBA frame", () => {
    const width = 96;
    const height = 72;
    const pixels = new Uint8Array(width * height * 4);
    for (let index = 3; index < pixels.length; index += 4) pixels[index] = 255;
    for (let y = 31; y <= 36; y += 1) {
      for (let x = 67; x <= 72; x += 1) {
        const offset = (y * width + x) * 4;
        pixels[offset] = 182;
        pixels[offset + 1] = 242;
        pixels[offset + 2] = 58;
      }
    }

    const sample = detectLimeMarker(pixels, width, height);
    expect(sample.marker).not.toBeNull();
    expect(sample.marker!.x).toBeCloseTo(69.5 / (width - 1), 2);
    expect(sample.marker!.y).toBeCloseTo(33.5 / (height - 1), 2);
    expect(sample.markerPixels).toBe(36);
  });

  it("reports the observed optical runout direction for a one-per-revolution radial runout", () => {
    const center = { x: 0.5, y: 0.5 };
    const aspect = 1.28;
    const frames: VisionFrame[] = Array.from({ length: 48 }, (_, index) => {
      const phase = (index / 48) * Math.PI * 2;
      const radius = 0.28 + 0.035 * Math.cos(phase);
      return {
        capturedAt: index * 150,
        brightness: 140,
        marker: {
          x: center.x + (Math.cos(phase) * radius) / aspect,
          y: center.y + Math.sin(phase) * radius,
        },
      };
    });

    const estimate = estimateOrbit(frames, center, aspect);
    expect(estimate?.canReport).toBe(true);
    expect(estimate?.severity).toBeGreaterThan(20);
    expect(Math.cos(estimate!.deviationAngleRadians!)).toBeCloseTo(1, 1);
    expect(Math.sin(estimate!.deviationAngleRadians!)).toBeCloseTo(0, 1);
    expect(estimate?.coverageRadians).toBeGreaterThan(6);
  });

  it("does not invent a meaningful severity for a circular orbit", () => {
    const center = { x: 0.48, y: 0.52 };
    const frames: VisionFrame[] = Array.from({ length: 40 }, (_, index) => {
      const phase = (index / 40) * Math.PI * 2;
      return {
        capturedAt: index * 120,
        brightness: 175,
        marker: { x: center.x + 0.24 * Math.cos(phase), y: center.y + 0.24 * Math.sin(phase) },
      };
    });

    const estimate = estimateOrbit(frames, center, 1);
    expect(estimate?.canReport).toBe(true);
    expect(estimate?.severity).toBe(0);
    expect(estimate?.deviationAngleRadians).toBeNull();
    expect(estimate?.runoutFraction).toBeLessThan(0.001);
  });
});
