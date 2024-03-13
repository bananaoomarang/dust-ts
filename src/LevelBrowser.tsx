import { useEffect, useState, MutableRefObject, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import api from  './api'
import Dust, { Level } from './dust/Dust'
import Button from './Button'
import styles from './styles/LevelBrowser.module.css'
import { decompressLevel } from './dust/level-utils'

interface Props {
  game: MutableRefObject<Dust | null>,
  thumbnailSize: number
}

export default function LevelBrowser ({ game, thumbnailSize }: Props) {
  const canvases = useRef<Record<number, HTMLCanvasElement | null>>({})
  const decompressedLevels = useRef<Record<number, number[][]>>({})
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null)
  const { data: levels } = useQuery<Level[]>({
    queryKey: ['/levels'],
    queryFn: async ({ queryKey: [url] }) => {
      const res = await api.get(url as string).res()
      const data: Level[] = await res.json()
      for (const level of data) {
        decompressedLevels.current[level.id] = await decompressLevel(level.data)
      }
      return data
    },
    initialData: []
  })

  const { data: level } = useQuery<Level>({
    queryKey: [`/levels/${selectedLevel}`],
    enabled: !!selectedLevel
  })

  useEffect(() => {
    if (!game.current || !level) {
      return
    }

    game.current.loadLevel(level)
  }, [level, game])

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

    const hSize = 500 / 2
    bigCtx.translate(hSize, hSize)
    bigCtx.rotate(90 * Math.PI / 180)
    bigCtx.translate(-hSize, -hSize)

    for (const level of levels) {
      const canvas = canvases.current[level.id]

      //
      // Afaik this shouldn't happen but if it does bail
      //
      if (!canvas) {
        continue
      }

      const ctx = canvas.getContext('2d')

      if (!ctx) {
        continue
      }

      const arr = new Uint8ClampedArray(500 * 500 * 4)
      const levelData = decompressedLevels.current[level.id]
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
    }
  }, [levels, game, thumbnailSize])

  return (
    <div className={styles.wrapper}>
      <h2>Saved Levels</h2>
      <div className={styles.rows}>
        {levels.map(row => (
          <Button
            key={row.id}
            className={styles.button}
            onClick={e => {
              (e.target as HTMLButtonElement).blur()

              if (selectedLevel === row.id && level && game.current) {
                game.current.loadLevel(level)
              } else {
                setSelectedLevel(row.id)
              }
            }}
          >
            <canvas
              className={styles.canvas}
              ref={el => canvases.current[row.id] = el}
              width={thumbnailSize}
              height={thumbnailSize}
            />
            {row.name}
          </Button>
        ))}
      </div>
    </div>
  )
}
