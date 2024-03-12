import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from './api'
import Dust, { LevelReq } from './dust/Dust'
import { MutableRefObject } from 'react'

interface Props {
  game: MutableRefObject<Dust | null>
}

export default function LevelSaver ({ game }: Props) {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')

  const mutation = useMutation({
    mutationFn: (newLevel: LevelReq) => api.url("/levels").post(newLevel).res(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/levels'], exact: true })
    }
  })

  if (mutation.isPending) return 'Saving...'
  if (mutation.error) return 'Failed to save...'

  return (
    <div>
      <label>
        Level name
        <input value={name} onChange={e => setName(e.target.value)} />
      </label>
      <button onClick={() => {
        if (!game.current) {
          return
        }

        mutation.mutate({name, data: JSON.stringify(game.current.grid)})
      }}>
        Save Level
      </button>
    </div>
  )
}
