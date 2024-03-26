import { AriaRole, Dispatch, MouseEventHandler, SetStateAction } from 'react'
import classNames from 'classnames'
import { BrushModifier, BrushType } from './dust/Dust'
import Button from './Button'
import styles from './styles/MaterialSelector.module.css'

type BaseMaterialSelector = {
  label: string
  value: BrushType
  emoji: string
}

type ModifierSelector = {
  label: string
  value: BrushModifier
  emoji: string
}

const TYPES: BaseMaterialSelector[] = [
  {
    label: 'Sand',
    value: 'Sand',
    emoji: '⏳'
  },
  {
    label: 'Oil',
    value: 'Oil',
    emoji: '🫗'
  },
  {
    label: 'Fire',
    value: 'Fire',
    emoji: '🔥'
  },
  {
    label: 'Water',
    value: 'Water',
    emoji: '🌊'
  },
  {
    label: 'Solid',
    value: 'Solid',
    emoji: '🧱'
  },
  {
    label: 'Lava',
    value: 'Lava',
    emoji: '♨️'
  },
  {
    label: 'Spring',
    value: 'Spring',
    emoji: '🚰'
  },
  {
    label: 'Volcanic',
    value: 'Volcanic',
    emoji: '🌋'
  },
  {
    label: 'Oil Well',
    value: 'OilWell',
    emoji: '🛢'
  },
  {
    label: 'Fuse',
    value: 'Fuse',
    emoji: '💣'
  },
  {
    label: 'Life Itself',
    value: 'Life',
    emoji: '🛸'
  },
  {
    label: 'C4',
    value: 'C4',
    emoji: '💥'
  },
  {
    label: 'Eraser',
    value: 'Space',
    emoji: '🫥'
  }
]

interface RowProps {
  type: BaseMaterialSelector | ModifierSelector
  selected: boolean
  onClick: MouseEventHandler<HTMLButtonElement>
  role: AriaRole
}

interface MaterialSelectorProps {
  selected: BrushType
  setSelected: Dispatch<SetStateAction<BrushType>>
  infect: boolean
  setInfect: Dispatch<SetStateAction<boolean>>
}

const Row = ({ type, selected, onClick, role }: RowProps) => {
  return (
    <Button
      className={classNames(styles.button, { [styles.selected]: selected })}
      onClick={onClick}
      role={role}
    >
      <span className={styles.labelText}>{type.label}</span>
      {type.emoji && <span className={styles.emoji}>{type.emoji}</span>}
    </Button>
  )
}

Row.defaultProps = { role: "button" }

function MaterialSelector ({ selected, setSelected, infect, setInfect }: MaterialSelectorProps) {
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
          onClick={() => {
            document.activeElement && (document.activeElement as HTMLButtonElement).blur()
            setInfect(!infect)
          }}
          role='switch'
        />
      </div>
    </div>
  )
}

export default MaterialSelector
