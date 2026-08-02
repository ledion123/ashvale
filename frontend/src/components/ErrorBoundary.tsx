import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
}

// React error boundaries must be class components — there's no hook equivalent
// for componentDidCatch/getDerivedStateFromError.
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled error in page:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div className="bg-surface border border-edge rounded-xl p-10 text-center space-y-4 max-w-lg mx-auto mt-10">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto">
            <AlertTriangle size={22} className="text-red-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-base">Something went wrong</h2>
            <p className="text-slate-500 text-sm mt-1">
              This page hit an unexpected error. Your data (uploaded sites, register, etc.) hasn't been lost.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Try again
            </button>
            <Link
              to="/"
              onClick={() => this.setState({ error: null })}
              className="px-4 py-2 border border-edge hover:border-edge-hover text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-colors"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
