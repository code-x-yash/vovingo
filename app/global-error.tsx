"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif",
          background: "#0b0b12",
          color: "#f4f4f6",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "420px", textAlign: "center" }}>
          <p
            style={{
              fontSize: "13px",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "#a1a1aa",
              margin: "0 0 8px",
            }}
          >
            Vovingo
          </p>
          <h1 style={{ fontSize: "20px", margin: "0 0 8px", fontWeight: 600 }}>
            Something went very wrong
          </h1>
          <p style={{ fontSize: "14px", color: "#a1a1aa", margin: "0 0 20px", lineHeight: 1.6 }}>
            The app hit an unrecoverable error. {error.digest ? `Ref: ${error.digest}` : ""}
          </p>
          <button
            onClick={reset}
            style={{
              padding: "9px 16px",
              borderRadius: "8px",
              border: "1px solid #3f3f46",
              background: "#18181b",
              color: "#f4f4f6",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
