import { expect, test, describe, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import MaterialSelector from '../MaterialSelector'
import styles from '../styles/MaterialSelector.module.css'

describe('MaterialSelectorBehaves', () => {
  const setSelected = vi.fn()
  const setInfect = vi.fn()

  test('Can change selection', () => {
    render(<MaterialSelector selected='sand' setSelected={setSelected} infect={false} setInfect={setInfect} />)

    fireEvent.click(screen.getByRole('button', {name: /water/i}))
    fireEvent.click(screen.getByRole('switch', {name: /infectant/i}))

    expect(setSelected).toBeCalledWith('water')
    expect(setInfect).toBeCalledWith(true)
  })

  test('Shows selection', () => {
    render(<MaterialSelector selected='water' setSelected={setSelected} infect={true} setInfect={setInfect} />)

    expect(screen.getByRole('button', {name: /water/i})).toHaveClass(styles.selected)
    expect(screen.getByRole('switch', {name: /infectant/i})).toHaveClass(styles.selected)
  })
  
})
