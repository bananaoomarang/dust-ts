import { expect, test, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import BrushSelector from '../BrushSelector'

test('Can change brush size', () => {
  const setBrushSize = vi.fn()
  render(<BrushSelector brushSize={0} setBrushSize={setBrushSize} />);

  const input = screen.getByLabelText(/Brush Size/i);
  fireEvent.change(input, { target: { value: '43' }})

  expect(setBrushSize).toBeCalledWith(43)
});
