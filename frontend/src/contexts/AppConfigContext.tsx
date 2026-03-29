import { createContext, useContext, useEffect, useState } from 'react'

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000'

interface AppConfig {
  demoMode: boolean
}

const AppConfigContext = createContext<AppConfig | null>(null)

export function AppConfigProvider({ children }: { children: React.ReactNode }) {
  const [config, setConfig] = useState<AppConfig | null>(null)

  useEffect(() => {
    fetch(`${API_BASE}/api/config`)
      .then((res) => res.json())
      .then((data) => {
        const parsed: AppConfig = { demoMode: data.demo_mode }
        setConfig(parsed)
        console.log('[EMBER] config:', parsed)
      })
      .catch((err) => {
        console.error('[EMBER] failed to load config:', err)
        // Fall back to demo mode on error so the app stays usable offline
        setConfig({ demoMode: true })
      })
  }, [])

  return (
    <AppConfigContext.Provider value={config}>
      {children}
    </AppConfigContext.Provider>
  )
}

// Returns null while the config is still loading.
export function useAppConfig() {
  return useContext(AppConfigContext)
}
