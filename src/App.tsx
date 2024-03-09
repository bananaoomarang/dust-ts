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

const getEventCoords = (e: MouseEvent | TouchEvent) => {
  if (e instanceof MouseEvent) {
    return e
  } else {
    return e.targetTouches[0]
  }
}

interface HandleSpawnOpts {
  game: Dust
  canvasNode: HTMLCanvasElement
  e: MouseEvent | TouchEvent
  selectedBrush: string
  brushSize: number
  infect: boolean
}

const handleSpawnBrush = ({
  game,
  canvasNode,
  e,
  selectedBrush,
  brushSize,
  infect
}: HandleSpawnOpts) => {
  const { clientX, clientY } = getEventCoords(e)
  const point = getBrushCoords(
    clientX - canvasNode.offsetLeft,
    clientY - canvasNode.offsetTop,
    canvasNode
  )
  game.spawnCircle(point.x, point.y, selectedBrush, brushSize, infect)
}

function App() {
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const fpsLad = useRef<HTMLElement | null>(null)
  const dust = useRef<Dust | null>(null)
  const mousedown = useRef<boolean>(false)
  const [selectedBrush, setSelectedBrush] = useState('sand')
  const [infect, setInfect] = useState(false)
  const [brushSize, setBrushSize] = useState(10)

  const handleMousedown = useCallback((e: MouseEvent | TouchEvent) => {
    mousedown.current = true

    const game = dust.current
    const canvasNode = canvas.current

    e.preventDefault()

    if (!game || !canvasNode) {
      return
    }

    handleSpawnBrush({ game, canvasNode, e, selectedBrush, infect, brushSize })
  }, [selectedBrush, infect, brushSize])

  const handleMousemove = useCallback((e: MouseEvent | TouchEvent) => {
    const canvasNode = canvas.current
    const game = dust.current
    const mouseIsDown = mousedown.current

    e.preventDefault()

    if (!canvasNode || !game || !mouseIsDown) {
      return
    }

    handleSpawnBrush({ game, canvasNode, e, selectedBrush, infect, brushSize })
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
    canvas.current.addEventListener('touchstart', handleMousedown)
    canvas.current.addEventListener('mousemove', handleMousemove)
    canvas.current.addEventListener('touchmove', handleMousemove)
    window.addEventListener('mouseup', handleMouseup)
    window.addEventListener('touchend', handleMouseup)
    window.addEventListener('keydown', handleKeydown)

    return () => {
      canvas.current?.removeEventListener('mousedown', handleMousedown)
      canvas.current?.removeEventListener('touchstart', handleMousedown)
      canvas.current?.removeEventListener('mousemove', handleMousemove)
      canvas.current?.removeEventListener('touchmove', handleMousemove)
      window.removeEventListener('mouseup', handleMouseup)
      window.removeEventListener('touchend', handleMouseup)
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
