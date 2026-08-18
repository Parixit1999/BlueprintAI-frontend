import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { Button, Paper, Stack, Text, Title } from '@mantine/core'
import { IconRefresh } from '@tabler/icons-react'
import * as api from '../api'
import Loading from '../components/Loading'

const AuthContext = createContext(null)
export const useAuth = () => useContext(AuthContext)

// Signed in, but no role and not an admin: everything is off-limits until an
// administrator assigns a role. Styled like the login sheet so the app reads
// as "the door", not as an error.
function NoAccess({ user, onRefresh, onLogout }) {
  return (
    <div className="login-screen">
      <Paper shadow="xl" p="xl" radius="md" className="login-card">
        <Stack gap="md">
          <div className="login-brand">
            <div className="login-brand-mark">B</div>
            <div>
              <Title order={2}>BlueprintAI</Title>
              <Text c="dimmed" size="sm">
                Signed in as {user.full_name || user.username}
              </Text>
            </div>
          </div>
          <Text fw={600}>Your account doesn&rsquo;t have access yet</Text>
          <Text size="sm" c="dimmed">
            Ask an administrator to assign you a role. Once they have, check
            again below - no need to sign out.
          </Text>
          <Button leftSection={<IconRefresh size={16} />} onClick={onRefresh}>
            Check again
          </Button>
          <Button variant="default" onClick={onLogout}>
            Sign out
          </Button>
        </Stack>
      </Paper>
    </div>
  )
}

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
    // /me is the single source of truth for identity AND permissions. No
    // fallback object here: a degraded {username}-only user would be missing
    // its role and read as "no access" - if /me fails, fail the login.
    setUser(await api.getMe())
  }, [])

  const logout = useCallback(async () => {
    await api.logout()
    api.clearToken()
    setUser(null)
  }, [])

  const refreshUser = useCallback(async () => {
    setUser(await api.getMe().catch(() => null))
  }, [])

  // Permission helpers, derived once per user change. Admins can everything;
  // everyone else can exactly what their role's pages say.
  const value = useMemo(() => {
    const isAdmin = !!user?.is_admin
    const pages = user?.role?.pages ?? []
    return {
      user,
      logout,
      isAdmin,
      hasAccess: isAdmin || !!user?.role,
      can: (page) => isAdmin || pages.includes(page),
    }
  }, [user, logout])

  // Token re-validation on refresh is usually a flash - but if the backend
  // is slow or restarting it can take seconds, and rendering null here left
  // the ENTIRE app as a white page for that whole window. Show the branded
  // loading state instead so a stalled backend looks like loading, not death.
  if (checking) return <Loading label="Signing you in…" py={120} />
  if (!user) return loginScreen({ onLogin: login })
  if (!value.hasAccess) {
    return <NoAccess user={user} onRefresh={refreshUser} onLogout={logout} />
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
