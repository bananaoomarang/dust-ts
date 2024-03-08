import Timer from './Timer'
import * as glUtil from './gl-util'
import vertShader from './shaders/vert.glsl?raw'
import fragShader from './shaders/frag.glsl?raw'

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

export default class Dust {
  gl: WebGLRenderingContext

  materials = {
    sand: {
      color: [9, 7, 2],
      friction: 0.99,
      density: 10
    },
    oil: {
      color: [5, 4, 1],
      bColors: [10, 4, 1, 8, 4, 1],
      friction: 1,
      liquid: true,
      density: 5
    },
    fire: {
      color: [10, 5, 0],
      bColors: [10, 5, 0, 9, 6, 1],
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
      bColors: [9, 7, 2, 10, 10, 3]
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
      bColors: [10, 7, 1, 7, 6, 1]
    },
    solid: {
      color: [0, 0, 0]
    },
    space: {
      density: 0
    }
  }

  timer = new Timer()

  sandVertices = new Float32Array(MAX_GRAINS * 3 * 6)
  grid = _create2dArray(WIDTH, HEIGHT)
  blacklist = _create2dArray(WIDTH, HEIGHT)

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

  move = (ox: number, oy: number, nx: number, ny: number) => {
    if (nx === 0 || nx >= WIDTH - 1 || ny === 0 || ny >= HEIGHT - 1) return

    const d = this.grid[ox][oy]

    this.grid[ox][oy] = 0
    this.grid[nx][ny] = d
    this.blacklist[nx][ny] = 1

    this.wakeSurrounds(ox, oy)
  }

  update = () => {
    let rx = Math.floor(Math.random() * 500) % (this.grid.length - 1)
    const xIncrement = 7

    for (let x = 1; x < this.grid.length - 1; x++) {
      let ry = Math.floor(Math.random() * 500) % (this.grid[x].length - 1)
      const yIncrement = 2

      rx = (rx + xIncrement) % (this.grid.length - 1)

      if (rx === 0 || rx === this.grid[x].length) continue

      for (let y = this.grid[x].length; y > 0; y--) {
        ry = (ry + yIncrement) % (this.grid.length - 1)

        if (ry === 0 || ry === this.grid[x].length) continue

        const d = this.grid[rx][ry]
        const xDir = Math.random() < 0.5 ? 1 : -1

        if (d === 0) continue

        if (this.blacklist[rx][ry]) continue

        if (d & SOLID) continue

        if (d & RESTING) continue

        if (this.grid[rx][ry + 1] === 0) { this.move(rx, ry, rx, ry + 1) }

        if (this.grid[rx + xDir][ry + 1] === 0) {
          this.move(rx, ry, rx + xDir, ry + 1)
        } else {
          // Check if the particle should be RESTING
          if (this.shouldLieDown(rx, ry)) {
            this.grid[rx][ry] |= RESTING
          }
        }
      }
    }

    this.clearBlacklist()
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

        if (s & BURNING) { color = (Math.random() > 0.1) ? [material.bColors[0], material.bColors[1], material.bColors[2]] : [material.bColors[3], material.bColors[4], material.bColors[5]] } else { color = material.color }

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
    if (s === 0) return this.materials.space
    if (s & SAND) return this.materials.sand
    if (s & OIL) return this.materials.oil
    if (s & FIRE) return this.materials.fire
    if (s & WATER) return this.materials.water
    if (s & STEAM) return this.materials.steam
    if (s & LAVA) return this.materials.lava
    if (s & LIFE) return this.materials.life
    if (s & C4) return this.materials.C4
    if (s & SOLID) return this.materials.solid

    return this.materials.space
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

  surrounded = (x: number, y: number) => {
    if (this.grid[x][y] === (this.grid[x + 1][y] && this.grid[x - 1][y] && this.grid[x][y + 1] &&
      this.grid[x][y - 1] && this.grid[x + 1][y + 1] && this.grid[x + 1][y - 1] && this.grid[x - 1][y + 1] && this.grid[x - 1][y - 1])) { return true } else { return false }
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

  spawnCircle = (x: number, y: number, type, brushSize: number, infect: boolean) => {
    const radius = brushSize || 10

    if (this.dustCount >= MAX_GRAINS && type !== 'eraser') return

    let nType
    const segments = 500
    const step = (2 * Math.PI) / segments

    if (infect && type !== 'eraser') {
      nType = (INFECTANT | this.getType(type))
    } else {
      nType = this.getType(type) || type
    }

    for (let r = 0; r < radius; r++) {
      for (let i = 0; i < 2 * Math.PI; i += step) {
        const spawnX = x + Math.floor(r * Math.sin(i))
        const spawnY = y + Math.floor(r * Math.cos(i))

        if (spawnX <= 0 || spawnY <= 0 || spawnX >= WIDTH - 1 || spawnY >= HEIGHT - 1) continue

        if (nType !== 'eraser') {
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

  getType = (typeString): number => {
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
