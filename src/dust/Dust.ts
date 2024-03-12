import Timer from './Timer'
import * as glUtil from './gl-util'
import vertShader from './shaders/vert.glsl?raw'
import fragShader from './shaders/frag.glsl?raw'
import Explosion from './Explosion'

const WIDTH = 500
const HEIGHT = 500
const MAX_GRAINS = WIDTH * HEIGHT

const SAND = 1
const OIL = 2
const FIRE = 4
const LAVA = 8
const WATER = 16
const STEAM = 32
const SOLID = 64
const BURNING = 256
const LIFE = 512
const INFECTANT = 1024
const C4 = 2048
const SPRING = (SOLID | WATER)
const VOLCANIC = (SOLID | LAVA)
const OIL_WELL = (SOLID | OIL)

export type Level = {
  id: number
  name: string
  data: string
}

export type LevelReq = {
  name: string
  data: string
}

type Material = {
  color: number[]
  density?: number
  friction?: number
  burnColors?: number[]
  liquid?: boolean
}

export type BrushType = "sand" | "oil" | "fire" | "lava" | "water" | "steam" | "solid" | "life" | "C4" | "spring" | "volcanic" | "oil well" | "space"

export type BrushModifier = "burning" | "infectant"

type Brush  = {
  x: number
  y: number
  type: BrushType
  size: number
  infect?: boolean
}

function _setPixel(
  data: Uint8Array,
  offset: number,
  r: number,
  g: number,
  b: number,
  a: number = 1
) {
  data[offset] = r
  data[offset + 1] = g
  data[offset + 2] = b
  data[offset + 3] = a
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
    color: [230, 179, 51],
    friction: 0.99,
    density: 10
  },
  oil: {
    color: [128, 102, 26],
    burnColors:  [255, 102, 26, 204, 102, 26 ],
    friction: 1,
    liquid: true,
    density: 5
  },
  fire: {
    color: [255, 128, 0],
    burnColors: [255, 128, 0, 230, 153, 26],
    friction: 1,
    density: -1
  },
  lava: {
    color: [255, 77, 0],
    liquid: true,
    density: 10
  },
  C4: {
    color: [51, 230, 26],
    burnColors: [230, 179, 51, 255, 255, 77]
  },
  water: {
    color: [0, 128, 255],
    friction: 1,
    liquid: true,
    density: 6
  },
  steam: {
    color: [153, 153, 153],
    density: -1,
    liquid: true
  },
  life: {
    color: [0, 255, 51],
    burnColors: [255, 179, 26, 179, 153, 26]
  },
  solid: {
    color: [0, 0, 0]
  },
  space: {
    color: [0, 0, 0, 0],
    density: 0
  }
}

interface DustConstructor {
  gl: WebGLRenderingContext,
  fpsNode: HTMLElement | null
}

export default class Dust {
  gl: WebGLRenderingContext

  fpsTimer = new Timer()
  frameCounter = 0

  sandVertices = new Float32Array([
    0, 0,
    0, 500,
    500, 0,
    500, 0,
    0, 500,
    500, 500
  ])

  texcoords = new Float32Array([
    0, 1,
    1, 1,
    0, 0,

    0, 0,
    1, 1,
    1, 0
  ])

  positionBuffer: WebGLBuffer | null
  texcoordBuffer: WebGLBuffer | null
  texture: WebGLTexture | null
  textureLocation: WebGLUniformLocation | null
  texcoordLocation: WebGLUniformLocation | null
  textureData = new Uint8Array(500 * 500 * 4)

  grid = _create2dArray(WIDTH, HEIGHT)
  blacklist = _create2dArray(WIDTH, HEIGHT)
  explosions: Explosion[] = []

  lifeTimer = new Timer()
  lifeTime = 50

  dustCount = 0

  paused = false

  fpsNode: HTMLElement | null

  activeBrushes: Record<number, Brush> = {}

