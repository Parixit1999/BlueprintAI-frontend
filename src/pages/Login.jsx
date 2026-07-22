import { Alert, Button, Paper, PasswordInput, Stack, Text, TextInput, Title } from '@mantine/core'
import { IconLock } from '@tabler/icons-react'
import { useState } from 'react'

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await onLogin(username, password)
    } catch (err) {
      setError(err.message)
      setBusy(false)
    }
  }

  return (
    <div className="login-screen">
      <Paper shadow="xl" p="xl" radius="md" className="login-card">
        <form onSubmit={submit}>
          <Stack gap="md">
            <div className="login-brand">
              <div className="login-brand-mark">B</div>
              <div>
                <Title order={2}>BlueprintAI</Title>
                <Text c="dimmed" size="sm">
                  Sign in to your drawing workspace
                </Text>
              </div>
            </div>
            {error && (
              <Alert color="red" icon={<IconLock size={16} />}>
                {error}
              </Alert>
            )}
            <TextInput
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
              required
            />
            <PasswordInput
              label="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
            <Button type="submit" loading={busy} fullWidth>
              Sign in
            </Button>
          </Stack>
        </form>
      </Paper>
      {/* drawing-sheet title block, bottom-right like a real sheet */}
      <div className="login-titleblock" aria-hidden="true">
        <span>BLUEPRINTAI</span>
        <span>DRAWING INTELLIGENCE</span>
        <span>SHT 1 OF 1 · REV A</span>
      </div>
    </div>
  )
}
