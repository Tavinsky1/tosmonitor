import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "ToS Monitor — Know When Your Vendors Change the Rules";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        {/* Shield icon */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: 20,
            background: "#4361ee",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 32,
          }}
        >
          <svg
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M12 2L4 5.5v5.5c0 5 3.33 9.67 8 11 4.67-1.33 8-6 8-11V5.5L12 2z"
              fill="white"
              opacity="0.9"
            />
            <path
              d="M10.5 13.5L8.5 11.5L9.9 10.1L10.5 10.7L13.1 8.1L14.5 9.5L10.5 13.5z"
              fill="#4361ee"
            />
          </svg>
        </div>

        {/* Title */}
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: "white",
            textAlign: "center",
            lineHeight: 1.1,
            maxWidth: 800,
          }}
        >
          Know When Your Vendors
        </div>
        <div
          style={{
            fontSize: 56,
            fontWeight: 800,
            color: "#4361ee",
            textAlign: "center",
            lineHeight: 1.1,
            marginTop: 4,
          }}
        >
          Change the Rules
        </div>

        {/* Subtitle */}
        <div
          style={{
            fontSize: 22,
            color: "#94a3b8",
            marginTop: 24,
            textAlign: "center",
            maxWidth: 600,
          }}
        >
          AI-powered monitoring for ToS & Privacy Policy changes across 20+ SaaS services
        </div>

        {/* Bottom bar */}
        <div
          style={{
            position: "absolute",
            bottom: 40,
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <div style={{ fontSize: 18, color: "#64748b" }}>tos.inksky.net</div>
        </div>
      </div>
    ),
    { ...size }
  );
}
