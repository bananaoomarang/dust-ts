import styles from './styles/MaterialSelector.module.css'

type BrushType = {
  label: string
  value?: string
  emoji: string
}

const TYPES: BrushType[] = [
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
    value: 'eraser',
    emoji: '🫥'
  }
]

interface LabelProps {
  type: BrushType
  inputProps: Record<string, any>
}

interface MaterialSelectorProps {
  selected: string
  setSelected: Function
  infect: boolean
  setInfect: Function
}

const Label = ({ type, inputProps }: LabelProps) => (
  <label className={styles.label}>
    <span>
      <input
        className={styles.input}
        type="radio"
        {...inputProps}
      />
      <span className={styles.labelText}>{type.label}</span>
    </span>
    {type.emoji && <span className={styles.emoji}>{type.emoji}</span>}
  </label>
)

function BrushSelector ({ selected, setSelected, infect, setInfect }: MaterialSelectorProps) {
  return (
    <form className={styles.wrapper}>
      {
        TYPES.map(type => (
          <Label
            key={type.value}
            type={type}
            inputProps={{
              checked: selected === type.value,
              onChange: () => setSelected(type.value),
              value: type.value
            }}
          />
        ))
      }
      <Label
        type={{
          label: 'Infectant',
          emoji: '🦠'
        }}
        inputProps={{
          type: 'checkbox',
          checked: infect,
          onChange: () => setInfect(!infect)
        }}
      />
    </form>
  )
}

export default BrushSelector
