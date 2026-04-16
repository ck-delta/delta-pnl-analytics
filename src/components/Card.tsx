import type { ReactNode } from 'react'
import { cn } from '../lib/utils'

interface Props {
  title?: string
  children: ReactNode
  className?: string
}

export default function Card({ title, children, className }: Props) {
  return (
    <div className={cn('card', className)}>
      {title && <div className="card-title">{title}</div>}
      {children}
    </div>
  )
}
