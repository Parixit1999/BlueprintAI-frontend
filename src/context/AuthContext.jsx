import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import * as api from '../api'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

// Session gate: children render only when a valid session exists. On mount
// (or after login) the token is verified with /auth/me; any 401 anywhere in
// the app fires bp:unauthorized and drops back to the login screen.
export function AuthProvider({ children, loginScreen }) {
  const [user, setUser] = useState(null)
  const [checking, setChecking] = useState(!!api.getToken())

  useEffect(() => {
    if (!api.getToken()) return
    api
      .getMe()
      .then(setUser)
      .catch(() => {}) // 401 already cleared the token
      .finally(() => setChecking(false))
  }, [])

  useEffect(() => {
    const onUnauthorized = () => setUser(null)
    window.addEventListener('bp:unauthorized', onUnauthorized)
    return () => window.removeEventListener('bp:unauthorized', onUnauthorized)
  }, [])

  const login = useCallback(async (username, password) => {
    const res = await api.login(username, password)
    api.setToken(res.token)
    setUser({ username: res.username })
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    api.clearToken()
    setUser(null)
  }, [])

  if (checking) return null // brief token re-validation on refresh
  if (!user) return loginScreen({ onLogin: login })
  return <AuthContext.Provider value={{ user, logout }}>{children}</AuthContext.Provider>
}
