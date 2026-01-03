'use client'

import { AuthButton } from "@/components/auth-button"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect } from "react"

export default function Home() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // If user is already signed in, redirect to app
  useEffect(() => {
    if (status === 'authenticated' && session?.user) {
      router.push('/app')
    }
  }, [status, session, router])

  if (status === 'loading') {
    return null // or a loading spinner
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

        <div style={{
          marginTop: "3rem",
          paddingTop: "2rem",
          borderTop: "1px solid #e1e4e8",
          textAlign: "center"
        }}>
          <p style={{
            fontSize: "1rem",
            color: "#555",
            marginBottom: "1rem",
            lineHeight: "1.6"
          }}>
            GitCloak is an open source project
          </p>
          <a
            href="https://github.com/gitcloak/gitcloak"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              padding: "0.75rem 1.25rem",
              fontSize: "1rem",
              color: "#24292e",
              textDecoration: "none",
              border: "1px solid #d1d5db",
              borderRadius: "6px",
              transition: "all 0.2s",
              fontWeight: "500"
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "#f6f8fa"
              e.currentTarget.style.borderColor = "#0366d6"
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent"
              e.currentTarget.style.borderColor = "#d1d5db"
            }}
          >
            <svg
              style={{ width: "20px", height: "20px" }}
              viewBox="0 0 16 16"
              fill="currentColor"
            >
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
            </svg>
            View on GitHub
          </a>
        </div>
      </div>
    </main>
  );
}
