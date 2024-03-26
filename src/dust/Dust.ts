import Timer from './Timer'
import * as glUtil from './gl-util'
import vertShader from './shaders/vert.glsl?raw'
import fragShader from './shaders/frag.glsl?raw'
import Explosion from './Explosion'
import { compressLevel, decompressLevel } from './level-utils'
import { getRandomStepParams } from './random-shuffler'
import { Grid, Brush, Cell } from 'rusty-dust'
import { memory } from 'rusty-dust/rusty_dust_bg.wasm'
import Interpolator from './Interpolator'

const interpolator = new Interpolator();

export const WIDTH = 500
export const HEIGHT = 500

export const GRID = Grid.new(WIDTH, HEIGHT)

type Vec = [number, number]

const A_WIDTH = WIDTH - 1
const A_HEIGHT = HEIGHT - 1

const LIQUID_DISPERSAL = 7

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

export type BrushType = "Sand" | "Oil" | "Fire" | "Lava" | "Water" | "Steam" | "Solid" | "Life" | "C4" | "Spring" | "Volcanic" | "OilWell" | "Space" | "Fuse"

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

const MATERIAL_MAP: Record<number, Material> = {
  [M.SAND]: MATERIALS.sand
}

interface DustConstructor {
  gl: WebGLRenderingContext,
  fpsNode: HTMLElement | null
}

export default class Dust {
  gl: WebGLRenderingContext

  private _gravity: Vec = [0, 1]
  private _left: Vec = [-1, 0]
  private _right: Vec = [1, 0]
  private _up: Vec = [0, -1]

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

  grid = new Uint8Array()
  blacklist = _create2dArray(WIDTH, HEIGHT)
  explosions: Explosion[] = []

  lifeTimer = new Timer()
  lifeTime = 50

  _paused = false

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
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

