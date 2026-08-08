import { describe, expect, it } from "vitest";
import { createRingBuffer, decideSample } from "./frameCollector";

describe("decideSample (visibility / timestamp reset)", () => {
  it("discards the first frame of a session (no previous timestamp)", () => {
    const d = decideSample(null, 1000);
    expect(d.kind).toBe("discard");
    expect(d.nextPrev).toBe(1000);
  });

  it("records a normal delta", () => {
    const d = decideSample(1000, 1016.7);
    expect(d.kind).toBe("record");
    if (d.kind === "record") expect(d.deltaMs).toBeCloseTo(16.7, 6);
  });

  it("discards the first frame after a resume, so the background gap is never a sample", () => {
    // hidden at t=1000, visible again at t=21000 → prev invalidated to null
    const resume = decideSample(null, 21_000);
    expect(resume.kind).toBe("discard");
    // the frame after that resumes normal recording
    const next = decideSample(resume.nextPrev, 21_016);
    expect(next.kind).toBe("record");
    if (next.kind === "record") expect(next.deltaMs).toBe(16);
  });

  it("discards non-advancing timestamps", () => {
    expect(decideSample(1000, 1000).kind).toBe("discard");
    expect(decideSample(1000, 900).kind).toBe("discard");
  });
});

describe("ring buffer", () => {
  it("keeps insertion order below capacity and is not truncated", () => {
    const r = createRingBuffer(4);
    r.push(1);
    r.push(2);
    expect(r.toArray()).toEqual([1, 2]);
    expect(r.truncated).toBe(false);
    expect(r.size).toBe(2);
  });

  it("drops oldest samples and latches truncated on overflow", () => {
    const r = createRingBuffer(3);
    [1, 2, 3, 4, 5].forEach((v) => r.push(v));
    expect(r.toArray()).toEqual([3, 4, 5]);
    expect(r.truncated).toBe(true);
    expect(r.size).toBe(3);
  });

  it("clears truncation on reset", () => {
    const r = createRingBuffer(2);
    [1, 2, 3].forEach((v) => r.push(v));
    expect(r.truncated).toBe(true);
    r.reset();
    expect(r.truncated).toBe(false);
    expect(r.toArray()).toEqual([]);
  });
});