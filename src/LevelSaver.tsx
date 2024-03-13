import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from './api'
import Button from './Button'
import Dust, { LevelReq } from './dust/Dust'
import { MutableRefObject } from 'react'
import styles from './styles/LevelSaver.module.css'

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
    <form className={styles.wrapper} onSubmit={async e => {
      e.preventDefault()
      if (!game.current) {
        return
      }

      const data = await game.current.exportGrid()
      console.log(data)
      mutation.mutate({name, data})
    }}>
      <label>
        <span className={styles.label}>Level Name</span>
        <input className={styles.input} value={name} onChange={e => setName(e.target.value)} />
      </label>

      <Button className={styles.button} type="submit">Save Level</Button>
    </form>
  )
}
