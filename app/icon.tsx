import { ImageResponse } from 'next/og'

export function generateImageMetadata() {
  return [
    { id: '192', contentType: 'image/png', size: { width: 192, height: 192 } },
    { id: '512', contentType: 'image/png', size: { width: 512, height: 512 } },
    { id: 'maskable', contentType: 'image/png', size: { width: 512, height: 512 } },
  ]
}

export default async function Icon({ id }: { id: Promise<string | number> }) {
  const iconId = String(await id)
  const isMaskable = iconId === 'maskable'
  const dim = iconId === '192' ? 192 : 512
  const fontSize = isMaskable ? Math.round(dim * 0.45) : Math.round(dim * 0.62)

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#f8fafc',
          fontSize,
          fontWeight: 700,
          letterSpacing: -4,
        }}
      >
        建
      </div>
    ),
    { width: dim, height: dim }
  )
}
