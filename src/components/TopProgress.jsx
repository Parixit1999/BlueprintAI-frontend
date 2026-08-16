import { useEffect, useRef, useState } from 'react'

/**
 * Slim brand-blue progress bar along the very top of the app, active while
 * any API request is in flight (api.js dispatches bp:busy / bp:idle).
 * Trickles toward 90% while waiting, sweeps to 100% and fades on completion,
 * so every action gives immediate feedback without per-page spinners.
 */
export default function TopProgress() {
  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const timer = useRef(null)

  useEffect(() => {
    function start() {
      clearInterval(timer.current)
      setVisible(true)
      setProgress(10)
      timer.current = setInterval(
        () => setProgress((p) => Math.min(90, p + (90 - p) * 0.06)),
        200
      )
    }
    function done() {
      clearInterval(timer.current)
      setProgress(100)
      timer.current = setTimeout(() => {
        setVisible(false)
        setProgress(0)
      }, 300)
    }
    window.addEventListener('bp:busy', start)
    window.addEventListener('bp:idle', done)
    return () => {
      clearInterval(timer.current)
      clearTimeout(timer.current)
      window.removeEventListener('bp:busy', start)
      window.removeEventListener('bp:idle', done)
    }
  }, [])

  return (
    <div
      className={visible ? 'top-progress visible' : 'top-progress'}
      style={{ width: `${progress}%` }}
      role="progressbar"
      aria-hidden={!visible}
    />
  )
}
