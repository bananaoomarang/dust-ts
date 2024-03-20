export default function interpolate(x1: f64, y1: f64, x2: f64, y2: f64): Array<Array<f64>> {
  const xDiff = x1 - x2
  const yDiff = y1 - y2
  const xDiffIsLarger = Math.abs(xDiff) > Math.abs(yDiff)

  const xModifier = xDiff < 0 ? 1 : -1
  const yModifier = yDiff < 0 ? 1 : -1

  const upperBound = Math.max(Math.abs(xDiff), Math.abs(yDiff))
  const min = Math.min(Math.abs(xDiff), Math.abs(yDiff))
  const slope = (min === 0 || upperBound === 0) ? 0 : ((min + 1) / (upperBound + 1))

  const points = new Array<Array<f64>>(upperBound as i32)

  let smallerCount: f64 = 0
  for (let i = 1; i <= upperBound; i++) {
    smallerCount = Math.floor(i * slope)

    let yIncrease: f64 = 0
    let xIncrease: f64 = 0

    if (xDiffIsLarger) {
      xIncrease = i as f64
      yIncrease = smallerCount
    } else {
      yIncrease = i as f64
      xIncrease = smallerCount
    }

    const currentY = y1 + (yIncrease * yModifier)
    const currentX = x1 + (xIncrease * xModifier)

    const p = [currentX, currentY]
    points.push(p)
  }

  return points
}
