export type Vec = [number, number]

export default class Interpolator {
  points: Vec[] = []

  calculate(x1: number, y1: number, x2: number, y2: number) {
    const xDiff = x1 - x2
    const yDiff = y1 - y2
    const xDiffIsLarger = Math.abs(xDiff) > Math.abs(yDiff)

    const xModifier = xDiff < 0 ? 1 : -1
    const yModifier = yDiff < 0 ? 1 : -1

    const upperBound = Math.max(Math.abs(xDiff), Math.abs(yDiff))
    const min = Math.min(Math.abs(xDiff), Math.abs(yDiff))
    const slope = (min === 0 || upperBound === 0) ? 0 : ((min + 1) / (upperBound + 1))

    this.points.length = 0

    let smallerCount = 0
    for (let i = 1; i <= upperBound; i++) {
      smallerCount = Math.floor(i * slope)

      let yIncrease = 0
      let xIncrease = 0

      if (xDiffIsLarger) {
        xIncrease = i
        yIncrease = smallerCount
      } else {
        yIncrease = i
        xIncrease = smallerCount
      }

      const currentY = y1 + (yIncrease * yModifier)
      const currentX = x1 + (xIncrease * xModifier)

      const p: Vec = [currentX, currentY]
      this.points.push(p)
    }

    return this.points
  }
}
