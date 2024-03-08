import { useRef, useEffect, useCallback } from 'react'
import Dust from './Dust'
import * as glUtil from './gl-util'
import './App.css'

type Point = {
  x: number
  y: number
}

function getCoords (x: number, y: number): Point {
  return {
    x: Math.min(Math.round(x), 500),
    y: Math.min(Math.round(y), 500)
  }
}

function App() {
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const dust = useRef<Dust | null>(null)
  const mousedown = useRef<boolean>(false)

  const handleMousedown = useCallback((e: MouseEvent) => {
    mousedown.current = true

    const game = dust.current
    const { offsetX, offsetY } = e

    if (!game) {
      return
    }

    const point = getCoords(offsetX, offsetY)
    game.spawnCircle(point.x, point.y, 'sand', 10, false)
  }, [])

  const handleMousemove = useCallback((e: MouseEvent) => {
    const canvasNode = canvas.current
    const game = dust.current
    const mouseIsDown = mousedown.current

    const { clientX, clientY} = e

    if (!canvasNode || !game || !mouseIsDown) {
      return
    }

    const point = getCoords(clientX - canvasNode.offsetLeft, clientY - canvasNode.offsetTop)
    game.spawnCircle(point.x, point.y, 'sand', 10, false)
  }, [])

  const handleMouseup = useCallback(() => {
    mousedown.current = false
  }, [])

  const handleKeydown = useCallback((e: KeyboardEvent) => {
    const game = dust.current

    if (!game) {
      return
    }

    if (e.key === ' ') {
      game.paused = !game.paused
    }
  }, [])

  useEffect(() => {
    //
    // In theory impossible?
    //
    if (!canvas.current) {
      return
    }

    if (dust.current) {
      console.warn('Dust already initialized')
      return
    }

    const gl = glUtil.getGl(canvas.current)
    const game = new Dust(gl)
    game.run()
    dust.current = game
  }, [])

  useEffect(() => {
    //
    // In theory impossible?
    //
    if (!canvas.current) {
      return
    }

    canvas.current.addEventListener('mousedown', handleMousedown)
    canvas.current.addEventListener('mousemove', handleMousemove)
    window.addEventListener('mouseup', handleMouseup)
    window.addEventListener('keydown', handleKeydown)

    return () => {
      canvas.current?.removeEventListener('mousedown', handleMousedown)
      canvas.current?.removeEventListener('mousemove', handleMousemove)
      window.removeEventListener('mouseup', handleMouseup)
      window.removeEventListener('keydown', handleKeydown)
    }
  })

  return (
    <div>
      <canvas ref={canvas} className="canvas" width="500" height="500" />
    </div>
  )
}

export default App
