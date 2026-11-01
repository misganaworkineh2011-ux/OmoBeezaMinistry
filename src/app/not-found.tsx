import Link from "next/link";

// Fallback for paths outside the [locale] segment. Renders its own document
// because the root layout only forwards children.
export default function GlobalNotFound() {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "6rem 1rem" }}>
        <h1 style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>404 — Page not found</h1>
        <p style={{ marginBottom: "1.5rem" }}>Sorry, the page you’re looking for isn’t available.</p>
        <Link href="/" style={{ color: "#1E4A7C", fontWeight: 600 }}>
          Back to Home
        </Link>
      </body>
    </html>
  );
}
