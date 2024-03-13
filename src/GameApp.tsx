import { useRef, useEffect, useCallback, useState } from 'react'
import classNames from 'classnames'
import Dust, { BrushType } from './dust/Dust'
import Point from './dust/Point'
import * as glUtil from './dust/gl-util'
import MaterialSelector from './MaterialSelector'
import BrushSelector from './BrushSelector'
import LevelBrowser from './LevelBrowser'
import LevelSaver from './LevelSaver'
import styles from './styles/GameApp.module.css'

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
  selectedBrush: BrushType
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
    const rect = canvasNode.getBoundingClientRect()
    const point = getBrushCoords(
      x - rect.left,
      y - rect.top,
      canvasNode
    )
    game.addBrush(id, { x: point.x, y: point.y, type: selectedBrush, size: brushSize, infect })
  }
}

function GameApp() {
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const fpsLad = useRef<HTMLElement | null>(null)
  const dust = useRef<Dust | null>(null)
  const mousedown = useRef<boolean>(false)
  const [selectedBrush, setSelectedBrush] = useState<BrushType>('sand')
  const [infect, setInfect] = useState(false)
  const [brushSize, setBrushSize] = useState(10)
  const [paused, setPaused] = useState(false)

  const handleMousedown = useCallback((e: MouseEvent | TouchEvent) => {
    const game = dust.current
    const canvasNode = canvas.current

    if (document.activeElement && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }

    e.preventDefault()

    if (!game || !canvasNode) {
      return
    }

    mousedown.current = true

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

  const handleMouseup = useCallback((e: MouseEvent | TouchEvent) => {
    const game = dust.current
    const canvasNode = canvas.current

    if (!game || !canvasNode) {
      return
    }

    if (e instanceof MouseEvent) {
      game.removeBrush(0)
      mousedown.current = false
    } else {
      for (const touch of e.changedTouches) {
        game.removeBrush(touch.identifier)
      }
    }
  }, [])

  const handleKeydown = useCallback((e: KeyboardEvent) => {
    const canvasNode = canvas.current
    const game = dust.current

    let handled = false

    if (!game || !canvasNode) {
      return
    }

    if (document.activeElement && !document.activeElement.contains(canvasNode)) {
      return
    }

    if (e.key === ' ') {
      game.paused = !game.paused
      setPaused(game.paused)
      handled = true
    }

    if (e.key === 'r') {
      game.clearLevel()
      handled = true
    }

    if (handled) {
      e.preventDefault()
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
    const canvasNode = canvas.current

    //
    // In theory impossible?
    //
    if (!canvasNode) {
      return
    }

    canvasNode.addEventListener('mousedown', handleMousedown)
    canvasNode.addEventListener('touchstart', handleMousedown)
    canvasNode.addEventListener('mousemove', handleMousemove)
    canvasNode.addEventListener('touchmove', handleMousemove)
    window.addEventListener('mouseup', handleMouseup)
    window.addEventListener('touchend', handleMouseup)
    window.addEventListener('keydown', handleKeydown)

    return () => {
      canvasNode.removeEventListener('mousedown', handleMousedown)
      canvasNode.removeEventListener('touchstart', handleMousedown)
      canvasNode.removeEventListener('mousemove', handleMousemove)
      canvasNode.removeEventListener('touchmove', handleMousemove)
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
        <div className={styles.canvasWrapper}>
          <span className={classNames(styles.paused, { [styles.show]: paused })}>PAUSED</span>
          <canvas className={styles.canvas} ref={canvas} width="500" height="500" />
        </div>
        <MaterialSelector selected={selectedBrush} setSelected={setSelectedBrush} infect={infect} setInfect={setInfect} />
        <BrushSelector brushSize={brushSize} setBrushSize={setBrushSize} />
      </div>
      <LevelSaver game={dust} />
      <LevelBrowser
        game={dust}
        thumbnailSize={150}
      />
    </div>
  )
}

export default GameApp
