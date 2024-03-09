import { useRef, useEffect, useCallback, useState } from 'react'
import classNames from 'classnames'
import Dust from './Dust'
import Point from './Point'
import * as glUtil from './gl-util'
import MaterialSelector from './MaterialSelector'
import BrushSelector from './BrushSelector'
import styles from './styles/App.module.css'

function getBrushCoords(
  x: number,
  y: number,
  canvas: HTMLCanvasElement
): Point {
  const point = new Point(x, y)
  const rect = canvas.getBoundingClientRect()
  point.x = (point.x / rect.width) * canvas.width
  point.y = (point.y / rect.height) * canvas.height

  point.x = Math.min(Math.round(point.x), 500)
  point.y = Math.min(Math.round(point.y), 500)

  return point
}

function App() {
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const fpsLad = useRef<HTMLElement | null>(null)
  const dust = useRef<Dust | null>(null)
  const mousedown = useRef<boolean>(false)
  const [selectedBrush, setSelectedBrush] = useState('sand')
  const [infect, setInfect] = useState(false)
  const [brushSize, setBrushSize] = useState(10)

  const handleMousedown = useCallback((e: MouseEvent) => {
    mousedown.current = true

    const game = dust.current
    const canvasNode = canvas.current
    const { offsetX, offsetY } = e

    if (!game || !canvasNode) {
      return
    }

    const point = getBrushCoords(offsetX, offsetY, canvasNode)
    game.spawnCircle(point.x, point.y, selectedBrush, brushSize, infect)
  }, [selectedBrush, infect, brushSize])

  const handleMousemove = useCallback((e: MouseEvent) => {
    const canvasNode = canvas.current
    const game = dust.current
    const mouseIsDown = mousedown.current

    const { clientX, clientY} = e

    if (!canvasNode || !game || !mouseIsDown) {
      return
    }

    const point = getBrushCoords(
      clientX - canvasNode.offsetLeft,
      clientY - canvasNode.offsetTop,
      canvasNode
    )
    game.spawnCircle(point.x, point.y, selectedBrush, brushSize, infect)
  }, [selectedBrush, infect, brushSize])

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
    const game = new Dust({ gl, fpsNode: fpsLad.current })
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
      <h1 className={styles.header}>Dust</h1>
      <div className={styles.wrapper}>
        <span className={classNames(styles.fps, { [styles.show]: true })} ref={fpsLad}>0fps</span>
        <canvas className={styles.canvas} ref={canvas} width="500" height="500" />
        <MaterialSelector selected={selectedBrush} setSelected={setSelectedBrush} infect={infect} setInfect={setInfect} />
        <BrushSelector brushSize={brushSize} setBrushSize={setBrushSize} />
      </div>
    </div>
  )
}

export default App
