import { useState, MutableRefObject, useRef } from 'react'
import useSWR from 'swr'
import { useDebounce } from '@uidotdev/usehooks'
import { decompressLevel } from './dust/level-utils'
import api from  './api'
import Dust, { Level } from './dust/Dust'
import Button from './Button'
import Loading from './Loading'
import LevelThumbnail from './LevelThumbnail'
import styles from './styles/LevelBrowser.module.css'
import classNames from 'classnames'

type LevelsResults = {
  results: Level[]
  hasMore: boolean
}

interface Props {
  game: MutableRefObject<Dust | null>,
  thumbnailSize: number,
  pageSize: number
}

interface TheGridProps {
  isLoading: boolean,
  results: LevelsResults,
  thumbnailSize: number,
  game: MutableRefObject<Dust | null>,
  decompressedLevels: MutableRefObject<Record<number, number[][]>>
}

function TheGrid ({
  isLoading,
  results,
  thumbnailSize,
  decompressedLevels,
  game
}: TheGridProps) {
  return (
    <div className={styles.gridLayout}>
      <Loading className={classNames(styles.loading, { [styles.show]: isLoading })} aria-hidden={!isLoading} />
      <div className={classNames(styles.rows, { [styles.show]: !isLoading })} aria-hidden={isLoading}>
        {results.results.map(level => (
          <LevelThumbnail
            key={level.id}
            thumbnailSize={thumbnailSize}
            level={level}
            levelData={decompressedLevels.current[level.id]}
            game={game}
          />
        ))}
      </div>
    </div>
  )
}


export default function LevelBrowser ({ game, thumbnailSize, pageSize }: Props) {
  const decompressedLevels = useRef<Record<number, number[][]>>({})
  const [offset, setOffset] = useState<number>(0)
  const [name, setName] = useState('')
  const debouncedName = useDebounce(name, 1000)

  const { data: results, isLoading } = useSWR(
    ['/levels', debouncedName, pageSize, offset],
    async ([url, name, limit, offset]) => {
      const res = await api
        .query({ name, limit, offset })
        .get(url as string)
        .res()
      const data: LevelsResults = await res.json()
      for (const level of data.results) {
        decompressedLevels.current[level.id] = await decompressLevel(level.data)
      }
      return data
    },
    {
      fallbackData: {
        results: [],
        hasMore: false,
      }
    }
  )

  if (!isLoading && results.results.length === 0) {
    return null
  }

  return (
    <div className={styles.wrapper}>
      <h2>User Levels</h2>

      <input
        type="text"
        placeholder="Search"
        value={name}
        onChange={e => setName(e.target.value)}
      />

      <TheGrid
        isLoading={isLoading}
        results={results}
        thumbnailSize={thumbnailSize}
        game={game}
        decompressedLevels={decompressedLevels}
      />

      <div className={styles.paginator}>
        <div className={styles.pageNumber}>Page {1 + Math.floor(offset / pageSize)}</div>
        <div className={classNames(styles.pageTurners, { [styles.show]: !isLoading })} aria-hidden={isLoading}>
          {offset > 0 && <Button onClick={() => setOffset(offset - pageSize)}>Previous page</Button>}
          {results.hasMore && <Button onClick={() => setOffset(offset + pageSize)}>Next page</Button>}
        </div>
      </div>
    </div>
  )
}

LevelBrowser.defaultProps = {
  pageSize: 9
}
