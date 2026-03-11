import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'dagboard — AI agent experiment dashboard'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          justifyContent: 'flex-end',
          padding: '80px',
          fontFamily: 'monospace',
        }}
      >
        <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
          <div style={{ width: 18, height: 18, background: '#e5e5e5', borderRadius: 2 }} />
          <div style={{ width: 18, height: 18, background: '#e5e5e5', borderRadius: 2 }} />
          <div style={{ width: 18, height: 18, background: '#e5e5e5', borderRadius: 2 }} />
        </div>
        <div style={{ fontSize: 80, fontWeight: 700, color: '#e5e5e5', lineHeight: 1, marginBottom: 24 }}>
          dagboard
        </div>
        <div style={{ fontSize: 28, color: '#737373', lineHeight: 1.4 }}>
          Open-source dashboard for karpathy/agenthub.
          Watch your agents branch, compete, and converge.
        </div>
      </div>
    ),
    { ...size }
  )
}
