import React, { useState } from 'react';
import { Globe, MapPin, BarChart3 } from 'lucide-react';

const countryData = {
  US: { name: "United States", flag: "🇺🇸" },
  IN: { name: "India", flag: "🇮🇳" },
  GB: { name: "United Kingdom", flag: "🇬🇧" },
  DE: { name: "Germany", flag: "🇩🇪" },
  CA: { name: "Canada", flag: "🇨🇦" },
  FR: { name: "France", flag: "🇫🇷" },
  AU: { name: "Australia", flag: "🇦🇺" },
  JP: { name: "Japan", flag: "🇯🇵" },
  BR: { name: "Brazil", flag: "🇧🇷" },
  ES: { name: "Spain", flag: "🇪🇸" },
  IT: { name: "Italy", flag: "🇮🇹" },
  NL: { name: "Netherlands", flag: "🇳🇱" },
  SG: { name: "Singapore", flag: "🇸🇬" },
  AE: { name: "United Arab Emirates", flag: "🇦🇪" },
  MX: { name: "Mexico", flag: "🇲🇽" },
  ZA: { name: "South Africa", flag: "🇿🇦" }
};

// Simplified SVG Paths for World Continents/Regions
const worldRegionPaths = [
  { id: "NA", name: "North America", d: "M 150 100 L 220 90 L 280 140 L 240 220 L 170 200 L 120 150 Z", countries: ["US", "CA", "MX"] },
  { id: "SA", name: "South America", d: "M 250 250 L 300 270 L 310 370 L 260 410 L 240 330 Z", countries: ["BR"] },
  { id: "EU", name: "Europe", d: "M 440 100 L 510 95 L 530 150 L 460 170 L 430 140 Z", countries: ["GB", "DE", "FR", "ES", "IT", "NL"] },
  { id: "AF", name: "Africa", d: "M 430 180 L 520 180 L 540 290 L 480 370 L 430 280 Z", countries: ["ZA"] },
  { id: "AS", name: "Asia", d: "M 530 90 L 730 80 L 770 220 L 640 250 L 540 170 Z", countries: ["IN", "JP", "SG", "AE"] },
  { id: "OC", name: "Oceania", d: "M 700 300 L 780 300 L 800 370 L 720 380 Z", countries: ["AU"] }
];

