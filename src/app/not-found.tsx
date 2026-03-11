import Link from 'next/link'

export default function NotFound() {
  return (
    <div
      style={{
        background: 'var(--base)',
        color: 'var(--text-primary)',
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-mono)',
        gap: '16px',
      }}
    >
      <div style={{ color: 'var(--text-ghost)', fontSize: '11px', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
        404
      </div>
      <div style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
        Page not found
      </div>
      <Link
        href="/"
        style={{ fontSize: '12px', color: 'var(--text-ghost)', textDecoration: 'underline', textUnderlineOffset: '3px' }}
      >
        Back to home
      </Link>
    </div>
  )
}
