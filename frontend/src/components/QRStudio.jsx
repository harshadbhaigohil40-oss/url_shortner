import React, { useState, useRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import GlassCard from "./ui/GlassCard";
import Button from "./ui/Button";

const PRESET_LOGOS = [
  { name: "None", url: "" },
  { name: "Link", url: "https://cdn-icons-png.flaticon.com/512/282/282803.png" },
  { name: "Globe", url: "https://cdn-icons-png.flaticon.com/512/814/814587.png" },
  { name: "Share", url: "https://cdn-icons-png.flaticon.com/512/2958/2958791.png" },
  { name: "YouTube", url: "https://cdn-icons-png.flaticon.com/512/1384/1384060.png" },
  { name: "Instagram", url: "https://cdn-icons-png.flaticon.com/512/1384/1384063.png" }
];

const PRESET_PALETTES = [
  { name: "Modern Cyber", fg: "#6366f1", bg: "#0f172a" },
  { name: "Emerald Pro", fg: "#10b981", bg: "#064e3b" },
  { name: "Sunset Gold", fg: "#f59e0b", bg: "#451a03" },
  { name: "Classic Dark", fg: "#000000", bg: "#ffffff" },
  { name: "Neon Violet", fg: "#a855f7", bg: "#1e1b4b" }
];

export default function QRStudio({ url, shortCode, onClose }) {
  const [fgColor, setFgColor] = useState("#6366f1");
  const [bgColor, setBgColor] = useState("#ffffff");
  const [size, setSize] = useState(280);
  const [level, setLevel] = useState("H");
  const [includeMargin, setIncludeMargin] = useState(true);
  const [selectedLogo, setSelectedLogo] = useState("");
  const [customLogoUrl, setCustomLogoUrl] = useState("");
  const qrRef = useRef(null);

  const activeLogo = customLogoUrl || selectedLogo;

  const downloadPNG = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const pngUrl = canvas.toDataURL("image/png");
    const downloadLink = document.createElement("a");
    downloadLink.href = pngUrl;
    downloadLink.download = `qr_${shortCode || "link"}.png`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in-up">
      <GlassCard className="max-w-2xl w-full p-6 sm:p-8 border border-border-glass shadow-2xl relative max-h-[92vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6 border-b border-border-glass pb-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">qr_code_scanner</span>
              Custom QR Code Studio
            </h2>
            <p className="text-sm text-text-muted mt-1">
              Design a branded, high-resolution QR code for <span className="text-tertiary font-mono">{url}</span>
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-text-muted hover:text-on-surface p-2 rounded-lg hover:bg-surface-glass transition-colors"
              title="Close"
            >
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Controls Column */}
          <div className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">
                Preset Color Themes
              </label>
              <div className="flex flex-wrap gap-2">
                {PRESET_PALETTES.map((palette) => (
                  <button
                    key={palette.name}
                    type="button"
                    onClick={() => {
                      setFgColor(palette.fg);
                      setBgColor(palette.bg);
                    }}
                    className="px-3 py-1.5 text-xs rounded-lg border border-border-glass hover:border-primary/50 transition-all flex items-center gap-1.5 bg-surface-glass"
                  >
                    <span className="w-3 h-3 rounded-full border border-white/20" style={{ backgroundColor: palette.fg }}></span>
                    <span className="text-on-surface">{palette.name}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-text-muted block mb-1">Pattern Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="w-10 h-10 rounded border border-border-glass cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={fgColor}
                    onChange={(e) => setFgColor(e.target.value)}
                    className="w-24 text-xs font-mono px-2 py-1.5 rounded bg-surface-container border border-border-glass text-on-surface"
                  />
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-text-muted block mb-1">Background Color</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-10 h-10 rounded border border-border-glass cursor-pointer bg-transparent"
                  />
                  <input
                    type="text"
                    value={bgColor}
                    onChange={(e) => setBgColor(e.target.value)}
                    className="w-24 text-xs font-mono px-2 py-1.5 rounded bg-surface-container border border-border-glass text-on-surface"
                  />
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-text-muted uppercase tracking-wider block mb-2">
                Center Logo Icon
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {PRESET_LOGOS.map((item) => (
                  <button
                    key={item.name}
                    type="button"
                    onClick={() => {
                      setSelectedLogo(item.url);
                      setCustomLogoUrl("");
                    }}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-all ${
                      activeLogo === item.url
                        ? "border-primary bg-primary/20 text-on-surface font-semibold"
                        : "border-border-glass text-text-muted hover:border-primary/40 bg-surface-glass"
                    }`}
                  >
                    {item.name}
                  </button>
                ))}
              </div>
              <input
                type="text"
                placeholder="Or paste custom logo image URL..."
                value={customLogoUrl}
                onChange={(e) => {
                  setCustomLogoUrl(e.target.value);
                  setSelectedLogo("");
                }}
                className="w-full text-xs px-3 py-2 rounded-lg bg-surface-container border border-border-glass text-on-surface focus:outline-none focus:border-primary"
              />
            </div>

            <div className="pt-2">
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-semibold text-text-muted">QR Resolution Size</label>
                <span className="text-xs font-mono text-primary font-bold">{size}px</span>
              </div>
              <input
                type="range"
                min="180"
                max="400"
                step="20"
                value={size}
                onChange={(e) => setSize(Number(e.target.value))}
                className="w-full h-1.5 bg-surface-container rounded-lg appearance-none cursor-pointer accent-primary"
              />
            </div>

            <div className="flex items-center justify-between pt-2">
              <label className="text-xs font-semibold text-text-muted flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeMargin}
                  onChange={(e) => setIncludeMargin(e.target.checked)}
                  className="rounded border-border-glass text-primary focus:ring-0"
                />
                Include Border Padding
              </label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-text-muted font-semibold">Error Correction:</span>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="text-xs px-2 py-1 rounded bg-surface-container border border-border-glass text-on-surface"
                >
                  <option value="L">Low (7%)</option>
                  <option value="M">Medium (15%)</option>
                  <option value="Q">Quartile (25%)</option>
                  <option value="H">High (30% - Best for Logos)</option>
                </select>
              </div>
            </div>
          </div>

          {/* Preview Column */}
          <div className="flex flex-col items-center justify-center p-6 bg-surface-container/60 rounded-xl border border-border-glass">
            <div
              ref={qrRef}
              className="p-4 rounded-xl shadow-lg transition-transform duration-300 hover:scale-105"
              style={{ backgroundColor: bgColor }}
            >
              <QRCodeCanvas
                value={url}
                size={size}
                fgColor={fgColor}
                bgColor={bgColor}
                level={level}
                includeMargin={includeMargin}
                imageSettings={
                  activeLogo
                    ? {
                        src: activeLogo,
                        height: 48,
                        width: 48,
                        excavate: true,
                      }
                    : undefined
                }
              />
            </div>

            <div className="w-full mt-6 space-y-2">
              <Button
                variant="gradient"
                className="w-full py-3 text-sm flex items-center justify-center gap-2"
                onClick={downloadPNG}
              >
                <span className="material-symbols-outlined text-base">download</span>
                Download High-Res QR (PNG)
              </Button>
            </div>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
