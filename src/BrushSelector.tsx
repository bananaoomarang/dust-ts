import { Dispatch, SetStateAction } from 'react'
import Input from './Input'
import styles from './styles/BrushSelector.module.css'

interface BrushSelectorProps {
  brushSize: number
  setBrushSize: Dispatch<SetStateAction<number>>

  gravity: number
  setGravity: Dispatch<SetStateAction<number>>
}

export default function BrushSelector({ brushSize, setBrushSize, gravity, setGravity}: BrushSelectorProps) {
  return (
    <div className={styles.wrapper}>
      <label>
        <div>Brush Size: {brushSize}</div>
        <Input type="range" min="1" max="200" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} />
      </label>

      <label>
        <div>Gravity: {gravity}</div>
        <Input type="range" min="0" max="360" value={gravity} onChange={e => setGravity(Number(e.target.value))} />
      </label>
    </div>
  )
}
