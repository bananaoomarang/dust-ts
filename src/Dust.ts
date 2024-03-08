import Timer from './Timer'
import Point from './Point'
import * as glUtil from './gl-util'
import vertShader from './shaders/vert.glsl?raw'
import fragShader from './shaders/frag.glsl?raw'
import Explosion from './Explosion'

const MAX_GRAINS = 100000
const WIDTH = 500
const HEIGHT = 500

const SAND = 1
const OIL = 2
const FIRE = 4
const LAVA = 8
const WATER = 16
const STEAM = 32
const SOLID = 64
const RESTING = 128
const BURNING = 256
const LIFE = 512
const INFECTANT = 1024
const C4 = 2048
const SPRING = (SOLID | WATER)
const VOLCANIC = (SOLID | LAVA)
const OIL_WELL = (SOLID | OIL)

type Material = {
  color: number[]
  density?: number
  friction?: number
  burnColors?: number[]
  liquid?: boolean
}

function _packColor (color: number[]) {
  return color[0] + color[1] * 256 + color[2] * 256 * 256
}

function _create2dArray (width: number, height: number): number[][] {
  const array: number[][] = []

  for (let x = 0; x < width; x++) {
    array[x] = []
    for (let y = 0; y < height; y++) {
      array[x][y] = 0
    }
  }

  return array
}

const MATERIALS: Record<string, Material> = {
  sand: {
    color: [9, 7, 2],
    friction: 0.99,
    density: 10
  },
  oil: {
    color: [5, 4, 1],
    burnColors: [10, 4, 1, 8, 4, 1],
    friction: 1,
    liquid: true,
    density: 5
  },
  fire: {
    color: [10, 5, 0],
    burnColors: [10, 5, 0, 9, 6, 1],
    friction: 1,
    density: -1
  },
  lava: {
    color: [10, 3, 0],
    liquid: true,
    density: 10
  },
  C4: {
    color: [2, 9, 1],
    burnColors: [9, 7, 2, 10, 10, 3]
  },
  water: {
    color: [0, 5, 10],
    friction: 1,
    liquid: true,
    density: 6
  },
  steam: {
    color: [6, 6, 6],
    density: -1,
    liquid: true
  },
  life: {
    color: [0, 10, 2],
    burnColors: [10, 7, 1, 7, 6, 1]
  },
  solid: {
    color: [0, 0, 0]
  },
  space: {
    color: [0, 0, 0, 0],
    density: 0
  }
}

export default class Dust {
  gl: WebGLRenderingContext


  timer = new Timer()

  sandVertices = new Float32Array(MAX_GRAINS * 3 * 6)
  grid = _create2dArray(WIDTH, HEIGHT)
  blacklist = _create2dArray(WIDTH, HEIGHT)
  explosions: Explosion[] = []

  lifeTimer = new Timer()
  lifeTime = 50

  dustCount = 0

  paused = false

