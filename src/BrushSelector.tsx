const TYPES = [
  {
    label: 'Sand',
    value: 'sand'
  },
  {
    label: 'Oil',
    value: 'oil'
  },
  {
    label: 'Fire',
    value: 'fire'
  },
  {
    label: 'Water',
    value: 'water'
  },
  {
    label: 'Solid',
    value: 'solid'
  },
  {
    label: 'Lava',
    value: 'lava'
  },
  {
    label: 'Spring',
    value: 'spring'
  },
  {
    label: 'Volcanic',
    value: 'volcanic'
  },
  {
    label: 'Oil Well',
    value: 'oil well'
  },
  {
    label: 'Life Itself',
    value: 'life'
  },
  {
    label: 'C4 💥',
    value: 'C4'
  },
  {
    label: 'Eraser',
    value: 'eraser'
  }
]

interface BrushSelectorProps {
  selected: string
  setSelected: Function
  infect: boolean
  setInfect: Function
}

function BrushSelector ({ selected, setSelected, infect, setInfect }: BrushSelectorProps) {
  return (
    <form>
      {
        TYPES.map(type => (
          <label key={type.value}>
            <input
              type="radio"
              value={type.value}
              checked={selected === type.value}
              onChange={() => setSelected(type.value)}
            />
            {type.label}
          </label>
        ))
      }
      <label>
        <input type="checkbox" checked={infect} onChange={() => setInfect(!infect)} />
        Infectant
      </label>
    </form>
  )
}

export default BrushSelector