    if (!this.texture) {
      throw new Error('Could not create texture')
    }
  }

  step = false

  run = () => {
    const { fpsTimer, fpsNode } = this

    GRID.tick()

    this.draw()

    this.frameCounter++
    if (fpsTimer.getTime() > 1000) {
      if (fpsNode) {
        fpsNode.innerHTML = `${this.frameCounter}fps`
      }
      fpsTimer.reset()
      this.frameCounter = 0
    }

    if (!this.step) {
      window.requestAnimationFrame(this.run)
    }
  }

  get paused() {
    return this._paused
  }

  set paused(paused: boolean) {
    this._paused = paused
    GRID.set_paused(paused)
  }

  get gravity() {
    return this._gravity
  }

  set gravity(gravity: Vec) {
    const [gx, gy] = gravity

    this._gravity[0] = gx
    this._gravity[1] = gy

    this._left[0] = gy
    this._left[1] = -gx

    this._right[0] = -gy
    this._right[1] = gx

    this._up[0] = -gx
    this._up[1] = -gy
  }

  private setCell (x: number, y: number, val: number): void {
    this.grid[x + y * HEIGHT] = val
  }

  private setCellFlag(x: number, y: number, flag: number): void {
    this.grid[x + y * HEIGHT] |= flag
  }

  private removeCellFlag(x: number, y: number, flag: number): void {
    this.grid[x + y * HEIGHT] &= ~flag
  }

  private getVal (x: number, y: number): M {
    if (!this.isWithinBounds(x, y)) {
      return M.SOLID
    }

    return this.grid[x + y * HEIGHT]
  }


  private move(x1: number, y1: number, x2: number, y2: number): void {
    const dest = this.getVal(x2, y2)

    if (dest !== M.SPACE) {
      console.warn('occupied!')
      return
    }

    const cellValue = this.getVal(x1, y1)

    this.setCell(x1, y1, 0)
    this.setCell(x2, y2, cellValue)

    this.blacklist[x2][y2] = 1
  }

  private isWithinBounds (x: number, y: number): boolean {
    return (x >= 0 && x <= A_WIDTH && y >= 0 && y <= A_HEIGHT)
  }

  private skim(maxShift: number, x: number, y: number): void {
    const absShift = Math.abs(maxShift)
    const dir = maxShift < 0 ? -1 : 1
    const [cx, cy] = dir === -1 ? this._left : this._right
    const points = interpolator.calculate(x, y, x + (cx * absShift), y + (cy * absShift)).slice(0)

    for (let i = 0; i < points.length; i++) {
      const hasNext = !!points[i + 1]
      const [currentX, currentY] = points[i]
      const currentVal = this.getVal(currentX, currentY)

      if (currentVal !== M.SPACE) {
        break
      }

      if (!hasNext) {
        if (i > 0) {
          this.move(x, y, currentX, currentY)
        }
        break
      }

      const [nextX, nextY] = points[i + 1]
      const nextVal = this.getVal(nextX, nextY)

      if (nextVal !== M.SPACE) {
        this.move(x, y, currentX, currentY)
        break
      }

      const belowPoints = interpolator.calculate(
        currentX,
        currentY,
        currentX + this.gravity[0],
        currentY + this.gravity[1]
      )

      if (belowPoints.length && this.getVal(belowPoints[0][0], belowPoints[0][1]) === M.SPACE) {
        this.move(x, y, belowPoints[0][0], belowPoints[0][1])
        break
      } 
    }
  }

  private swap(x1: number, y1: number, x2: number, y2: number): void {
    if (!this.isWithinBounds(x2, y2)) {
      return
    }

    const d1 = this.getVal(x1, y1)
    const d2 = this.getVal(x2, y2)

    this.setCell(x1, y1, d2)
    this.setCell(x2, y2, d1)

    this.blacklist[x1][y1] = 1
    this.blacklist[x2][y2] = 1
  }

  private update() {
    let lived = false
    const [xPrime, xOffset] = getRandomStepParams(WIDTH)
    const [yPrime, yOffset] = getRandomStepParams(HEIGHT)
    let rx = 0
    let ry = 0

    for (let x = 0; x < WIDTH; x++) {
      rx = (x * xPrime + xOffset) % WIDTH

      for (let y = A_HEIGHT; y >= 0; y--) {
        ry = (y * yPrime + yOffset) % HEIGHT

        if (this.blacklist[rx][ry]) {
          continue
        }

        const d = this.grid[rx + ry * HEIGHT]

        if (d === M.SPACE) {
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

        const material = this.getMaterial(d)
        const xDir = Math.random() < 0.5 ? -1 : 1

        if (material.density && Math.abs(material.density)) {
          this.updateFloating(d, rx, ry, material.density, xDir)
        }

        if (material.density && material.density >= 0) {
          const fell = this.updateGravity(rx, ry)

          if (!fell) {
            this.updateGeneric(rx, ry, material, xDir)
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

  private draw() {
    const { gl } = this

    this.textureData = new Uint8ClampedArray(memory.buffer, GRID.texture(), WIDTH * HEIGHT * 4)

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
      this.getVal(x, y) !== M.SPACE
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
    const cell = this.getVal(x, y)

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
      const val = this.getVal(x, y)
      this.setCell(x, y, val | M.BURNING)
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
  private updateFloating(cellValue: number, x: number, y: number, density: number, xDir: number): void {
    const [ux, uy] = this._up
    const [sideX, sideY] = xDir === -1 ? this._left : this._right

    const aboveX = Math.round(x + ux)
    const aboveY = Math.round(y + uy)
    const aboveSideX = Math.round(x + sideX + ux)
    const aboveSideY = Math.round(y + sideY + uy)

    if (!this.isWithinBounds(aboveX, aboveY)) {
      return
    }

    const { density: aboveDensity }= this.getMaterial(
      this.getVal(aboveX, aboveY)
    )

    if (
      (!aboveDensity && aboveDensity !== 0) ||
      (aboveDensity === density) ||
      (aboveDensity === 0 && density > 0) ||
      !this.isWithinBounds(aboveSideX, aboveSideY)
    ) {
      return
    }

    const materialAboveSide = this.getMaterial(
      this.getVal(aboveSideX, aboveSideY)
    )

    if (density < aboveDensity) {
      if (cellValue & M.FIRE) {
        this.swap(x, y, aboveX, aboveY)
      } else if (Math.random() < 0.7 && (materialAboveSide.density || materialAboveSide.density === 0)) {
        this.swap(x, y, aboveSideX, aboveSideY)
      } else {
        this.swap(x, y, aboveX, aboveY)
      }
    }
  }

  private updateGravity(x: number, y: number): boolean {
    const [gx, gy] = this.gravity
    // const p = this.interpolator.calculate(x, y, x + gx, y + gy)

    // if (p.length === 0) {
    //   return false
    // }

    const x2 = Math.round(x + gx)
    const y2 = Math.round(y + gy)

    if (this.getVal(x2, y2) === M.SPACE) {
      this.move(x, y, x2, y2)
      return true
    }

    return false
  }

  private getNextPoint(start: Vec, change: Vec): M {
    const [x, y] = start
    const [dx, dy] = change
    const points = interpolator.calculate(x, y, x + dx, y + dy)

    if (points.length === 0) {
      return M.SOLID
    }

    return this.getVal(points[0][0], points[0][1])
  }

  private updateGeneric(x: number, y: number, material: Material, xDir: number): void {
    if (material.liquid && this.getNextPoint([x, y], this.gravity) !== M.SPACE) {
      const above = this.getNextPoint([x, y], this._up)
      const below = this.getNextPoint([x, y], this._gravity)

      if (above === M.SPACE && below === M.SPACE) {
        return
      }

      const left = this.getNextPoint([x, y], this._left)
      const right = this.getNextPoint([x, y], this._right)

      if (left === M.SPACE && right === M.SPACE) {
        this.skim(xDir * LIQUID_DISPERSAL, x, y)
      } else if (left === M.SPACE) {
        this.skim(-LIQUID_DISPERSAL, x, y)
      } else if (right === M.SPACE) {
        this.skim(LIQUID_DISPERSAL, x, y)
      }
    } else {
      const [gx, gy] = this._gravity
      const [cx, cy] = xDir === -1  ? this._left : this._right
      // const points = this.interpolator.calculate(x, y, x + gx + cx, y + gy + cy)

      // if (points.length === 0) {
      //   return
      // }
      // const p = points[0]
      const nx = Math.round(x + gx + cx)
      const ny = Math.round(y + gy + cy)

      if (this.getVal(nx, ny) === M.SPACE) {
        this.move(x, y, nx, ny)
      } 
    }
  }

  private getMaterial(s: number): Material {
    if (s === 0) return MATERIALS.space

    if (MATERIAL_MAP[s]) {
      return MATERIAL_MAP[s]
    }

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
    if (!this.isWithinBounds(x, y)) {
      return
    }

    const d = this.grid[x + y * HEIGHT]
    if (d & type) {
      return
    }

    if (d === M.SPACE) {
      this.setCell(x, y, type)
      this.blacklist[x][y] = 1
    } else if (this.getVal(x, y) !== M.SPACE) {
      this.setCell(x, y, type)
      this.blacklist[x][y] = 1
    }
  }

  private destroy(x: number, y: number): void {
    if (this.getVal(x, y) !== M.SPACE) {
      this.setCell(x, y, M.SPACE)
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
      if (n & flagSet) this.setCellFlag(x, y - 1, flagToSet)
      if (ne & flagSet) this.setCellFlag(x + 1, y - 1, flagToSet)
      if (e & flagSet) this.setCellFlag(x + 1, y, flagToSet)
      if (se & flagSet) this.setCellFlag(x + 1, y + 1, flagToSet)
      if (s & flagSet) this.setCellFlag(x, y + 1, flagToSet)
      if (sw & flagSet) this.setCellFlag(x - 1, y + 1, flagToSet)
      if (w & flagSet) this.setCellFlag(x - 1, y, flagToSet)
      if (nw & flagSet) this.setCellFlag(x - 1, y - 1, flagToSet)
    }

    // Remove an optional flag
    if (flagToRemove) {
      if (n & flagSet) this.removeCellFlag(x, y - 1, flagToRemove)
      if (ne & flagSet) this.removeCellFlag(x + 1, y - 1, flagToRemove)
      if (e & flagSet) this.removeCellFlag(x + 1, y, flagToRemove)
      if (se & flagSet) this.removeCellFlag(x + 1, y + 1, flagToRemove)
      if (s & flagSet) this.removeCellFlag(x, y + 1, flagToRemove)
      if (sw & flagSet) this.removeCellFlag(x - 1, y + 1, flagToRemove)
      if (w & flagSet) this.removeCellFlag(x - 1, y, flagToRemove)
      if (nw & flagSet) this.removeCellFlag(x - 1, y - 1, flagToRemove)
    }
  }

  private surrounded(x: number, y: number): boolean {
    const cell = this.getVal(x, y)
    return (
      cell === this.getVal(x + 1, y) &&
      cell === this.getVal(x - 1, y) &&
      cell === this.getVal(x, y + 1) &&
      cell === this.getVal(x, y - 1) &&
      cell === this.getVal(x + 1, y + 1) &&
      cell === this.getVal(x + 1, y - 1) &&
      cell === this.getVal(x - 1, y + 1) &&
      cell === this.getVal(x - 1, y - 1)
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
    const cellValue = this.getVal(x, y)

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
    const d = this.getVal(x, y)
    const n = this.getVal(x, y - 1)
    const ne = this.getVal(x + 1, y - 1)
    const e = this.getVal(x + 1, y)
    const se = this.getVal(x + 1, y + 1)
    const s = this.getVal(x, y + 1)
    const sw = this.getVal(x - 1, y + 1)
    const w = this.getVal(x - 1, y)
    const nw = this.getVal(x - 1, y - 1)

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
    const rustBrush = Brush.new(brush.x, brush.y, Cell.Sand, brush.size, brush.active, brush.infect)
    GRID.add_brush(
      id,
      rustBrush
    )
  }

  removeBrush = (id: number) => {
    GRID.remove_brush(id)
  }

  clearLevel = (): void => {
    this.grid = new Uint8Array(WIDTH * HEIGHT)
  }

  exportGrid = async (): Promise<string> => {
    const data = await compressLevel(this.grid)
    return data
  }

  loadLevel = async (level: Level): Promise<void> => {
    const grid = await decompressLevel(level.data)
    this.grid = grid
  }

  fillTextureData (grid: Uint32Array, textureData: Uint8ClampedArray) {
    let color
    let offset = 0

    for (let x = 0; x < WIDTH; x++) {
      for (let y = 0; y < HEIGHT; y++) {
        const s = grid[x + y * HEIGHT]

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