  constructor({ gl, fpsNode }: DustConstructor) {
    this.gl = gl
    this.fpsNode = fpsNode

    const shaderProgram = glUtil.getShaderProgram(gl, vertShader, fragShader)
    gl.useProgram(shaderProgram)

    const projectionMatrix = glUtil.makeProjectionMatrix(WIDTH, HEIGHT)
    const uModelViewProjectionMatrix = gl.getUniformLocation(shaderProgram, 'uModelViewProjectionMatrix')
    this.textureLocation = gl.getUniformLocation(shaderProgram, 'uTexture')
    this.texcoordLocation = gl.getAttribLocation(shaderProgram, 'aTexCoord')
    const positionAttribute = gl.getAttribLocation(shaderProgram, 'aPosition')
    const modelViewMatrix = [
      1, 0, 0,
      0, 1, 0,
      0, 0, 1
    ]
    const mvpMatrix = glUtil.matrixMultiply(modelViewMatrix, projectionMatrix)

    this.positionBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.enableVertexAttribArray(positionAttribute)
    gl.uniformMatrix3fv(uModelViewProjectionMatrix, false, mvpMatrix)
    gl.vertexAttribPointer(positionAttribute, 2, gl.FLOAT, false, 0, 0)

    this.texcoordBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, this.texcoordBuffer)
    gl.enableVertexAttribArray(this.texcoordLocation as number)
    gl.vertexAttribPointer(this.texcoordLocation as number, 2, gl.FLOAT, false, 0, 0)