export default function WorldMapAnalytics({ clickHistory = [] }) {
  const [hoveredCountry, setHoveredCountry] = useState(null);

  // Aggregate clicks by country
  const countryCounts = {};
  let totalClicksWithGeo = 0;

  clickHistory.forEach((click) => {
    const code = (click.country || "Unknown").toUpperCase();
    countryCounts[code] = (countryCounts[code] || 0) + 1;
    totalClicksWithGeo++;
  });

  // Sort country list by clicks descending
  const sortedCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1]);

  const maxClicks = sortedCountries.length > 0 ? sortedCountries[0][1] : 1;

  const getIntensityColor = (code) => {
    const count = countryCounts[code] || 0;
    if (count === 0) return "rgba(255, 255, 255, 0.05)";
    const ratio = count / maxClicks;
    if (ratio > 0.7) return "rgba(16, 185, 129, 0.85)"; // High (emerald)
    if (ratio > 0.3) return "rgba(168, 85, 247, 0.85)"; // Medium (purple)
    return "rgba(59, 130, 246, 0.65)"; // Low (blue)
  };

  return (
    <div className="bg-surface/80 border border-border-glass rounded-3xl p-6 shadow-2xl backdrop-blur-xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-glass/40 pb-4">
        <div>
          <h3 className="text-lg font-extrabold text-on-surface flex items-center gap-2">
            <Globe className="w-5 h-5 text-indigo-400 animate-pulse" />
            Geographic Click Analytics
          </h3>
          <p className="text-xs text-text-muted">Real-time country distribution and visitor heatmaps</p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-indigo-400" />
            {Object.keys(countryCounts).length} Countries Tracked
          </span>
        </div>
      </div>

      {/* SVG Interactive Map Grid */}
      <div className="relative bg-background/80 rounded-2xl p-4 border border-border-glass/30 overflow-hidden min-h-[260px] flex items-center justify-center">
        <svg viewBox="0 0 900 450" className="w-full h-auto max-h-[300px] transition-all">
          {/* Map Grid Lines */}
          <g stroke="rgba(255, 255, 255, 0.03)" strokeWidth="1" strokeDasharray="4 4">
            <line x1="0" y1="112.5" x2="900" y2="112.5" />
            <line x1="0" y1="225" x2="900" y2="225" />
            <line x1="0" y1="337.5" x2="900" y2="337.5" />
            <line x1="225" y1="0" x2="225" y2="450" />
            <line x1="450" y1="0" x2="450" y2="450" />
            <line x1="675" y1="0" x2="675" y2="450" />
          </g>

          {/* Region Paths */}
          {worldRegionPaths.map((region) => {
            // Find total clicks for countries in this region
            const regionClicks = region.countries.reduce((sum, c) => sum + (countryCounts[c] || 0), 0);
            const isHovered = hoveredCountry && region.countries.includes(hoveredCountry);

            return (
              <path
                key={region.id}
                d={region.d}
                fill={regionClicks > 0 ? (isHovered ? "#10b981" : "rgba(99, 102, 241, 0.25)") : "rgba(255, 255, 255, 0.04)"}
                stroke={isHovered ? "#34d399" : "rgba(255, 255, 255, 0.15)"}
                strokeWidth={isHovered ? "2" : "1"}
                className="transition-all duration-300 cursor-pointer"
                onMouseEnter={() => setHoveredCountry(region.countries[0])}
                onMouseLeave={() => setHoveredCountry(null)}
              />
            );
          })}

          {/* Glowing Country Pins */}
          {Object.entries(countryCounts).map(([code, count]) => {
            let cx = 450, cy = 225;
            if (code === 'US') { cx = 200; cy = 150; }
            else if (code === 'IN') { cx = 620; cy = 210; }
            else if (code === 'GB') { cx = 450; cy = 120; }
            else if (code === 'DE') { cx = 480; cy = 130; }
            else if (code === 'CA') { cx = 190; cy = 110; }
            else if (code === 'FR') { cx = 460; cy = 145; }
            else if (code === 'AU') { cx = 750; cy = 340; }
            else if (code === 'JP') { cx = 740; cy = 170; }
            else if (code === 'BR') { cx = 280; cy = 320; }
            else if (code === 'ZA') { cx = 490; cy = 340; }

            const color = getIntensityColor(code);
            const radius = Math.min(18, Math.max(6, (count / maxClicks) * 16));

            return (
              <g 
                key={`pin-${code}`}
                className="cursor-pointer transition-transform hover:scale-125"
                onMouseEnter={() => setHoveredCountry(code)}
                onMouseLeave={() => setHoveredCountry(null)}
              >
                <circle cx={cx} cy={cy} r={radius + 4} fill={color} opacity="0.3" className="animate-ping" />
                <circle cx={cx} cy={cy} r={radius} fill={color} stroke="#ffffff" strokeWidth="1.5" />
                <text x={cx} y={cy + 4} textAnchor="middle" fontSize="10" fill="#ffffff" fontWeight="bold">
                  {code}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Floating Tooltip */}
        {hoveredCountry && (
          <div className="absolute bottom-4 left-4 bg-surface-container/90 border border-indigo-500/40 px-4 py-2.5 rounded-xl shadow-2xl backdrop-blur-md flex items-center gap-3 animate-fade-in-up">
            <span className="text-2xl">{countryData[hoveredCountry]?.flag || "🌐"}</span>
            <div>
              <p className="text-xs font-bold text-on-surface">{countryData[hoveredCountry]?.name || hoveredCountry}</p>
              <p className="text-[11px] text-indigo-300 font-mono font-medium">
                {countryCounts[hoveredCountry] || 0} Clicks ({totalClicksWithGeo > 0 ? ((countryCounts[hoveredCountry] / totalClicksWithGeo) * 100).toFixed(1) : 0}%)
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Top Country Leaderboard */}
      <div className="space-y-3">
        <h4 className="text-xs font-bold text-text-muted uppercase tracking-wider flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4 text-purple-400" />
          Country Leaderboard
        </h4>

        {sortedCountries.length === 0 ? (
          <div className="p-4 text-center text-xs text-text-muted bg-surface-container-low rounded-xl border border-border-glass">
            No geographic click data recorded yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedCountries.slice(0, 6).map(([code, count]) => {
              const meta = countryData[code] || { name: code === 'UNKNOWN' ? 'Direct / Unknown' : code, flag: '🌐' };
              const percent = totalClicksWithGeo > 0 ? Math.round((count / totalClicksWithGeo) * 100) : 0;

              return (
                <div 
                  key={code}
                  onMouseEnter={() => setHoveredCountry(code)}
                  onMouseLeave={() => setHoveredCountry(null)}
                  className={`p-3.5 rounded-2xl bg-surface-container-low border transition-all duration-300 flex items-center justify-between gap-3 ${
                    hoveredCountry === code ? 'border-primary/60 bg-primary-container scale-[1.02]' : 'border-border-glass hover:border-outline-variant'
                  }`}
                >
                  <div className="flex items-center gap-3 truncate">
                    <span className="text-xl shrink-0">{meta.flag}</span>
                    <div className="truncate">
                      <p className="text-xs font-bold text-on-surface truncate">{meta.name}</p>
                      <div className="w-24 h-1.5 bg-surface-container rounded-full mt-1.5 overflow-hidden">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-xs font-extrabold text-indigo-300 font-mono">{count}</span>
                    <span className="block text-[10px] text-text-muted font-medium">{percent}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
