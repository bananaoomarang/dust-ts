import { expect, test, describe, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import BrushSelector from '../BrushSelector'

describe('BrushSelector', () => {
  const setBrushSize = vi.fn()
  const setGravity = vi.fn()

  test('Can change brush size', () => {
    render(<BrushSelector brushSize={0} setBrushSize={setBrushSize} gravity={0} setGravity={setGravity} />);

    const input = screen.getByLabelText(/Brush Size/i);
    fireEvent.change(input, { target: { value: '43' }})

    expect(setBrushSize).toBeCalledWith(43)
  })

  test('Can change gravity', () => {
    render(<BrushSelector brushSize={0} setBrushSize={setBrushSize} gravity={0} setGravity={setGravity} />);

    const input = screen.getByLabelText(/Gravity/i);
    fireEvent.change(input, { target: { value: '45' }})

    expect(setGravity).toBeCalledWith(45)
  })
})
