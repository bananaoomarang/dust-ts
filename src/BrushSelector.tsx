import { Dispatch, SetStateAction } from 'react'
import styles from './styles/BrushSelector.module.css'

interface BrushSelectorProps {
  brushSize: number
  setBrushSize: Dispatch<SetStateAction<number>>
}

export default function BrushSelector({ brushSize, setBrushSize }: BrushSelectorProps) {
  return (
    <div className={styles.wrapper}>
      <label>
        <div>Brush Size: {brushSize}</div>
        <input type="range" min="1" max="200" value={brushSize} onChange={e => setBrushSize(Number(e.target.value))} />
      </label>
    </div>
  )
}
