import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", backgroundColor: "#ffe333", position: "relative", overflow: "hidden" }}>
      <svg width="512" height="512" viewBox="0 0 512 512" style={{ position: "absolute", inset: 0, opacity: 0.16 }}>
        <g fill="none" stroke="#ca9900" strokeWidth="8">
          <path d="M-30 70 70 12 170 70 170 185 70 245 -30 185Z M170 70 270 12 370 70 370 185 270 245 170 185Z M370 70 470 12 570 70 570 185 470 245 370 185Z M70 245 170 185 270 245 270 360 170 420 70 360Z M270 245 370 185 470 245 470 360 370 420 270 360Z" />
        </g>
        <g fill="#ca9900"><circle cx="70" cy="12" r="17"/><circle cx="470" cy="245" r="17"/><circle cx="170" cy="420" r="17"/></g>
      </svg>
      <div style={{ width: 468, height: 178, borderRadius: "50%", background: "#111111", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
        <div style={{ width: 438, height: 146, borderRadius: "50%", background: "white", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "Georgia, serif", fontWeight: 900, fontSize: 102, letterSpacing: -5, color: "#ffe500", textShadow: "3px 3px 0 #111, -2px -2px 0 #111, 2px -2px 0 #111, -2px 2px 0 #111" }}>IMETAL</span>
        </div>
      </div>
    </div>,
    size
  );
}
