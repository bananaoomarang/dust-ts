import Timer from './Timer'
import * as glUtil from './gl-util'
import vertShader from './shaders/vert.glsl?raw'
import fragShader from './shaders/frag.glsl?raw'
import Explosion from './Explosion'
import { compressLevel, decompressLevel } from './level-utils'

export const WIDTH = 500
export const HEIGHT = 500

const A_WIDTH = WIDTH - 1
const A_HEIGHT = HEIGHT - 1

const MAX_GRAINS = WIDTH * HEIGHT

const LIQUID_DISPERSAL = Math.round(0.05 * WIDTH)

type Vec = [number, number]

enum M {
  SPACE = 0,
  SAND = 1,
  OIL = 2,
  FIRE = 4,
  LAVA = 8,
  WATER = 16,
  STEAM = 32,
  SOLID = 64,
  BURNING = 256,
  LIFE = 512,
  INFECTANT = 1024,
  C4 = 2048,
  FUSE = 4096,
  SPRING = (SOLID | WATER),
  VOLCANIC = (SOLID | LAVA),
  OIL_WELL = (SOLID | OIL)
}

const TYPE_MAP: Record<BrushType, M> = {
  space: M.SPACE,
  sand: M.SAND,
  oil: M.OIL,
  fire: M.FIRE,
  lava: M.LAVA,
  water: M.WATER,
  steam: M.STEAM,
  solid: M.SOLID,
  spring: M.SPRING,
  volcanic: M.VOLCANIC,
  ['oil well']: M.OIL_WELL,
  life: M.LIFE,
  C4: M.C4,
  fuse: M.FUSE
}

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

export type BrushType = "sand" | "oil" | "fire" | "lava" | "water" | "steam" | "solid" | "life" | "C4" | "spring" | "volcanic" | "oil well" | "space" | "fuse"

export type BrushModifier = "burning" | "infectant"

type Brush  = {
  active: boolean
  x: number
  y: number
  type: BrushType
  size: number
  infect?: boolean
}

