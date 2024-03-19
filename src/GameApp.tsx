import { useRef, useEffect, useCallback, useState } from 'react'
import useSWR from 'swr'
import classNames from 'classnames'
import Dust, { BrushType, WIDTH, HEIGHT } from './dust/Dust'
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
  point.x = (point.x / rect.width) * WIDTH
  point.y = (point.y / rect.height) * HEIGHT

  point.x = Math.min(Math.round(point.x), WIDTH)
  point.y = Math.min(Math.round(point.y), HEIGHT)

  return point
}

function getEvents(e: MouseEvent | TouchEvent): { id: number, x: number, y: number, isTouch: boolean }[] {
  if (e instanceof MouseEvent) {
    return [{ id: 0, x: e.clientX, y: e.clientY, isTouch: false}]
  } else {
    const res = []
    for (const touch of e.targetTouches) {
      res.push({
        id: touch.identifier,
        x: touch.clientX,
        y: touch.clientY,
        isTouch: true
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
  infect: boolean,
  mouseIsDown: boolean
}

const handleSpawnBrush = ({
  game,
  canvasNode,
  e,
  selectedBrush,
  brushSize,
  infect,
  mouseIsDown
}: HandleSpawnOpts) => {
  const events = getEvents(e)

  for (const { id, x, y, isTouch } of events) {
    const rect = canvasNode.getBoundingClientRect()
    const point = getBrushCoords(
      x - rect.left,
      y - rect.top,
      canvasNode
    )
    const active = isTouch || mouseIsDown
    game.addBrush(id, { active, x: point.x, y: point.y, type: selectedBrush, size: brushSize, infect })
  }
}

interface Props {
  levelId?: string
}

function GameApp({ levelId }: Props) {
  const canvas = useRef<HTMLCanvasElement | null>(null)
  const fpsLad = useRef<HTMLElement | null>(null)
  const dust = useRef<Dust | null>(null)
  const mousedown = useRef<boolean>(false)
  const [selectedBrush, setSelectedBrush] = useState<BrushType>('sand')
  const [infect, setInfect] = useState(false)
  const [brushSize, setBrushSize] = useState(10)
  const [gravity, setGravity] = useState(0)
  const [paused, setPaused] = useState(false)

  const levelQuery = useSWR(levelId ? `/levels/${levelId}` : null)

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

    handleSpawnBrush({ game, canvasNode, e, selectedBrush, infect, brushSize, mouseIsDown: true })
  }, [selectedBrush, infect, brushSize])

  const handleMousemove = useCallback((e: MouseEvent | TouchEvent) => {
    const canvasNode = canvas.current
    const game = dust.current
    const mouseIsDown = mousedown.current

    if (!canvasNode || !game) {
      return
    }

    let handled = false

    if (e instanceof MouseEvent) {
      const rect = canvasNode.getBoundingClientRect()
      const { clientX, clientY } = e

      if (
        clientX < rect.x ||
        clientX > rect.right ||
        clientY < rect.y ||
        clientY > rect.bottom
      ) {
        game.removeBrush(0)
      } else {
        handleSpawnBrush({ game, canvasNode, e, selectedBrush, infect, brushSize, mouseIsDown })
        handled = true
      }
    } else {
      handleSpawnBrush({ game, canvasNode, e, selectedBrush, infect, brushSize, mouseIsDown: true })
      handled = true
    }


    if (handled) {
      e.preventDefault()
    }
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

    if (e.key === 'z') {
      game.step = !game.step
    }

    if (e.key === 'x') {
      game.run()
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
    const game = dust.current

    if (!game) {
      return
    }

    const rad = gravity * (Math.PI / 180)
    const x = Math.sin(rad)
    const y = Math.cos(rad)
    const absX = Math.abs(x)
    const absY = Math.abs(y)

    if ((absX > 0 && absX < 1) || (absY > 0 && absY < 1)) {
      game.gravity = [x * 2, y * 2]
    } else {
      game.gravity = [x, y]
    }
  }, [gravity])

  useEffect(() => {
    const game = dust.current
    if (!game || !levelQuery.data) {
      return
    }

    game.loadLevel(levelQuery.data)
  }, [levelQuery.data])

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
    window.addEventListener('mousemove', handleMousemove)
    canvasNode.addEventListener('touchmove', handleMousemove)
    window.addEventListener('mouseup', handleMouseup)
    window.addEventListener('touchend', handleMouseup)
    window.addEventListener('keydown', handleKeydown)

    return () => {
      canvasNode.removeEventListener('mousedown', handleMousedown)
      canvasNode.removeEventListener('touchstart', handleMousedown)
      window.removeEventListener('mousemove', handleMousemove)
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
        <div className={styles.canvasWrapper} style={{ transform: `rotate(-${gravity}deg)`}}>
          <span className={classNames(styles.paused, { [styles.show]: paused })}>PAUSED</span>
          <canvas className={styles.canvas} ref={canvas} width="500" height="500" />
        </div>
        <MaterialSelector selected={selectedBrush} setSelected={setSelectedBrush} infect={infect} setInfect={setInfect} />
        <BrushSelector
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          gravity={gravity}
          setGravity={setGravity}
        />
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
