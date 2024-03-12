import { useEffect, useState, MutableRefObject } from 'react'
import { useQuery } from '@tanstack/react-query'
import Dust, { Level } from './dust/Dust'

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
  }, [level])

  return (
    <div>
      {levels.map(row => <div key={row.id} onClick={() => setSelectedLevel(row.id)}>{row.name}</div>)}
    </div>
  )
}
