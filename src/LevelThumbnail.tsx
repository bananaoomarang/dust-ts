import { Dispatch, MutableRefObject, SetStateAction, useEffect, useRef } from 'react'
import Button from './Button'
import Dust, { Level } from './dust/Dust'
import styles from './styles/LevelThumbnail.module.css'

interface Props {
  thumbnailSize: number
  level: Level
  levelData: number[][]
  setSelectedLevel: Dispatch<SetStateAction<Level | null>>
  selectedLevel: Level | null
  game: MutableRefObject<Dust | null>
}

export default function LevelThumbnail ({
  thumbnailSize,
  level,
  levelData,
  setSelectedLevel,
  selectedLevel,
  game
}: Props) {
  const canvas = useRef<HTMLCanvasElement | null>(null)

  useEffect(() => {
    const dust = game.current

    if (!dust) {
      return
    }

    const bigCanvas = document.createElement('canvas')
    const bigCtx = bigCanvas.getContext('2d')

    if (!bigCtx) {
      return
    }

    const canvasNode = canvas.current

    //
    // Afaik this shouldn't happen but if it does bail
    //
    if (!canvasNode) {
      return
    }

    const ctx = canvasNode.getContext('2d')

    if (!ctx) {
      return
    }

    const arr = new Uint8ClampedArray(500 * 500 * 4)
    bigCanvas.width = 500
    bigCanvas.height = 500

    dust.fillTextureData(levelData, arr)
    const imageData = new ImageData(arr, 500)
    bigCtx.putImageData(imageData, 0, 0)

    const hSize = thumbnailSize / 2

    ctx.translate(hSize, hSize)
    ctx.rotate(90 * Math.PI / 180)
    ctx.translate(-hSize, -hSize)

    ctx.drawImage(bigCanvas, 0, 0, thumbnailSize, thumbnailSize)

    ctx.translate(hSize, hSize)
    ctx.rotate(-90 * Math.PI / 180)
    ctx.translate(-hSize, -hSize)
  }, [level, levelData, game, thumbnailSize])

  return (
    <Button
      className={styles.button}
      onClick={_ => {
        if (document.activeElement) {
          (document.activeElement as HTMLElement).blur()
        }

        if (selectedLevel?.id === level.id && game.current) {
          game.current.loadLevel(selectedLevel)
        } else {
          setSelectedLevel(level)
        }
      }}
    >
      <canvas
        className={styles.canvas}
        ref={canvas}
        width={thumbnailSize}
        height={thumbnailSize}
      />
      {level.name}
    </Button>
  )
}
