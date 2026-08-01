export default function Spinner({ className = 'w-8 h-8' }: { className?: string }) {
  return <div className={`inline-block border-2 border-edge-hover border-t-blue-500 rounded-full animate-spin ${className}`} />
}
