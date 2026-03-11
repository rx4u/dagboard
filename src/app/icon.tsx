import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#0a0a0a',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div style={{ display: 'flex', flexWrap: 'wrap', width: 20, height: 20, gap: 2 }}>
          <div style={{ width: 9, height: 9, background: '#e5e5e5', borderRadius: 1 }} />
          <div style={{ width: 9, height: 9, background: '#e5e5e5', borderRadius: 1 }} />
          <div style={{ width: 9, height: 9, background: '#e5e5e5', borderRadius: 1 }} />
          <div style={{ width: 9, height: 9, background: 'transparent' }} />
        </div>
      </div>
    ),
    { ...size }
  )
}
