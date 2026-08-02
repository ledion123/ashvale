import { AlertCircle, X, RotateCcw } from 'lucide-react'

interface Props {
  message: string
  onDismiss: () => void
  onRetry?: () => void
}

export default function ErrorBanner({ message, onDismiss, onRetry }: Props) {
  if (!message) return null
  return (
    <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg px-4 py-3 text-sm">
      <AlertCircle size={15} className="shrink-0" />
      <span className="flex-1">{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="flex items-center gap-1 text-red-300 hover:text-red-200 transition-colors shrink-0 text-xs font-medium">
          <RotateCcw size={12} />
          Retry
        </button>
      )}
      <button onClick={onDismiss} aria-label="Dismiss" className="text-red-400/70 hover:text-red-300 transition-colors shrink-0">
        <X size={15} />
      </button>
    </div>
  )
}
