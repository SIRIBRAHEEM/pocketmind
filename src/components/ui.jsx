// Small shadcn-style primitives, owned and restyled for PocketMind.
import { cn } from '../lib/utils.js'

export function Button({ variant = 'primary', className = '', ...props }) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition focus:outline-none focus:ring-2 focus:ring-chip-400/70 disabled:opacity-50 disabled:pointer-events-none'
  const styles = {
    primary: 'bg-chip-500 text-ink-950 hover:bg-chip-400',
    ghost: 'bg-ink-800 text-mist-100 border border-ink-600 hover:border-chip-500/60 hover:text-chip-300',
    danger: 'bg-red-500/15 text-red-300 border border-red-500/40 hover:bg-red-500/25',
  }
  return <button className={cn(base, styles[variant], className)} {...props} />
}

export function Card({ className = '', ...props }) {
  return (
    <div
      className={cn('rounded-2xl border border-ink-600/70 bg-ink-850 shadow-card', className)}
      {...props}
    />
  )
}

export function Badge({ className = '', ...props }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide',
        className,
      )}
      {...props}
    />
  )
}

export function Input({ className = '', ...props }) {
  return (
    <input
      className={cn(
        'w-full rounded-xl border border-ink-600 bg-ink-900 px-3.5 py-2.5 text-sm text-mist-100 placeholder:text-mist-500 focus:border-chip-500 focus:outline-none focus:ring-2 focus:ring-chip-400/40',
        className,
      )}
      {...props}
    />
  )
}

export function Textarea({ className = '', ...props }) {
  return (
    <textarea
      className={cn(
        'w-full rounded-xl border border-ink-600 bg-ink-900 px-3.5 py-3 text-sm leading-relaxed text-mist-100 placeholder:text-mist-500 focus:border-chip-500 focus:outline-none focus:ring-2 focus:ring-chip-400/40',
        className,
      )}
      {...props}
    />
  )
}

export function Label({ className = '', ...props }) {
  return (
    <label
      className={cn('font-mono text-[11px] font-semibold uppercase tracking-widest text-mist-400', className)}
      {...props}
    />
  )
}
