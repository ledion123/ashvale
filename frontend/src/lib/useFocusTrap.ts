import { useEffect, type RefObject } from 'react'

const FOCUSABLE = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'

/** Traps Tab focus inside a popover/dialog while open, focuses its first
 * control on open, and calls onEscape for Escape — so keyboard users don't
 * tab out into the page behind it. Mirrors GenerateModal's pattern. */
export function useFocusTrap(containerRef: RefObject<HTMLElement | null>, active: boolean, onEscape?: () => void) {
  useEffect(() => {
    if (!active || !containerRef.current) return
    const container = containerRef.current
    container.querySelector<HTMLElement>(FOCUSABLE)?.focus()

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onEscape?.()
        return
      }
      if (e.key !== 'Tab') return
      const items = container.querySelectorAll<HTMLElement>(FOCUSABLE)
      if (items.length === 0) return
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    container.addEventListener('keydown', onKeyDown)
    return () => container.removeEventListener('keydown', onKeyDown)
  }, [active, containerRef, onEscape])
}
