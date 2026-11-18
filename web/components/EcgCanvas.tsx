"use client";

import { useEffect, useRef } from "react";

export type BeatMark = {
  time_s: number;
  label: string;
  confidence?: number;
};

const LABEL_COLOR: Record<string, string> = {
  N: "#00a896",
  S: "#c9820a",
  V: "#e0484d",
  F: "#9b7bff",
  Unknown: "#8aa0b5",
};

type Props = {
  samples: number[];
  fs: number;
  beats: BeatMark[];
  windowSec?: number;
};

export function EcgCanvas({ samples, fs, beats, windowSec = 6 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || fs <= 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const cssW = canvas.clientWidth;
    const cssH = canvas.clientHeight;
    canvas.width = Math.floor(cssW * dpr);
    canvas.height = Math.floor(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#030a0c";
    ctx.fillRect(0, 0, cssW, cssH);

    const pxPerSec = cssW / windowSec;
    ctx.lineWidth = 1;
    for (let x = 0; x <= cssW; x += pxPerSec / 5) {
      const major = Math.round(x / (pxPerSec / 5)) % 5 === 0;
      ctx.strokeStyle = major ? "rgba(20,220,180,0.2)" : "rgba(20,220,180,0.07)";
      ctx.beginPath();
      ctx.moveTo(x + 0.5, 0);
      ctx.lineTo(x + 0.5, cssH);
      ctx.stroke();
    }
    for (let y = 0; y <= cssH; y += 16) {
      ctx.strokeStyle = y % 80 === 0 ? "rgba(20,220,180,0.16)" : "rgba(20,220,180,0.06)";
      ctx.beginPath();
      ctx.moveTo(0, y + 0.5);
      ctx.lineTo(cssW, y + 0.5);
      ctx.stroke();
    }

    const n = Math.min(samples.length, Math.floor(windowSec * fs));
    if (n < 2) {
      ctx.fillStyle = "rgba(120,160,150,0.75)";
      ctx.font = "500 13px 'IBM Plex Mono', monospace";
      ctx.fillText("Waiting for ECG frames…", 16, cssH / 2);
      return;
    }
    const view = samples.slice(samples.length - n);
    const tStart = (samples.length - n) / fs;

    let min = Infinity;
    let max = -Infinity;
    for (const v of view) {
      if (v < min) min = v;
      if (v > max) max = v;
    }
    const pad = (max - min) * 0.18 || 0.2;
    min -= pad;
    max += pad;

    // Soft phosphor bloom then crisp trace
    ctx.strokeStyle = "rgba(40,255,200,0.22)";
    ctx.lineWidth = 4.5;
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < view.length; i++) {
      const x = (i / (windowSec * fs)) * cssW;
      const y = ((max - view[i]) / (max - min)) * (cssH - 20) + 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    ctx.strokeStyle = "#5dffc8";
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    for (let i = 0; i < view.length; i++) {
      const x = (i / (windowSec * fs)) * cssW;
      const y = ((max - view[i]) / (max - min)) * (cssH - 20) + 10;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    for (const b of beats) {
      if (b.time_s < tStart || b.time_s > tStart + windowSec) continue;
      const x = ((b.time_s - tStart) / windowSec) * cssW;
      const color = LABEL_COLOR[b.label] ?? LABEL_COLOR.Unknown;
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.35;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, cssH);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.fillStyle = color;
      ctx.font = "600 11px 'IBM Plex Mono', monospace";
      ctx.fillText(b.label, x + 4, 16);
    }
  }, [samples, fs, beats, windowSec]);

  return (
    <canvas
      ref={canvasRef}
      className="h-[280px] w-full rounded-sm border border-primary/25 bg-[#030a0c]"
      style={{ width: "100%", height: 280 }}
    />
  );
}
