import { useState, useEffect } from 'react'

interface Props {
  className?: string
}

export default function Loading ({ className }: Props) {
  const [dots, setDots] = useState('')
  useEffect(() => {
    const timeout = setInterval(() => {
      setDots(v => v.length < 3 ? v + '.' : '')
    }, 400)

    return () => clearInterval(timeout)
  }, [])
  return (
    <h3 className={className || ''}>Loading{dots}</h3>
  )
}
