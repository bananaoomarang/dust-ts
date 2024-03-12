import { expect, test, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import BrushSelector from './BrushSelector'

test('renders learn react link', () => {
  const setBrushSize = vi.fn()
  render(<BrushSelector brushSize={0} setBrushSize={setBrushSize} />);
  const input = screen.getByLabelText(/Brush Size/i);
  expect(input).toBeInTheDocument()
});
