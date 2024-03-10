import { AriaRole, MouseEventHandler, useRef } from 'react'
import classNames from 'classnames'
import { BrushModifier, BrushType } from './dust/Dust'
import styles from './styles/MaterialSelector.module.css'

type BrushSelectorType = {
  label: string
  value: BrushType | BrushModifier
  emoji: string
}

const TYPES: BrushSelectorType[] = [
  {
    label: 'Sand',
    value: 'sand',
    emoji: '⏳'
  },
  {
    label: 'Oil',
    value: 'oil',
    emoji: '🫗'
  },
  {
    label: 'Fire',
    value: 'fire',
    emoji: '🔥'
  },
  {
    label: 'Water',
    value: 'water',
    emoji: '🌊'
  },
  {
    label: 'Solid',
    value: 'solid',
    emoji: '🧱'
  },
  {
    label: 'Lava',
    value: 'lava',
    emoji: '♨️'
  },
  {
    label: 'Spring',
    value: 'spring',
    emoji: '🚰'
  },
  {
    label: 'Volcanic',
    value: 'volcanic',
    emoji: '🌋'
  },
  {
    label: 'Oil Well',
    value: 'oil well',
    emoji: '🛢'
  },
  {
    label: 'Life Itself',
    value: 'life',
    emoji: '🛸'
  },
  {
    label: 'C4',
    value: 'C4',
    emoji: '💥'
  },
  {
    label: 'Eraser',
    value: 'space',
    emoji: '🫥'
  }
]

interface RowProps {
  type: BrushSelectorType
  selected: boolean
  onClick: MouseEventHandler<HTMLButtonElement>
  role: AriaRole
}

interface MaterialSelectorProps {
  selected: BrushType
  setSelected: Function
  infect: boolean
  setInfect: Function
}

const Row = ({ type, selected, onClick, role }: RowProps) => {
  const ref = useRef(null)

  return (
    <button
      ref={ref}
      className={classNames(styles.button, { [styles.selected]: selected })}
      onClick={onClick}
      role={role}
    >
      <span className={styles.labelText}>{type.label}</span>
      {type.emoji && <span className={styles.emoji}>{type.emoji}</span>}
    </button>
  )
}

Row.defaultProps = { role: "button" }

function BrushSelector ({ selected, setSelected, infect, setInfect }: MaterialSelectorProps) {
  return (
    <div className={styles.wrapper}>
      <div className={styles.types}>
        {
          TYPES.map(type => (
            <Row
              key={type.value}
              type={type}
              selected={selected === type.value}
              onClick={() => setSelected(type.value)}
            />
          ))
        }
      </div>
      <div className={styles.modifiers}>
        <Row
          type={{
            label: 'Infectant',
            value: 'infectant',
            emoji: '🦠'
          }}
          selected={infect}
          onClick={_ => {
            document.activeElement && (document.activeElement as HTMLButtonElement).blur()
            setInfect(!infect)
          }}
          role='switch'
        />
      </div>
    </div>
  )
}

export default BrushSelector
