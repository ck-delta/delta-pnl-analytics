import { useEffect, useState, type ReactNode } from 'react'

interface Props {
  background: string
  children: ReactNode
}

export function StorySlide({ background, children }: Props) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const raf = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          maxWidth: '32rem',
          width: '100%',
          padding: '40px',
          opacity: visible ? 1 : 0,
          transform: visible ? 'translateY(0)' : 'translateY(20px)',
          transition: 'opacity 500ms ease, transform 500ms ease',
        }}
      >
        {children}
      </div>
    </div>
  )
}
