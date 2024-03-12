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
