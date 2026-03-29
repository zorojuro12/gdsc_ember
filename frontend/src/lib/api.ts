// Base URL for all backend API calls.
// Set VITE_API_URL in .env for local dev (http://localhost:8000)
// and in Vercel env vars for production (Railway URL).
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'