function _setPixel(
  data: Uint8ClampedArray,
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
  fuse: {
    color: [255, 255, 255],
    burnColors:  [255, 102, 26, 204, 102, 26 ],
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

  private _gravity: Vec = [0, 1]
  private _leftRight: [Vec, Vec] = [[-1, 0], [1, 0]]

  fpsTimer = new Timer()
  frameCounter = 0

  sandVertices = new Float32Array([
    0, 0,
    0, HEIGHT,
    WIDTH, 0,
    WIDTH, 0,
    0, HEIGHT,
    WIDTH, HEIGHT
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
  textureData = new Uint8ClampedArray(WIDTH * HEIGHT * 4)

  grid = _create2dArray(WIDTH, HEIGHT)
  blacklist = _create2dArray(WIDTH, HEIGHT)
  explosions: Explosion[] = []

  lifeTimer = new Timer()
  lifeTime = 50

  dustCount = 0

  paused = false

  fpsNode: HTMLElement | null

  brushes: Record<number, Brush> = {}

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

    this.handleBrushes()

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

  get gravity() {
    return this._gravity
  }

  set gravity(gravity: Vec) {
    const [gx, gy] = gravity

    this._gravity = gravity
    this._leftRight = [[-gy, gx], [gy, -gx]]
  }

  private move(x1: number, y1: number, x2: number, y2: number): void {
    const dest = this.getVal(x2, y2)

    if (dest !== M.SPACE) {
      console.warn('occupied!')
      return
    }

    const cellValue = this.getVal(x1, y1)

    this.grid[x1][y1] = 0
    this.grid[x2][y2] = cellValue

    this.blacklist[x1][y1] = 1
    this.blacklist[x2][y2] = 1
  }

  private isWithinBounds (x: number, y: number): boolean {
    return (x >= 0 && x <= A_WIDTH && y >= 0 && y <= A_HEIGHT)
  }

  private getVal (x: number, y: number): M {
    if (!this.isWithinBounds(x, y)) {
      return M.SOLID
    }

    return this.grid[x][y]
  }

  private skim(maxShift: number, x: number, y: number): void {
    const absShift = Math.abs(maxShift)
    const dir = maxShift > 0 ? 1 : -1
    const [cx, cy] = dir === -1 ? this._leftRight[0] : this._leftRight[1]
    const points = this.interpolatePoints(x, y, x + (cx * absShift), y + (cy * absShift))

    for (let i = 0; i < points.length; i++) {
      const hasNext = !!points[i + 1]
      const [currentX, currentY] = points[i]

      if (!hasNext) {
        if (i > 0) {
          this.move(x, y, currentX, currentY)
        }
        break
      }

      const [nextX, nextY] = points[i + 1]

      if (this.getVal(nextX, nextY) !== M.SPACE) {
        this.move(x, y, currentX, currentY)
        break
      }

      const below = this.getNextPoint([currentX, currentY], this.gravity)

      if (below === M.SPACE) {
        this.move(x, y, currentX, currentY)
        break
      }
    }

    // const absMaxShift = Math.abs(maxShift)
    // for (let i = 1, fallen = 0; i <= absMaxShift; i++) {
    //   const currentY = y + fallen
    //   const currentX = x + (i * dir)
    //   const nextX = x + ((i + 1) * dir)
    //   const nextY = y + 

    //   const nextCell = this.getVal(nextX, currentY)

    //   if (nextCell !== M.SPACE) {
    //     this.move(x, y, currentX, currentY)
    //     break
    //   }

    //   const below = this.getVal(currentX, currentY + 1)

    //   if (below === M.SPACE) {
    //     this.move(x, y, currentX, currentY)
    //     break
    //   }

    //   const belowNextCell = this.getVal(nextX, currentY + 1)

    //   if (belowNextCell === M.SPACE) {
    //     fallen += 1
    //     continue
    //   }

    //   if (i === absMaxShift) {
    //     this.move(x, y, currentX, currentY)
    //   }
    // }
  }

  private swap(x1: number, y1: number, x2: number, y2: number): void {
    const d1 = this.getVal(x1, y1)
    const d2 = this.getVal(x2, y2)

    this.grid[x1][y1] = d2
    this.grid[x2][y2] = d1

    this.blacklist[x1][y1] = 1
    this.blacklist[x2][y2] = 1
  }

  private update() {
    let lived = false

    let rx = Math.floor(Math.random() * WIDTH) % (this.grid.length - 1)
    const xLen = this.grid.length
    const xIncrement = 1

    for (let x = 0; x < this.grid.length; x++) {
      const yLen = this.grid[x].length

      let ry = Math.floor(Math.random() * HEIGHT) % yLen
      const yIncrement = 1

      rx = (rx + xIncrement) % xLen

      for (let y = this.grid[x].length - 1; y >= 0; y--) {
        ry = (ry + yIncrement) % yLen

        if (this.blacklist[rx][ry]) {
          continue
        }

        const d = this.grid[rx][ry]
        const material = this.getMaterial(d)
        const xDir = Math.random() < 0.5 ? -1 : 1

        if (d === 0) {
          continue
        }

        this.updateSprings(d, rx, ry)

        if (d & M.SOLID) {
          continue
        }

        this.updateExplosions()

        if (d & M.INFECTANT) {
          this.updateInfections(rx, ry)
        }

        if (d & M.LIFE) {
          if (this.updateLife(rx, ry)) {
            lived = true
          }
        }

        this.updateFire(d, rx, ry)

        if (d & M.LIFE || d & M.C4 || d & M.FUSE) {
          continue
        }

        this.updateWater(d, rx, ry)
        // this.updateFloating(d, rx, ry, material, xDir)

        const fell = this.updateGravity(rx, ry)

        if (!fell) {
          this.updateGeneric(rx, ry, material, xDir)
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

  private draw() {
    const { gl } = this

    this.fillTextureData(this.grid, this.textureData)

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

  private handleBrushes(): void {
    for (const [_, brush] of Object.entries(this.brushes)) {
      if (!brush.active) {
        continue
      }

      this.spawnCircle(brush)
    }
  }

  private updateSprings(cellValue: number, x: number, y: number): void {
    //
    // This is a spring
    //
    if (cellValue & M.WATER && cellValue & M.SOLID) {
      this.infect(x, y, 0, M.WATER)
    }

    //
    // Oil spring
    //
    if (cellValue & M.OIL && cellValue & M.SOLID) {
      this.infect(x, y, 0, M.OIL)
    }

    //
    // Lava spring
    //
    if (cellValue & M.LAVA && cellValue & M.SOLID) {
      this.infect(x, y, 0, M.LAVA)
    }
  }

  private updateExplosions(): void {
    if (!this.explosions.length) {
      return
    }

    for (const exp of this.explosions) {
      if (!exp.updated) {
        exp.update()
        this.spawnCircle({ x: exp.x, y: exp.y, type: 'fire', size: exp.radius, active: true })
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
      this.spawn(x, y, M.LIFE)
    }

    //
    // Not a misatake, this makes it work better
    //
    this.blacklist[x][y] = 1
  }

  private onInfectSurrounds = (x: number, y: number, cellValue: number) => {
    const cell = this.grid[x][y]

    if (cell & M.INFECTANT) {
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
    if (cellValue & M.FIRE && Math.random() > 0.8) {
      this.grid[x][y] |= M.BURNING
    }

    if (cellValue & M.BURNING && Math.random() > 0.8 && !this.blacklist[x][y]) {
      if (cellValue & M.C4) {
        this.explode(x, y, 40, 100)
      }

      this.destroy(x, y)
    } else {
      this.blacklist[x][y] = 1
    }

    // Burn baby burn
    if (cellValue & M.FIRE || cellValue & M.LAVA || cellValue & M.BURNING) {
      this.infect(x, y, M.LIFE, M.BURNING)
      this.infect(x, y, M.C4, M.BURNING)
      this.infect(x, y, M.FUSE, M.BURNING)

      if (Math.random() > 0.5) {
        this.infect(x, y, M.OIL, M.BURNING)
        this.infect(x, y, M.WATER, M.STEAM, M.WATER)
      }
    }
  }

  private updateWater(cellValue: number, x: number, y: number): void {
    //
    // Chance that steam will condense + it will condense if it's surrounded by steam
    //
    if (cellValue & M.STEAM) {
      if (Math.random() > 0.9999) {
        this.spawn(x, y, M.WATER)
      } else if (this.surrounded(x, y)) {
        this.spawn(x, y, M.WATER)
      }
    }

    //
    // Put out fires
    //
    if (cellValue & M.WATER && Math.random() > 0.5) {
      this.runOnSurrounds(x, y, this.onWaterSurrounds, M.FIRE)
      this.infect(x, y, M.BURNING, M.BURNING)
    }
  }

  //
  // Handle changes due to material density
  //
  private updateFloating(cellValue: number, x: number, y: number, material: Material, xDir: number): void {
    if (typeof material.density === 'undefined') {
      return
    }

    const materialAbove = this.getMaterial(
      this.grid[x][y - 1]
    )

    if (typeof materialAbove.density === 'undefined') {
      return
    }

    if (material.density < materialAbove.density) {
      if (cellValue & M.FIRE) {
        this.swap(x, y, x, y - 1)
      } else if (Math.random() < 0.7) {
        this.swap(x, y, x + xDir, y - 1)
      } else {
        this.swap(x, y, x, y - 1)
      }
    }
  }

  private updateGravity(x: number, y: number): boolean {
    const [gx, gy] = this.gravity
    const p = this.interpolatePoints(x, y, x + gx, y + gy)

    if (p.length === 0) {
      return false
    }

    const [nx, ny] = p[p.length - 1].map(Math.round)

    if (this.getVal(nx, ny) === M.SPACE) {
      this.move(x, y, nx, ny)
      return true
    }

    return false
  }

  private getNextPoint(start: Vec, change: Vec): M {
    const [x, y] = start
    const [dx, dy] = change
    const points = this.interpolatePoints(x, y, x + dx, y + dy)

    if (points.length === 0) {
      return M.SOLID
    }

    return this.getVal(points[0][0], points[0][1])
  }

  private updateGeneric(x: number, y: number, material: Material, xDir: number): void {
    if (material.liquid && this.getNextPoint([x, y], this.gravity) !== M.SPACE) {
      const left = this.getNextPoint([x, y], this._leftRight[0])
      const right = this.getNextPoint([x, y], this._leftRight[1])

      if (left === M.SPACE && right === M.SPACE) {
        this.skim(xDir, x, y)
      } else if (left === M.SPACE) {
        this.skim(-LIQUID_DISPERSAL, x, y)
      } else if (right === M.SPACE) {
        this.skim(LIQUID_DISPERSAL, x, y)
      }
    } else {
      const [gx, gy] = this._gravity
      const [cx, cy] = xDir === -1  ? this._leftRight[0] : this._leftRight[1]
      const points = this.interpolatePoints(x, y, x + gx + cx, y + gy + cy)

      if (points.length === 0) {
        return
      }

      const [nextX, nextY] = points[0]

      if (this.getVal(nextX, nextY) === M.SPACE) {
        this.move(x, y, nextX, nextY)
      } 
    }
  }

  private getMaterial(s: number): Material {
    if (s === M.SPACE) return MATERIALS.space
    if (s & M.SAND) return MATERIALS.sand
    if (s & M.OIL) return MATERIALS.oil
    if (s & M.FIRE) return MATERIALS.fire
    if (s & M.WATER) return MATERIALS.water
    if (s & M.STEAM) return MATERIALS.steam
    if (s & M.LAVA) return MATERIALS.lava
    if (s & M.LIFE) return MATERIALS.life
    if (s & M.C4) return MATERIALS.C4
    if (s & M.FUSE) return MATERIALS.fuse
    if (s & M.SOLID) return MATERIALS.solid

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
    const n = this.getVal(x, y - 1)
    const ne = this.getVal(x + 1, y - 1)
    const e = this.getVal(x + 1, y)
    const se = this.getVal(x + 1, y + 1)
    const s = this.getVal(x, y + 1)
    const sw = this.getVal(x - 1, y + 1)
    const w = this.getVal(x - 1, y)
    const nw = this.getVal(x - 1, y - 1)

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

    const n = this.getVal(x, y - 1)
    const ne = this.getVal(x + 1, y - 1)
    const e = this.getVal(x + 1, y)
    const se = this.getVal(x + 1, y + 1)
    const s = this.getVal(x, y + 1)
    const sw = this.getVal(x - 1, y + 1)
    const w = this.getVal(x - 1, y)
    const nw = this.getVal(x - 1, y - 1)

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
    this.brushes[id] = brush
  }

  removeBrush = (id: number) => {
    delete this.brushes[id]
  }

  private interpolatePoints(x1: number, y1: number, x2: number, y2: number): Vec[] {
    const xDiff = x1 - x2
    const yDiff = y1 - y2
    const xDiffIsLarger = Math.abs(xDiff) > Math.abs(yDiff)

    const xModifier = xDiff < 0 ? 1 : -1
    const yModifier = yDiff < 0 ? 1 : -1

    const upperBound = Math.max(Math.abs(xDiff), Math.abs(yDiff))
    const min = Math.min(Math.abs(xDiff), Math.abs(yDiff))
    const slope = (min === 0 || upperBound === 0) ? 0 : ((min + 1) / (upperBound + 1))

    const points = []

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

      if (this.isWithinBounds(currentX, currentY)) {
        const p: Vec = [currentX, currentY]
        points.push(p)
      }
    }

    return points
  }

  private getCirclePoints (
    centerX: number,
    centerY: number,
    radius: number,
    fill: boolean = false
  ): number[][] {
    const results = []

    for(let rad = radius; rad >= (fill ? 0 : radius); rad--) {
      for(let i = 0; i <= Math.PI * 2; i += 0.006){
        const pX = centerX + rad * Math.cos(i)
        const pY = centerY + rad * Math.sin(i)
        const x = Math.round(pX)
        const y = Math.round(pY)

        if (x > A_WIDTH || x < 0 || y > A_HEIGHT || y < 0) {
          continue
        }

        results.push([Math.round(pX), Math.round(pY)])
      }
    }

    return results
  }

  spawnCircle = ({ x: centerX, y: centerY, type, size, infect }: Brush) => {
    let nType = typeof type === 'string' ? TYPE_MAP[type] || 0 : type

    if (infect && nType !== M.SPACE) {
      nType = (M.INFECTANT | nType)
    }

    if (size === 1) {
      this.spawn(WIDTH - centerX, centerY, nType)
      return
    }

    for (const [x, y] of this.getCirclePoints(WIDTH - centerX, centerY, size, true)) {
      this.spawn(x, y, nType)
    }
  }

  clearLevel = (): void => {
    this.grid = _create2dArray(WIDTH, HEIGHT)
  }

  exportGrid = async (): Promise<string> => {
    const data = await compressLevel(this.grid)
    return data
  }

  loadLevel = async (level: Level): Promise<void> => {
    const grid = await decompressLevel(level.data)
    this.grid = grid
  }

  fillTextureData = (grid: number[][], textureData: Uint8ClampedArray) => {
    let color
    let offset = 0

    const brushOutlines: boolean[][] = []
    for (const [_, brush] of Object.entries(this.brushes)) {
      if (brush.active) {
        continue
      }

      const points = this.getCirclePoints(WIDTH - brush.x, brush.y, brush.size)
      for (const [x, y] of points) {
        if (!brushOutlines[x]) {
          brushOutlines[x] = []
        }
        brushOutlines[x][y] = true
      }
    }

    for (let x = 0; x < grid.length; x++) {
      for (let y = 0; y < grid[x].length; y++) {
        const s = grid[x][y]
        const brush = brushOutlines[x] && brushOutlines[x][y]

        if (brush) {
          _setPixel(textureData, offset, 255, 255, 255, 255)
          offset += 4
          continue
        }

        if (s === 0) {
          _setPixel(textureData, offset, 0, 0, 0, 0)
          offset += 4
          continue 
        }

        const material = this.getMaterial(s)

        if (s & M.BURNING && material.burnColors) {
          color = (Math.random() > 0.1)
            ? [material.burnColors[0], material.burnColors[1], material.burnColors[2]]
            : [material.burnColors[3], material.burnColors[4], material.burnColors[5]]
        } else {
          color = material.color
        }

        _setPixel(textureData, offset, color[0], color[1], color[2], 255)
        offset += 4
      }
    }
  }
}
