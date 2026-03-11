'use client'

import { Component, type ReactNode } from 'react'
import { ArrowCounterClockwise } from '@phosphor-icons/react'

interface Props { children: ReactNode; label?: string }
interface State { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div
          className="flex flex-col items-center justify-center h-full gap-4"
          style={{ color: 'var(--text-ghost)', fontFamily: 'var(--font-mono)' }}
        >
          <div className="text-[11px] uppercase tracking-widest">
            {this.props.label ?? 'Error'}
          </div>
          <div className="text-[12px] text-center max-w-[320px]" style={{ color: 'var(--text-muted)' }}>
            {this.state.error.message}
          </div>
          <button
            onClick={() => this.setState({ error: null })}
            className="flex items-center gap-1.5 text-[12px]"
            style={{ color: 'var(--text-ghost)' }}
          >
            <ArrowCounterClockwise size={12} />
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
