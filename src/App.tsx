import { useRef, useEffect, useCallback, useState } from 'react'
import classNames from 'classnames'
import Dust from './dust/Dust'
import Point from './dust/Point'
import * as glUtil from './dust/gl-util'
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

function getEvents(e: MouseEvent | TouchEvent): { id: number, x: number, y: number }[] {
  if (e instanceof MouseEvent) {
    return [{ id: 0, x: e.clientX, y: e.clientY}]
  } else {
    const res = []
    for (const touch of e.targetTouches) {
      res.push({
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY
      })
    }

    return res
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
  const events = getEvents(e)

  for (const { id, x, y } of events) {
    const point = getBrushCoords(
      x - canvasNode.offsetLeft,
      y - canvasNode.offsetTop + window.scrollY,
      canvasNode
    )
    game.addBrush(id, { x: point.x, y: point.y, type: selectedBrush, size: brushSize, infect })
  }
}

function App() {
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const fpsLad = useRef<HTMLElement | null>(null)
  const dust = useRef<Dust | null>(null)
  const [selectedBrush, setSelectedBrush] = useState('sand')
  const [infect, setInfect] = useState(false)
  const [brushSize, setBrushSize] = useState(10)

  const handleMousedown = useCallback((e: MouseEvent | TouchEvent) => {
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

    e.preventDefault()

    if (!canvasNode || !game) {
      return
    }

    handleSpawnBrush({ game, canvasNode, e, selectedBrush, infect, brushSize })
  }, [selectedBrush, infect, brushSize])

  const handleMouseup = useCallback((e: MouseEvent | TouchEvent) => {
    const game = dust.current
    const canvasNode = canvas.current

    if (!game || !canvasNode) {
      return
    }

    if (e instanceof MouseEvent) {
      game.removeBrush(0)
    } else {
      for (const touch of e.changedTouches) {
        game.removeBrush(touch.identifier)
      }
    }
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
