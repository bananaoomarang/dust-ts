export default class Explosion {
  x: number
  y: number
  force: number
  radiusLimit: number
  radius = 0
  updated: boolean = false

  constructor(x: number, y: number, force: number, radius: number) {
    this.x = x
    this.y = y
    this.force = force
    this.radiusLimit = radius
  }

  update = () => {
    this.radius += this.force

    this.updated = true

    if (this.radius >= this.radiusLimit) {
      this.force = 0
    }
  }
}
