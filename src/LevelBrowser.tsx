import { useState, MutableRefObject, useRef, useEffect } from 'react'
import useSWR from 'swr'
import classNames from 'classnames'
import { useDebounce } from '@uidotdev/usehooks'
import { Link, useLocation, useSearch } from 'wouter'
import { decompressLevel } from './dust/level-utils'
import api from  './api'
import Dust, { Level } from './dust/Dust'
import Loading from './Loading'
import LevelThumbnail from './LevelThumbnail'
import buttonStyles from './styles/Button.module.css'
import styles from './styles/LevelBrowser.module.css'

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
  decompressedLevels: MutableRefObject<Record<number, number[][]>>,
  name: string,
  page: number,
  searchString: string
}

function TheGrid ({
  isLoading,
  results,
  thumbnailSize,
  decompressedLevels,
  game,
  name,
  page,
  searchString
}: TheGridProps) {
  const prevPageLink = getPageLink(page - 1, searchString)
  const nextPageLink = getPageLink(page + 1, searchString)

  if (!isLoading && results.results.length === 0) {
    if (name) {
      return (
        <h3>No results 😔</h3>
      )
    } else {
      return null
    }
  }

  return (
    <>
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

      <div className={styles.paginator}>
        <div className={styles.pageNumber}>Page {page}</div>

        <div className={classNames(styles.pageTurners, { [styles.show]: !isLoading })} aria-hidden={isLoading}>
          {page > 1 && <Link className={classNames(buttonStyles.button, styles.link)} href={prevPageLink}>Previous page</Link>}
          {results.hasMore && <Link className={classNames(buttonStyles.button, styles.link)} href={nextPageLink}>Next page</Link>}
        </div>
      </div>
    </>
  )
}

function getPageLink (page: number, searchString: string): string {
  const path = window.location.pathname
  const params = new URLSearchParams(searchString)
  const pageParams = new URLSearchParams({
    ...Object.fromEntries(params),
    page: String(page)
  })

  if (pageParams.get('page') === '1') {
    pageParams.delete('page')
  }

  if (pageParams.size) {
    return [
      path,
      pageParams.toString()
    ].join('?')
  }

  return path
}

export default function LevelBrowser ({ game, thumbnailSize, pageSize }: Props) {
  const decompressedLevels = useRef<Record<number, number[][]>>({})
  const searchString = useSearch()
  const [page, setPage] = useState<number>(Number(new URLSearchParams(searchString).get('page')) || 1)
  const [name, setName] = useState(new URLSearchParams(searchString).get('name') || '')
  const debouncedName = useDebounce(name, 1000)
  const [_, setLocation] = useLocation()

  useEffect(() => {
    const params = new URLSearchParams(searchString)
    setPage(Number(params.get('page') || 1))
  }, [searchString])

  useEffect(() => {
    const params = new URLSearchParams(searchString)
    const newParams = new URLSearchParams('')

    if (debouncedName === params.get('name')) {
      return
    }

    if (debouncedName === '' && params.get('name') === null) {
      return
    }

    if (debouncedName !== '') {
      newParams.set('name', debouncedName)
    }

    let url = window.location.pathname
    if (newParams.size > 0) {
      url += '?' + newParams.toString()
    }

    setLocation(url, { replace: true })
  }, [debouncedName, searchString, setLocation])

  const { data: results, isLoading } = useSWR(
    ['/levels', debouncedName, pageSize, (page - 1) * pageSize],
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

  return (
    <div className={styles.wrapper}>
      <h2>User Levels</h2>

      <input
        type="text"
        placeholder="Search"
        value={name}
        onChange={e => {
          setName(e.target.value)
        }}
      />

      <TheGrid
        isLoading={isLoading}
        results={results}
        thumbnailSize={thumbnailSize}
        game={game}
        decompressedLevels={decompressedLevels}
        name={name}
        page={page}
        searchString={searchString}
      />
    </div>
  )
}

LevelBrowser.defaultProps = {
  pageSize: 9
}
