import { notifications } from '@mantine/notifications'
import { IconAlertTriangle, IconCheck, IconInfoCircle } from '@tabler/icons-react'

// Thin adapter: keeps the app's useToast() API but renders professional
// Mantine notifications underneath. ToastProvider is now a pass-through.
export function ToastProvider({ children }) {
  return children
}

const api = {
  success: (message) =>
    notifications.show({ color: 'teal', icon: <IconCheck size={18} />, message, autoClose: 4000 }),
  error: (message) =>
    notifications.show({
      color: 'red',
      icon: <IconAlertTriangle size={18} />,
      message,
      autoClose: 6000,
    }),
  info: (message) =>
    notifications.show({ color: 'blue', icon: <IconInfoCircle size={18} />, message, autoClose: 4000 }),
}

export function useToast() {
  return api
}
