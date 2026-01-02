import { AuthButton } from "@/components/auth-button"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

export default async function Home() {
  const session = await auth()

  // If user is already signed in, redirect to app
  if (session?.user) {
    redirect('/app')
  }

  return (
    <main style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      fontFamily: "system-ui, -apple-system, sans-serif",
      padding: "2rem"
    }}>
      <div style={{
        maxWidth: "600px",
        textAlign: "center"
      }}>
        <h1 style={{
          fontSize: "3rem",
          marginBottom: "1rem",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          fontWeight: "bold"
        }}>
          GitCloak 🔐
        </h1>

        <p style={{
          fontSize: "1.25rem",
          color: "#666",
          marginBottom: "2rem",
          lineHeight: "1.6"
        }}>
          Secure, encrypted markdown editing for GitHub repositories
        </p>

        <div style={{
          backgroundColor: "#f8f9fa",
          padding: "1.5rem",
          borderRadius: "8px",
          marginBottom: "2rem",
          textAlign: "left"
        }}>
          <h2 style={{
            fontSize: "1.1rem",
            marginBottom: "1rem",
            color: "#333"
          }}>
            Features:
          </h2>
          <ul style={{
            listStyle: "none",
            padding: 0,
            margin: 0,
            color: "#555",
            lineHeight: "2"
          }}>
            <li>✓ Client-side encryption (age format)</li>
            <li>✓ Zero-knowledge architecture</li>
            <li>✓ GitHub OAuth integration</li>
            <li>✓ No vendor lock-in</li>
          </ul>
        </div>

        <div style={{ marginTop: "2rem" }}>
          <AuthButton />
        </div>

        <p style={{
          marginTop: "2rem",
          fontSize: "0.875rem",
          color: "#999"
        }}>
          Your encryption key never leaves your browser
        </p>
      </div>
    </main>
  );
}
