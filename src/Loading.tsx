import { useState, useEffect } from 'react'

export default function Loading () {
  const [dots, setDots] = useState('')
  useEffect(() => {
    const timeout = setInterval(() => {
      setDots(v => v.length < 3 ? v + '.' : '')
    }, 400)

    return () => clearInterval(timeout)
  }, [])
  return (
    <h3>Loading{dots}</h3>
  )
}
