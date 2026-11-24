import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

// The share image every page uses unless it has its own.
export const alt = SITE.description;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          background: "#f6f5f1",
          color: "#1a1a18",
        }}
      >
        <div style={{ fontSize: 72, fontWeight: 700, letterSpacing: -2 }}>{SITE.name}</div>
        <div style={{ fontSize: 34, lineHeight: 1.35, maxWidth: 980 }}>{SITE.description}</div>
        <div style={{ fontSize: 26, color: "#5c5c57" }}>{SITE.url.replace("https://", "")}</div>
      </div>
    ),
    size,
  );
}
