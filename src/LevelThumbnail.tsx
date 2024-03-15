import { MutableRefObject, useEffect, useRef } from 'react'
import { Link } from 'wouter'
import classNames from 'classnames'
import Dust, { Level } from './dust/Dust'
import { getPath } from './route-utils'
import buttonStyles from './styles/Button.module.css'
import styles from './styles/LevelThumbnail.module.css'

interface Props {
  thumbnailSize: number
  level: Level
  levelData: number[][]
  game: MutableRefObject<Dust | null>
}

export default function LevelThumbnail ({
  thumbnailSize,
  level,
  levelData,
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
    <Link
      className={classNames(buttonStyles.button, styles.link)}
      href={getPath(`/levels/${level.id}`)}
      onClick={() => window.scroll(0, 0)}
    >
      <canvas
        className={styles.canvas}
        ref={canvas}
        width={thumbnailSize}
        height={thumbnailSize}
      />
      <span className={styles.name}>{level.name}</span>
    </Link>
  )
}
