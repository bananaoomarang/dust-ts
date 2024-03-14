import { useState } from 'react'
import { useSWRConfig } from 'swr'
import useSWRMutation from 'swr/mutation'
import api from './api'
import Button from './Button'
import Dust, { LevelReq } from './dust/Dust'
import { MutableRefObject } from 'react'
import styles from './styles/LevelSaver.module.css'

interface Props {
  game: MutableRefObject<Dust | null>
}

function saveLevel (path: string, { arg: newLevel }: { arg: LevelReq }) {
  return api
    .url(path)
    .post(newLevel)
    .res()
}

export default function LevelSaver ({ game }: Props) {
  const [name, setName] = useState('')

  const { mutate } = useSWRConfig()
  const { trigger, error, isMutating } = useSWRMutation('/levels', saveLevel, {
    onSuccess: () => mutate(key => Array.isArray(key) && key[0] === '/levels')
  })

  if (isMutating) return 'Saving...'
  if (error) return 'Failed to save...'

  return (
    <form className={styles.wrapper} onSubmit={async e => {
      e.preventDefault()
      if (!game.current) {
        return
      }

      const data = await game.current.exportGrid()
      trigger({ name, data })
    }}>
      <label>
        <span className={styles.label}>Level Name</span>
        <input className={styles.input} value={name} onChange={e => setName(e.target.value)} />
      </label>

      <Button className={styles.button} type="submit">Save Level</Button>
    </form>
  )
}
