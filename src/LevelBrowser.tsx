import { useEffect, useState, MutableRefObject } from 'react'
import { useQuery } from '@tanstack/react-query'
import Dust, { Level } from './dust/Dust'
import Button from './Button'
import styles from './styles/LevelBrowser.module.css'

interface Props {
  game: MutableRefObject<Dust | null>
}

export default function LevelBrowser ({ game }: Props) {
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null)
  const { data: levels } = useQuery<Level[]>({
    queryKey: ['/levels'],
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

  return (
    <div className={styles.wrapper}>
      <h2>Saved Levels</h2>
      <div className={styles.rows}>
        {levels.map(row => (
          <Button
            className={styles.button}
            key={row.id}
            onClick={e => {
              (e.target as HTMLButtonElement).blur()

              if (selectedLevel === row.id && level && game.current) {
                game.current.loadLevel(level)
              } else {
                setSelectedLevel(row.id)
              }
            }}
          >
            {row.name}
          </Button>
        ))}
      </div>
    </div>
  )
}
