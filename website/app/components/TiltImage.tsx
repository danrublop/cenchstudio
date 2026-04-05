'use client'

import { useRef, useState } from 'react'
import Image from 'next/image'

export function TiltImage({ src, alt }: { src: string; alt: string }) {
  const ref = useRef<HTMLDivElement>(null)
  const [transform, setTransform] = useState('perspective(800px) rotateX(0deg) rotateY(0deg)')

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width - 0.5
    const y = (e.clientY - rect.top) / rect.height - 0.5
    setTransform(`perspective(800px) rotateY(${x * 20}deg) rotateX(${-y * 20}deg) scale3d(1.03, 1.03, 1.03)`)
  }

  const handleLeave = () => {
    setTransform('perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)')
  }

  return (
    <div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      className="w-full max-w-[280px] sm:max-w-[320px] lg:max-w-[360px]"
      style={{ transform, transition: 'transform 0.15s ease-out' }}
    >
      <Image
        src={src}
        alt={alt}
        width={1024}
        height={1024}
        className="w-full h-auto"
        priority
      />
    </div>
  )
}