  constructor(gl: WebGLRenderingContext) {
    this.gl = gl

    const shaderProgram = glUtil.getShaderProgram(gl, vertShader, fragShader)
    gl.useProgram(shaderProgram)

    const projectionMatrix = glUtil.makeProjectionMatrix(WIDTH, HEIGHT)
    const uModelViewProjectionMatrix = gl.getUniformLocation(shaderProgram, 'modelViewProjectionMatrix')
    const dustBuffer = gl.createBuffer()
    const positionAttribute = gl.getAttribLocation(shaderProgram, 'position')
    const colorAttribute = gl.getAttribLocation(shaderProgram, 'aColor')
    gl.enableVertexAttribArray(positionAttribute)
    gl.enableVertexAttribArray(colorAttribute)

    gl.bindBuffer(gl.ARRAY_BUFFER, dustBuffer)

    const modelViewMatrix = [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ]
    const mvpMatrix = glUtil.matrixMultiply(modelViewMatrix, projectionMatrix)
    gl.uniformMatrix3fv(uModelViewProjectionMatrix, false, mvpMatrix)

    gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 12, 0)
    gl.vertexAttribPointer(colorAttribute, 1, gl.FLOAT, false, 12, 8)
  }

  move = (pointA: Point, pointB: Point) => {
    if (
      pointB.x === 0 ||
      pointB.x >= WIDTH - 1 ||
      pointB.y === 0 ||
      pointB.y >= HEIGHT - 1
    ) {
      return
    }

    const d = this.grid[pointA.x][pointA.y]

    this.grid[pointA.x][pointA.y] = 0
    this.grid[pointB.x][pointB.y] = d
    this.blacklist[pointA.x][pointB.y] = 1

    this.wakeSurrounds(pointA.x, pointA.y)
  }

  swap = (x1: number, y1: number, x2: number, y2: number) => {
    if (x2 === 0 || x2 >= WIDTH - 1 || y2 === 0 || y2 >= HEIGHT - 1) return

    const d1 = this.grid[x1][y1]
    const d2 = this.grid[x2][y2]

    this.grid[x1][y1] = d2
    this.grid[x2][y2] = d1

    this.blacklist[x1][y1] = 1
    this.blacklist[x2][y2] = 1
  }

  update = () => {
    const self = this
    let lived = false

    let rx = Math.floor(Math.random() * 500) % (this.grid.length - 1)
    const xIncrement = 7

    for (let x = 1; x < this.grid.length - 1; x++) {
      let ry = Math.floor(Math.random() * 500) % (this.grid[x].length - 1)
      const yIncrement = 2

      rx = (rx + xIncrement) % (this.grid.length - 1)

      if (rx === 0 || rx === this.grid[x].length) continue

      for (let y = this.grid[x].length; y > 0; y--) {
        ry = (ry + yIncrement) % (this.grid.length - 1)

        // If we think we're gonna incur OOBE, get the HELL out of there.
        if (ry === 0 || ry === this.grid[x].length) continue

        const d = this.grid[rx][ry]
        const m = this.getMaterial(d)
        const xDir = Math.random() < 0.5 ? 1 : -1

        if (d === 0) continue

        if (this.blacklist[rx][ry]) continue

        // This is a spring
        if (d & WATER && d & SOLID) {
          this.infect(rx, ry, 0, WATER)
        }

        // Oil spring
        if (d & OIL && d & SOLID) {
          this.infect(rx, ry, 0, OIL)
        }

        // Lava spring
        if (d & LAVA && d & SOLID) {
          this.infect(rx, ry, 0, LAVA)
        }

        if (d & SOLID) continue

        for (let e = 0; e < this.explosions.length; e++) {
          const exp = this.explosions[e]

          if (!exp.updated) {
            exp.update()
            this.spawnCircle(exp.x, exp.y, FIRE, exp.radius)
          }

          if (exp.force === 0) {
            this.explosions.splice(e, 1)
            e--
          }
        }

        if (d & INFECTANT && !this.surrounded(rx, ry)) {
          this.runOnSurrounds(rx, ry, function (x, y) {
            const cell = self.grid[x][y]

            if (cell & INFECTANT) return

            if (x > 1 && x < WIDTH - 1 && y > 1 && y < HEIGHT - 1) {
              const rand = Math.random()

              if (cell !== 0 && rand > 0.91) self.spawn(x, y, d)
            }
          })
        }

        if (d & LIFE) {
          if (this.lifeTimer.getTime() >= this.lifeTime) {
            lived = true

            let neighbours = this.countNeighbours(rx, ry, true)

            if (neighbours < 2) this.destroy(rx, ry)
            if (neighbours > 3) this.destroy(rx, ry)

            this.runOnSurrounds(rx, ry, function (x, y) {
              if (x > 1 && x < WIDTH - 1 && y > 1 && y < HEIGHT - 1) {
                if (!self.blacklist[x][y] && self.grid[x][y] === 0) {
                  neighbours = self.countNeighbours(x, y)

                  if (neighbours === 3) {
                    self.spawn(x, y, LIFE)
                  }

                  // Not a misatake, this makes it work better
                  self.blacklist[x][y] = 1
                }
              }
            })
          }
        }

        if (d & FIRE) {
          if (Math.random() > 0.8) this.grid[rx][ry] |= BURNING
        }

        if (d & BURNING && Math.random() > 0.8 && !this.blacklist[rx][ry]) {
          if (d & C4) this.explode(rx, ry, 40, 100)

          this.destroy(rx, ry)
        } else {
          this.blacklist[rx][ry] = 1
        }

        // Burn baby burn
        if (d & FIRE || d & LAVA || d & BURNING) {
          this.infect(rx, ry, LIFE, BURNING)
          this.infect(rx, ry, C4, BURNING)

          if (Math.random() > 0.5) {
            this.infect(rx, ry, OIL, BURNING)
            this.infect(rx, ry, WATER, STEAM, WATER)
          }
        }

        if (d & LIFE || d & C4) continue

        // Chance that steam will condense + it will condense if it's surrounded by steam
        if (d & STEAM) {
          if (Math.random() > 0.9999) {
            this.spawn(rx, ry, WATER)
          } else if (this.surrounded(rx, ry)) {
            this.spawn(rx, ry, WATER)
          }
        }

        // Water baby... errr.... Water?
        if (d & WATER) {
          // Put out fires
          if (Math.random() > 0.5) {
            this.runOnSurrounds(rx, ry, this.destroy, FIRE)
            this.infect(rx, ry, BURNING, BURNING)
          }
        }

        const um = this.getMaterial(this.grid[rx][ry - 1])
        const uxDirm = this.getMaterial(this.grid[rx + xDir][ry - 1])

        if (
          typeof m.density !== 'undefined' && 
          typeof um.density !== 'undefined' &&
          typeof uxDirm.density !== 'undefined'
        ) {
          if (m.density < um.density) {
            if (d & FIRE) {
              this.swap(rx, ry, rx, ry - 1)
            } else if (Math.random() < 0.7) {
              this.swap(rx, ry, rx + xDir, ry - 1)
            } else if (Math.random() < 0.7) {
              this.swap(rx, ry, rx, ry - 1)
            }
          }
        }

        if (d & RESTING) continue

        if (this.grid[rx][ry + 1] === 0) {
          this.move({x: rx, y: ry}, { x: rx, y: ry + 1})
        }

        // NB This code is paraphrased from http://pok5.de/elementdots/js/dots.js, so full credit where it's due.
        if (m.liquid && rx + 3 < WIDTH && rx - 3 > 0) {
          const r1 = this.grid[rx + 1][ry]
          const r2 = this.grid[rx + 2][ry]
          const r3 = this.grid[rx + 3][ry]
          const l1 = this.grid[rx - 1][ry]
          const l2 = this.grid[rx - 2][ry]
          const l3 = this.grid[rx - 3][ry]
          const c = this.grid[rx][ry]

          const w = ((r1 === c) ? 1 : 0) + ((r2 === c) ? 1 : 0) + ((r3 === c) ? 1 : 0) - ((l1 === c) ? 1 : 0) - ((l2 === c) ? 1 : 0) - ((l3 === c) ? 1 : 0)

          if (w <= 0 && Math.random() < 0.5) {
            if (r1 === 0 && this.grid[rx + 1][ry - 1] !== c) {
              this.move({x: rx, y: ry}, {x: rx + 1, y: ry })
            } else if (r2 === 0 && this.grid[rx + 2][ry - 1] !== c) {
              this.move({x: rx, y: ry}, {x: rx + 2, y: ry})
            } else if (r3 === 0 && this.grid[rx + 3][ry - 1] !== c) {
              this.move({x: rx, y: ry}, {x: rx + 3, y: ry})
            }
          } else if (w >= 0 && Math.random() < 0.5) {
            if (l1 === 0 && this.grid[rx - 1][ry - 1] !== c) {
              this.move({x: rx, y: ry}, {x: rx - 1, y: ry})
            } else if (l2 === 0 && this.grid[rx - 2][ry - 1] !== c) {
              this.move({x: rx, y: ry}, {x: rx - 2, y: ry})
            } else if (l3 === 0 && this.grid[rx - 3][ry - 1] !== c) {
              this.move({x: rx, y: ry}, {x: rx - 3, y: ry})
            }
          }
        } else {
          if (this.grid[rx + xDir][ry + 1] === 0) {
            this.move({x: rx, y: ry}, {x: rx + xDir, y: ry + 1})
          } else {
            // Check if the particle should be RESTING
            if (this.shouldLieDown(rx, ry)) {
              this.grid[rx][ry] |= RESTING
            }
          }
        }
      }
    }

    this.clearBlacklist()

    for (let e = 0; e < this.explosions.length; e++) {
      this.explosions[e].updated = false
    }

    if (lived) {
      this.lifeTimer.reset()
      lived = false
    }
  }

  draw = () => {
    const { gl, sandVertices } = this

    let material
    let color
    let vertexCount = 0

    for (let x = 0; x < this.grid.length; x++) {
      for (let y = 0; y < this.grid[x].length; y++) {
        const s = this.grid[x][y]

        if (s === 0) continue

        material = this.getMaterial(s)

        if (s & BURNING && material.burnColors) {
          color = (Math.random() > 0.1)
            ? [material.burnColors[0], material.burnColors[1], material.burnColors[2]]
            : [material.burnColors[3], material.burnColors[4], material.burnColors[5]]
        } else {
          color = material.color
        }

        const offset = vertexCount * 3 * 6

        if (vertexCount < MAX_GRAINS) {
          this.sandVertices[offset] = x
          this.sandVertices[offset + 1] = y
          this.sandVertices[offset + 2] = _packColor(color)

          this.sandVertices[offset + 3] = x + 1
          this.sandVertices[offset + 4] = y
          this.sandVertices[offset + 5] = _packColor(color)

          this.sandVertices[offset + 6] = x
          this.sandVertices[offset + 7] = y + 1
          this.sandVertices[offset + 8] = _packColor(color)

          this.sandVertices[offset + 9] = x
          this.sandVertices[offset + 10] = y + 1
          this.sandVertices[offset + 11] = _packColor(color)

          this.sandVertices[offset + 12] = x + 1
          this.sandVertices[offset + 13] = y
          this.sandVertices[offset + 14] = _packColor(color)

          this.sandVertices[offset + 15] = x + 1
          this.sandVertices[offset + 16] = y + 1
          this.sandVertices[offset + 17] = _packColor(color)

          vertexCount++
        }
      }
    }

    gl.clear(gl.COLOR_BUFFER_BIT)
    gl.bufferData(gl.ARRAY_BUFFER, sandVertices, gl.STATIC_DRAW)
    gl.drawArrays(gl.TRIANGLES, 0, vertexCount * 6)
  }

  run = () => {
    if (!this.paused) {
      this.update()
    }

    this.draw()
    this.timer.reset()

    window.requestAnimationFrame(this.run)
  }

  getMaterial = (s: number) => {
    if (s === 0) return MATERIALS.space
    if (s & SAND) return MATERIALS.sand
    if (s & OIL) return MATERIALS.oil
    if (s & FIRE) return MATERIALS.fire
    if (s & WATER) return MATERIALS.water
    if (s & STEAM) return MATERIALS.steam
    if (s & LAVA) return MATERIALS.lava
    if (s & LIFE) return MATERIALS.life
    if (s & C4) return MATERIALS.C4
    if (s & SOLID) return MATERIALS.solid

    return MATERIALS.space
  }

  clearBlacklist = () => {
    for (let x = 0; x < this.blacklist.length; x++) {
      for (let y = 0; y < this.blacklist[x].length; y++) {
        this.blacklist[x][y] = 0
      }
    }
  }


  wakeSurrounds = (x: number, y: number) => {
    if (this.grid[x][y] & RESTING) this.grid[x][y] ^= RESTING
    if (this.grid[x][y - 1] & RESTING) this.grid[x][y - 1] ^= RESTING
    if (this.grid[x + 1][y] & RESTING) this.grid[x + 1][y] ^= RESTING
    if (this.grid[x][y + 1] & RESTING) this.grid[x][y + 1] ^= RESTING
    if (this.grid[x - 1][y] & RESTING) this.grid[x - 1][y] ^= RESTING
    if (this.grid[x + 1][y + 1] & RESTING) this.grid[x + 1][y + 1] ^= RESTING
    if (this.grid[x - 1][y + 1] & RESTING) this.grid[x - 1][y + 1] ^= RESTING
  }

  spawn = (x: number, y: number, type: number) => {
    if (x === 0 || x === WIDTH - 1 || y === 0 || y === HEIGHT - 1 || this.grid[x][y] & type) return

    if (this.dustCount <= MAX_GRAINS && this.grid[x][y] === 0) {
      this.dustCount++

      this.grid[x][y] = type
      this.blacklist[x][y] = 1
      this.wakeSurrounds(x, y)
    } else if (this.grid[x][y] !== 0) {
      this.grid[x][y] = type
      this.blacklist[x][y] = 1
      this.wakeSurrounds(x, y)
    }
  }

  destroy = (x: number, y: number) => {
    if (this.grid[x][y] !== 0) {
      this.dustCount--

      this.grid[x][y] = 0

      this.wakeSurrounds(x, y)
    }
  }

  infect = (x: number, y: number, flagSet: number, flagToSet: number, flagToRemove?: number) => {
    const n = this.grid[x][y - 1]
    const ne = this.grid[x + 1][y - 1]
    const e = this.grid[x + 1][y]
    const se = this.grid[x + 1][y + 1]
    const s = this.grid[x][y + 1]
    const sw = this.grid[x - 1][y + 1]
    const w = this.grid[x - 1][y]
    const nw = this.grid[x - 1][y - 1]

    if (flagSet === -1) {
      // Infect ANYTHING apart from NOTHING
      if (n !== 0) this.spawn(x, y - 1, flagToSet)
      if (ne !== 0) this.spawn(x + 1, y - 1, flagToSet)
      if (e !== 0) this.spawn(x + 1, y, flagToSet)
      if (se !== 0) this.spawn(x + 1, y + 1, flagToSet)
      if (s !== 0) this.spawn(x, y + 1, flagToSet)
      if (sw !== 0) this.spawn(x - 1, y + 1, flagToSet)
      if (w !== 0) this.spawn(x - 1, y, flagToSet)
      if (nw !== 0) this.spawn(x - 1, y - 1, flagToSet)
    } else if (flagSet === 0) {
      // Infect just NOTHING (air)
      if (n === flagSet) this.spawn(x, y - 1, flagToSet)
      if (ne === flagSet) this.spawn(x + 1, y - 1, flagToSet)
      if (e === flagSet) this.spawn(x + 1, y, flagToSet)
      if (se === flagSet) this.spawn(x + 1, y + 1, flagToSet)
      if (s === flagSet) this.spawn(x, y + 1, flagToSet)
      if (sw === flagSet) this.spawn(x - 1, y + 1, flagToSet)
      if (w === flagSet) this.spawn(x - 1, y, flagToSet)
      if (nw === flagSet) this.spawn(x - 1, y - 1, flagToSet)
    } else {
      // Infect everything with the flag
      if (n & flagSet) this.grid[x][y - 1] |= flagToSet
      if (ne & flagSet) this.grid[x + 1][y - 1] |= flagToSet
      if (e & flagSet) this.grid[x + 1][y] |= flagToSet
      if (se & flagSet) this.grid[x + 1][y + 1] |= flagToSet
      if (s & flagSet) this.grid[x][y + 1] |= flagToSet
      if (sw & flagSet) this.grid[x - 1][y + 1] |= flagToSet
      if (w & flagSet) this.grid[x - 1][y] ^= flagToSet
      if (nw & flagSet) this.grid[x - 1][y - 1] |= flagToSet
    }

    // Remove an optional flag
    if (flagToRemove) {
      if (n & flagSet) this.grid[x][y - 1] &= ~flagToRemove
      if (ne & flagSet) this.grid[x + 1][y - 1] &= ~flagToRemove
      if (e & flagSet) this.grid[x + 1][y] &= ~flagToRemove
      if (se & flagSet) this.grid[x + 1][y + 1] &= ~flagToRemove
      if (s & flagSet) this.grid[x][y + 1] &= ~flagToRemove
      if (sw & flagSet) this.grid[x - 1][y + 1] &= ~flagToRemove
      if (w & flagSet) this.grid[x - 1][y] &= ~flagToRemove
      if (nw & flagSet) this.grid[x - 1][y - 1] &= ~flagToRemove
    }
  }

  surrounded = (x: number, y: number) => {
    if (this.grid[x][y] === (this.grid[x + 1][y] && this.grid[x - 1][y] && this.grid[x][y + 1] &&
      this.grid[x][y - 1] && this.grid[x + 1][y + 1] && this.grid[x + 1][y - 1] && this.grid[x - 1][y + 1] && this.grid[x - 1][y - 1])) { return true } else { return false }
  }


  //
  // Runs a function on surrounding particles providing a flag is set
  //
  runOnSurrounds = (x: number, y: number, f: (x: number, y: number) => void, flag?: number) => {
    const n = this.grid[x][y - 1]
    const ne = this.grid[x + 1][y - 1]
    const e = this.grid[x + 1][y]
    const se = this.grid[x + 1][y + 1]
    const s = this.grid[x][y + 1]
    const sw = this.grid[x - 1][y + 1]
    const w = this.grid[x - 1][y]
    const nw = this.grid[x - 1][y - 1]

    if (flag) {
      if (n & flag) f(x, y - 1)
      if (ne & flag) f(x + 1, y - 1)
      if (e & flag) f(x + 1, y)
      if (se & flag) f(x + 1, y + 1)
      if (s & flag) f(x, y + 1)
      if (sw & flag) f(x - 1, y + 1)
      if (w & flag) f(x - 1, y)
      if (nw & flag) f(x - 1, y - 1)
    } else {
      f(x, y - 1)
      f(x + 1, y - 1)
      f(x + 1, y)
      f(x + 1, y + 1)
      f(x, y + 1)
      f(x - 1, y + 1)
      f(x - 1, y)
      f(x - 1, y - 1)
    }
  }

  countNeighbours = (x: number, y: number, exclusive: boolean = false) => {
    const d = this.grid[x][y]
    const n = this.grid[x][y - 1]
    const ne = this.grid[x + 1][y - 1]
    const e = this.grid[x + 1][y]
    const se = this.grid[x + 1][y + 1]
    const s = this.grid[x][y + 1]
    const sw = this.grid[x - 1][y + 1]
    const w = this.grid[x - 1][y]
    const nw = this.grid[x - 1][y - 1]

    let count = 0

    if (exclusive) {
      // Then only count cells of the same type
      if (n === d) count++
      if (ne === d) count++
      if (e === d) count++
      if (se === d) count++
      if (s === d) count++
      if (sw === d) count++
      if (w === d) count++
      if (nw === d) count++
    } else {
      if (n !== 0) count++
      if (ne !== 0) count++
      if (e !== 0) count++
      if (se !== 0) count++
      if (s !== 0) count++
      if (sw !== 0) count++
      if (w !== 0) count++
      if (nw !== 0) count++
    }

    return count
  }

  shouldLieDown = (x: number, y: number) => {
    if (!this.surrounded(x, y)) return false

    while (y <= HEIGHT) {
      if (this.grid[x][y] & SOLID) {
        return true
      } else if (this.grid[x][y] === 0) {
        return false
      }

      y++
    }
  }

  explode = (x: number, y: number, f: number, r: number) => {
    const explosion = new Explosion(x, y, f, r)
    this.explosions.push(explosion)
  }

  spawnCircle = (x: number, y: number, type: string | number, brushSize: number, infect: boolean = false) => {
    const radius = brushSize || 10

    if (this.dustCount >= MAX_GRAINS && type !== 'eraser') return

    let nType = typeof type === 'string' ? this.getType(type) : type
    const segments = 500
    const step = (2 * Math.PI) / segments

    if (infect && type !== 'eraser') {
      nType = (INFECTANT | nType)
    }

    for (let r = 0; r < radius; r++) {
      for (let i = 0; i < 2 * Math.PI; i += step) {
        const spawnX = x + Math.floor(r * Math.sin(i))
        const spawnY = y + Math.floor(r * Math.cos(i))

        if (spawnX <= 0 || spawnY <= 0 || spawnX >= WIDTH - 1 || spawnY >= HEIGHT - 1) continue

        if (type !== 'space') {
          this.spawn(spawnX, spawnY, nType)
        } else {
          if (this.grid[spawnX][spawnY] !== 0) {
            this.destroy(spawnX, spawnY)
            this.wakeSurrounds(spawnX, spawnY)
          }
        }
      }
    }
  }

  getType = (typeString: string): number => {
    switch (typeString) {
      case 'eraser':
        return 0
      case 'sand':
        return SAND
      case 'oil':
        return OIL
      case 'fire':
        return FIRE
      case 'lava':
        return LAVA
      case 'water':
        return WATER
      case 'solid':
        return SOLID
      case 'spring':
        return SPRING
      case 'volcanic':
        return VOLCANIC
      case 'oil well':
        return OIL_WELL
      case 'life':
        return LIFE
      case 'C4':
        return C4
      default:
        return 0
    }
  }
}