    this.texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);

    if (!this.texture) {
      throw new Error('Could not create texture')
    }
  }

  run = () => {
    const { fpsTimer, fpsNode } = this

    this.handleMice()

    if (!this.paused) {
      this.update()
    }

    this.draw()

    this.frameCounter++
    if (fpsTimer.getTime() > 1000) {
      if (fpsNode) {
        fpsNode.innerHTML = `${this.frameCounter}fps`
      }
      fpsTimer.reset()
      this.frameCounter = 0
    }

    window.requestAnimationFrame(this.run)
  }

  loadLevel = (level: Level) => {
    const data = JSON.parse(level.data)
    this.grid = data
  }


  private move(x1: number, y1: number, x2: number, y2: number): void {
    if (
      x2 === 0 ||
      x2 >= WIDTH - 1 ||
      y2 === 0 ||
      y2 >= HEIGHT - 1
    ) {
      return
    }

    const d = this.grid[x1][y1]

    this.grid[x1][y1] = 0
    this.grid[x2][y2] = d
    this.blacklist[x1][y2] = 1
  }

  private swap(x1: number, y1: number, x2: number, y2: number): void {
    if (
      x2 === 0 ||
      x2 >= WIDTH - 1 ||
      y2 === 0 ||
      y2 >= HEIGHT - 1
    ) {
      return
    }

    const d1 = this.grid[x1][y1]
    const d2 = this.grid[x2][y2]

    this.grid[x1][y1] = d2
    this.grid[x2][y2] = d1

    this.blacklist[x1][y1] = 1
    this.blacklist[x2][y2] = 1
  }

  private update() {
    let lived = false

    let rx = Math.floor(Math.random() * 500) % (this.grid.length - 1)
    const xIncrement = 8

    for (let x = 1; x < this.grid.length - 1; x++) {
      const yLen = this.grid[x].length - 1

      let ry = Math.floor(Math.random() * 500) % yLen
      const yIncrement = 2

      rx = (rx + xIncrement) % yLen

      if (rx === 0 || rx === this.grid[x].length) {
        continue
      }

      for (let y = this.grid[x].length; y > 0; y--) {
        ry = (ry + yIncrement) % yLen

        //
        // Skip if we think we are out of bounds
        //
        if (ry === 0 || ry === this.grid[x].length) {
          continue
        }

        const d = this.grid[rx][ry]
        const material = this.getMaterial(d)
        const xDir = Math.random() < 0.5 ? 1 : -1

        if (d === 0) {
          continue
        }

        if (this.blacklist[rx][ry]) {
          continue
        }

        this.updateSprings(d, rx, ry)

        if (d & SOLID) {
          continue
        }

        this.updateExplosions()

        if (d & INFECTANT) {
          this.updateInfections(rx, ry)
        }

        if (d & LIFE) {
          if (this.updateLife(rx, ry)) {
            lived = true
          }
        }

        this.updateFire(d, rx, ry)

        if (d & LIFE || d & C4) {
          continue
        }

        this.updateWater(d, rx, ry)
        this.updateFloating(d, rx, ry, material, xDir)

        if (this.grid[rx][ry + 1] === 0) {
          this.move(rx, ry, rx, ry + 1)
        }

        this.updateGeneric(rx, ry, material, xDir)
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

  private draw() {
    const { gl } = this

    let color
    let offset = 0

    for (let x = 0; x < this.grid.length; x++) {
      for (let y = 0; y < this.grid[x].length; y++) {
        const s = this.grid[x][y]

        if (s === 0) {
          _setPixel(this.textureData, offset, 0, 0, 0, 0)
          offset += 4
          continue 
        }

        const material = this.getMaterial(s)

        if (s & BURNING && material.burnColors) {
          color = (Math.random() > 0.1)
            ? [material.burnColors[0], material.burnColors[1], material.burnColors[2]]
            : [material.burnColors[3], material.burnColors[4], material.burnColors[5]]
        } else {
          color = material.color
        }

        _setPixel(this.textureData, offset, color[0], color[1], color[2], 255)
        offset += 4
      }
    }

    gl.clear(gl.COLOR_BUFFER_BIT)

    gl.bindTexture(gl.TEXTURE_2D, this.texture)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      WIDTH,
      HEIGHT,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      this.textureData
    );

    gl.bindBuffer(gl.ARRAY_BUFFER, this.positionBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.sandVertices, gl.STATIC_DRAW)

    gl.bindBuffer(gl.ARRAY_BUFFER, this.texcoordBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, this.texcoords, gl.STATIC_DRAW)

    gl.uniform1i(this.textureLocation, 0)
    gl.drawArrays(gl.TRIANGLES, 0, 6)
  }

  private handleMice(): void {
    for (const [_, brush] of Object.entries(this.activeBrushes)) {
      this.spawnCircle(brush)
    }
  }

  private updateSprings(cellValue: number, x: number, y: number): void {
    //
    // This is a spring
    //
    if (cellValue & WATER && cellValue & SOLID) {
      this.infect(x, y, 0, WATER)
    }

    //
    // Oil spring
    //
    if (cellValue & OIL && cellValue & SOLID) {
      this.infect(x, y, 0, OIL)
    }

    //
    // Lava spring
    //
    if (cellValue & LAVA && cellValue & SOLID) {
      this.infect(x, y, 0, LAVA)
    }
  }

  private updateExplosions(): void {
    if (!this.explosions.length) {
      return
    }

    for (const exp of this.explosions) {
      if (!exp.updated) {
        exp.update()
        this.spawnCircle({ x: exp.x, y: exp.y, type: 'fire', size: exp.radius })
      }
    }

    this.explosions = this.explosions.filter(exp => exp.force !== 0)
  }

  private onWaterSurrounds = (x: number, y: number) => this.destroy(x, y)
  private onLifeSurrounds = (x: number, y: number) => {
    if (
      x <= 1 ||
      x >= WIDTH - 1 ||
      y <= 1 ||
      y >= HEIGHT - 1 ||
      this.blacklist[x][y] ||
      this.grid[x][y] !== 0
    ) {
      return
    }

    const neighbours = this.countNeighbours(x, y)

    if (neighbours === 3) {
      this.spawn(x, y, LIFE)
    }

    //
    // Not a misatake, this makes it work better
    //
    this.blacklist[x][y] = 1
  }

  private onInfectSurrounds = (x: number, y: number, cellValue: number) => {
    const cell = this.grid[x][y]

    if (cell & INFECTANT) {
      return
    }

    if (x > 1 && x < WIDTH - 1 && y > 1 && y < HEIGHT - 1) {
      const rand = Math.random()

      if (cell !== 0 && rand > 0.91) {
        this.spawn(x, y, cellValue)
      }
    }
  }

  private updateLife(x: number, y: number): boolean {
    let lived = false

    if (this.lifeTimer.getTime() >= this.lifeTime) {
      lived = true

      const neighbours = this.countNeighbours(x, y, true)

      if (neighbours < 2) this.destroy(x, y)
      if (neighbours > 3) this.destroy(x, y)

      this.runOnSurrounds(x, y, this.onLifeSurrounds)
    }

    return lived
  }

  private updateInfections(x: number, y: number): void {
    if (this.surrounded(x, y)) {
      return
    }

    this.runOnSurrounds(x, y, this.onInfectSurrounds)
  }

  //
  // Handle fire, burning and things of that nature
  //
  private updateFire(cellValue: number, x: number, y: number): void {
    if (cellValue & FIRE && Math.random() > 0.8) {
      this.grid[x][y] |= BURNING
    }

    if (cellValue & BURNING && Math.random() > 0.8 && !this.blacklist[x][y]) {
      if (cellValue & C4) {
        this.explode(x, y, 40, 100)
      }

      this.destroy(x, y)
    } else {
      this.blacklist[x][y] = 1
    }

    // Burn baby burn
    if (cellValue & FIRE || cellValue & LAVA || cellValue & BURNING) {
      this.infect(x, y, LIFE, BURNING)
      this.infect(x, y, C4, BURNING)

      if (Math.random() > 0.5) {
        this.infect(x, y, OIL, BURNING)
        this.infect(x, y, WATER, STEAM, WATER)
      }
    }
  }

  private updateWater(cellValue: number, x: number, y: number): void {
    //
    // Chance that steam will condense + it will condense if it's surrounded by steam
    //
    if (cellValue & STEAM) {
      if (Math.random() > 0.9999) {
        this.spawn(x, y, WATER)
      } else if (this.surrounded(x, y)) {
        this.spawn(x, y, WATER)
      }
    }

    //
    // Put out fires
    //
    if (cellValue & WATER && Math.random() > 0.5) {
      this.runOnSurrounds(x, y, this.onWaterSurrounds, FIRE)
      this.infect(x, y, BURNING, BURNING)
    }
  }

  //
  // Handle changes due to material density
  //
  private updateFloating(cellValue: number, x: number, y: number, material: Material, xDir: number): void {
    const materialAbove = this.getMaterial(
      this.grid[x][y - 1]
    )

    if (
      typeof material.density === 'undefined' ||
      typeof materialAbove.density === 'undefined'
    ) {
      return
    }

    if (material.density < materialAbove.density) {
      if (cellValue & FIRE) {
        this.swap(x, y, x, y - 1)
      } else if (Math.random() < 0.7) {
        this.swap(x, y, x + xDir, y - 1)
      } else {
        this.swap(x, y, x, y - 1)
      }
    }
  }

  //
  // NB This code is paraphrased from http://pok5.de/elementdots/js/dots.js, so full credit where it's due.
  //
  private updateGeneric(x: number, y: number, material: Material, xDir: number): void {
    if (material.liquid && x + 3 < WIDTH && x - 3 > 0) {
      const r1 = this.grid[x + 1][y]
      const r2 = this.grid[x + 2][y]
      const r3 = this.grid[x + 3][y]
      const l1 = this.grid[x - 1][y]
      const l2 = this.grid[x - 2][y]
      const l3 = this.grid[x - 3][y]
      const c = this.grid[x][y]

      const w = ((r1 === c) ? 1 : 0) + ((r2 === c) ? 1 : 0) + ((r3 === c) ? 1 : 0) - ((l1 === c) ? 1 : 0) - ((l2 === c) ? 1 : 0) - ((l3 === c) ? 1 : 0)

      if (w <= 0 && Math.random() < 0.5) {
        if (r1 === 0 && this.grid[x + 1][y - 1] !== c) {
          this.move(x, y, x + 1, y)
        } else if (r2 === 0 && this.grid[x + 2][y - 1] !== c) {
          this.move(x, y, x + 2, y)
        } else if (r3 === 0 && this.grid[x + 3][y - 1] !== c) {
          this.move(x, y, x + 3, y)
        }
      } else if (w >= 0 && Math.random() < 0.5) {
        if (l1 === 0 && this.grid[x - 1][y - 1] !== c) {
          this.move(x, y, x - 1, y)
        } else if (l2 === 0 && this.grid[x - 2][y - 1] !== c) {
          this.move(x, y, x - 2, y)
        } else if (l3 === 0 && this.grid[x - 3][y - 1] !== c) {
          this.move(x, y, x - 3, y)
        }
      }
    } else {
      if (this.grid[x + xDir][y + 1] === 0) {
        this.move(x, y, x + xDir, y + 1)
      } 
    }
  }

  private getMaterial(s: number): Material {
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

  private clearBlacklist(): void {
    for (let x = 0; x < this.blacklist.length; x++) {
      for (let y = 0; y < this.blacklist[x].length; y++) {
        this.blacklist[x][y] = 0
      }
    }
  }

  private spawn(x: number, y: number, type: number): void {
    if (x === 0 || x === WIDTH - 1 || y === 0 || y === HEIGHT - 1 || this.grid[x][y] & type) return

    if (this.dustCount <= MAX_GRAINS && this.grid[x][y] === 0) {
      this.dustCount++

      this.grid[x][y] = type
      this.blacklist[x][y] = 1
    } else if (this.grid[x][y] !== 0) {
      this.grid[x][y] = type
      this.blacklist[x][y] = 1
    }
  }

  private destroy(x: number, y: number): void {
    if (this.grid[x][y] !== 0) {
      this.dustCount--

      this.grid[x][y] = 0
    }
  }

  private infect(x: number, y: number, flagSet: number, flagToSet: number, flagToRemove?: number): void {
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

  private surrounded(x: number, y: number): boolean {
    const cell = this.grid[x][y]
    return !!(
      cell === this.grid[x + 1][y] &&
      cell === this.grid[x - 1][y] &&
      cell === this.grid[x][y + 1] &&
      cell === this.grid[x][y - 1] &&
      cell === this.grid[x + 1][y + 1] &&
      cell === this.grid[x + 1][y - 1] &&
      cell === this.grid[x - 1][y + 1] &&
      cell === this.grid[x - 1][y - 1]
    )
  }

  //
  // Runs a function on surrounding particles providing a flag is set
  //
  private runOnSurrounds(
    x: number,
    y: number,
    f: (x: number, y: number, cellValue: number) => void,
    flag?: number
  ): void {
    const cellValue = this.grid[x][y]

    const n = this.grid[x][y - 1]
    const ne = this.grid[x + 1][y - 1]
    const e = this.grid[x + 1][y]
    const se = this.grid[x + 1][y + 1]
    const s = this.grid[x][y + 1]
    const sw = this.grid[x - 1][y + 1]
    const w = this.grid[x - 1][y]
    const nw = this.grid[x - 1][y - 1]

    if (flag) {
      if (n & flag) f(x, y - 1, cellValue)
      if (ne & flag) f(x + 1, y - 1, cellValue)
      if (e & flag) f(x + 1, y, cellValue)
      if (se & flag) f(x + 1, y + 1, cellValue)
      if (s & flag) f(x, y + 1, cellValue)
      if (sw & flag) f(x - 1, y + 1, cellValue)
      if (w & flag) f(x - 1, y, cellValue)
      if (nw & flag) f(x - 1, y - 1, cellValue)
    } else {
      f(x, y - 1, cellValue)
      f(x + 1, y - 1, cellValue)
      f(x + 1, y, cellValue)
      f(x + 1, y + 1, cellValue)
      f(x, y + 1, cellValue)
      f(x - 1, y + 1, cellValue)
      f(x - 1, y, cellValue)
      f(x - 1, y - 1, cellValue)
    }
  }

  private countNeighbours(x: number, y: number, exclusive: boolean = false): number {
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

  private explode(x: number, y: number, f: number, r: number) {
    const flippedX = WIDTH - x
    const explosion = new Explosion(flippedX, y, f, r)
    this.explosions.push(explosion)
  }

  addBrush = (
    id: number,
    brush: Brush
  ) => {
    this.activeBrushes[id] = brush
  }

  removeBrush = (id: number) => {
    delete this.activeBrushes[id]
  }

  spawnCircle = ({ x, y, type, size, infect }: Brush) => {
    //
    // TODO: Something to do with how we are building/displaying the texture
    //
    const flippedX = WIDTH - x
    const radius = size || 10

    if (this.dustCount >= MAX_GRAINS && type !== 'space') return

    let nType = typeof type === 'string' ? this.getType(type) : type
    const segments = 500
    const step = (2 * Math.PI) / segments

    if (infect && type !== 'space') {
      nType = (INFECTANT | nType)
    }

    for (let r = 0; r < radius; r++) {
      for (let i = 0; i < 2 * Math.PI; i += step) {
        const spawnX = flippedX + Math.floor(r * Math.sin(i))
        const spawnY = y + Math.floor(r * Math.cos(i))

        if (spawnX <= 0 || spawnY <= 0 || spawnX >= WIDTH - 1 || spawnY >= HEIGHT - 1) continue

        if (type !== 'space') {
          this.spawn(spawnX, spawnY, nType)
        } else {
          if (this.grid[spawnX][spawnY] !== 0) {
            this.destroy(spawnX, spawnY)
          }
        }
      }
    }
  }

  clearLevel = (): void => {
    this.grid = _create2dArray(WIDTH, HEIGHT)
  }

  private getType(typeString: BrushType): number {
    switch (typeString) {
      case 'space':
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
