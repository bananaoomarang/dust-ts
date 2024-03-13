import { useEffect, useState, MutableRefObject, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { decompressLevel } from './dust/level-utils'
import api from  './api'
import Dust, { Level } from './dust/Dust'
import Button from './Button'
import Loading from './Loading'
import LevelThumbnail from './LevelThumbnail'
import styles from './styles/LevelBrowser.module.css'

interface Props {
  game: MutableRefObject<Dust | null>,
  thumbnailSize: number,
  pageSize: number
}

export default function LevelBrowser ({ game, thumbnailSize, pageSize }: Props) {
  const decompressedLevels = useRef<Record<number, number[][]>>({})
  const [selectedLevel, setSelectedLevel] = useState<Level | null>(null)
  const [offset, setOffset] = useState<number>(0)

  const { data: levels, isFetching } = useQuery<Level[]>({
    queryKey: ['/levels', pageSize, offset],
    queryFn: async ({ queryKey: [url, limit, offset] }) => {
      const res = await api
        .query({ limit, offset })
        .get(url as string)
        .res()
      const data: Level[] = await res.json()
      for (const level of data) {
        decompressedLevels.current[level.id] = await decompressLevel(level.data)
      }
      return data
    },
    initialData: []
  })

  useEffect(() => {
    if (!game.current || !selectedLevel) {
      return
    }

    game.current.loadLevel(selectedLevel)
  }, [selectedLevel, game])

  if (isFetching) {
    return (
      <div className={styles.wrapper}>
        <h2>User Levels</h2>
        <Loading />
      </div>
    )
  }

  return (
    <div className={styles.wrapper}>
      <h2>User Levels</h2>
      <div className={styles.rows}>
        {levels.map(level => (
          <LevelThumbnail
            key={level.id}
            thumbnailSize={thumbnailSize}
            level={level}
            levelData={decompressedLevels.current[level.id]}
            setSelectedLevel={setSelectedLevel}
            selectedLevel={selectedLevel}
            game={game}
          />
        ))}
      </div>

      {offset > 0 && <Button onClick={() => setOffset(offset - pageSize)}>Previous page</Button>}
      {levels.length === pageSize && <Button onClick={() => setOffset(offset + pageSize)}>Next page</Button>}
    </div>
  )
}

LevelBrowser.defaultProps = {
  pageSize: 9
}
