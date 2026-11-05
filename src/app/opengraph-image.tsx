import { ImageResponse } from "next/og";

export const alt = "Architectural scale models";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** Default Open Graph card (replace per page in Admin → SEO Settings). */
export default function OpengraphImage() {
  const bars = [0.42, 0.7, 0.55, 0.92, 0.62, 0.35];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f4f1eb",
          color: "#161614",
          padding: 72,
          fontFamily: "serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 28, letterSpacing: 6 }}>
          <div style={{ width: 26, height: 26, border: "2px solid #161614", display: "flex" }}>
            <div style={{ width: 12, height: 12, background: "#161614" }} />
          </div>
          MHOUSE · MODELS
        </div>
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between" }}>
          <div style={{ display: "flex", flexDirection: "column", fontSize: 76, lineHeight: 1.02, maxWidth: 720 }}>
            <span>Architectural</span>
            <span>scale models.</span>
            <span style={{ fontSize: 26, marginTop: 28, color: "#6a665f", letterSpacing: 4 }}>MADE TO ORDER · GEORGIA</span>
          </div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 14, height: 320 }}>
            {bars.map((h, i) => (
              <div
                key={i}
                style={{
                  width: 46,
                  height: 320 * h,
                  background: i === 3 ? "#2c2b28" : "#e6e1d8",
                  border: "1.5px solid #2c2b28",
                  display: "flex",
                }}
              />
            ))}
          </div>
        </div>
      </div>
    ),
    size,
  );
}
