import { getRandomStepParams } from './random-shuffler'

const WIDTH = 500
const HEIGHT = 500

const A_WIDTH = WIDTH - 1
const A_HEIGHT = HEIGHT - 1

const LIQUID_DISPERSAL = 7

export const grid = new Uint32Array(WIDTH * HEIGHT)
const visitedCells = new Uint8Array(WIDTH * HEIGHT)

export const gridPtr = changetype<i32>(grid)

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

class Material {
  color: i16[] = []
  burnColors: i16[] = []
  density: f32 = 0
  friction: f32 = 0
  liquid: boolean = false
  solid: boolean = false
}

const MATERIALS = new Map<string, Material>()
MATERIALS.set('space', {
  color: [0, 0, 0, 0],
  density: 0,
  friction: 0,
  burnColors: [],
  liquid: false,
  solid: false
})
MATERIALS.set('solid', {
  color: [0, 0, 0],
  burnColors: [],
  density: 0,
  friction: 0.99,
  liquid: false,
  solid: true
})
MATERIALS.set('sand', {
  color: [230, 179, 51],
  density: 10,
  friction: 0.99,
  burnColors: [],
  liquid: false,
  solid: false
})
MATERIALS.set('oil', {
  color: [128, 102, 26],
  burnColors:  [255, 102, 26, 204, 102, 26 ],
  friction: 1,
  liquid: true,
  density: 5,
  solid: false
})
MATERIALS.set('fire', {
  color: [255, 128, 0],
  burnColors: [255, 128, 0, 230, 153, 26],
  friction: 1,
  liquid: false,
  density: -1,
  solid: false
})
MATERIALS.set('lava', {
  color: [255, 77, 0],
  burnColors: [],
  liquid: true,
  density: 10,
  friction: 0,
  solid: false
})
MATERIALS.set('C4', {
  color: [51, 230, 26],
  burnColors: [230, 179, 51, 255, 255, 77],
  liquid: false,
  density: 0,
  friction: 0,
  solid: true
})
MATERIALS.set('water', {
  color: [0, 128, 255],
  burnColors: [],
  friction: 1,
  liquid: true,
  solid: false,
  density: 6
})
MATERIALS.set('steam', {
  color: [153, 153, 153],
  burnColors: [],
  friction: 1,
  liquid: false,
  solid: false,
  density: -1
})
MATERIALS.set('life', {
  color: [0, 255, 51],
  burnColors: [255, 179, 26, 179, 153, 26],
  friction: 1,
  liquid: false,
  solid: true,
  density: -1
})
MATERIALS.set('fuse', {
  color: [255, 255, 255],
  burnColors:  [255, 102, 26, 204, 102, 26 ],
  friction: 1,
  liquid: false,
  solid: true,
  density: -1
})

function getMaterial(s: i32): Material {
  if (s & M.SPACE) return MATERIALS.get('space')
  if (s & M.SAND) return MATERIALS.get('sand')
  if (s & M.OIL) return MATERIALS.get('oil')
  if (s & M.FIRE) return MATERIALS.get('fire')
  if (s & M.WATER) return MATERIALS.get('water')
  if (s & M.STEAM) return MATERIALS.get('steam')
  if (s & M.LAVA) return MATERIALS.get('lava')
  if (s & M.LIFE) return MATERIALS.get('life')
  if (s & M.C4) return MATERIALS.get('C4')
  if (s & M.FUSE) return MATERIALS.get('fuse')
  if (s & M.SOLID) return MATERIALS.get('solid')

  return MATERIALS.get('space')
}

function isWithinBounds (x: i32, y: i32): boolean {
  return (x >= 0 && x <= A_WIDTH && y >= 0 && y <= A_HEIGHT)
}

function setVisited(x: i32, y: i32): void {
  visitedCells[x + y * HEIGHT] = 1
}

function getVisited(x: i32, y: i32): boolean {
  return visitedCells[x + y * HEIGHT] === 1
}

function clearVisited(): void {
  for (let i = 0; i < visitedCells.length; i++) {
    visitedCells[i] = 0
  }
}

function getVal (x: i32, y: i32): M {
  if (!isWithinBounds(x, y)) {
    return M.SOLID
  }

  return grid[x + y * HEIGHT]
}

function setCell (x: i32, y: i32, val: i32): void {
  grid[x + y * HEIGHT] = val
}

function move(x1: i32, y1: i32, x2: i32, y2: i32): void {
  const dest = getVal(x2, y2)

  if (dest !== M.SPACE) {
    console.warn('occupied!')
    return
  }

  const cellValue = getVal(x1, y1)

  setCell(x1, y1, 0)
  setCell(x2, y2, cellValue)
  setVisited(x2, y2)
}

function updateGravity(x: i32, y: i32): boolean {
  // const [gx, gy] = this.gravity
  // const p = this.interpolator.calculate(x, y, x + gx, y + gy)

  // if (p.length === 0) {
  //   return false
  // }

  const x2 = x + 0
  const y2 = y + 1

  if (getVal(x2, y2) === 0) {
    move(x, y, x2, y2)
    return true
  }

  return false
}


function updateGeneric(x: i32, y: i32, material: Material, xDir: i32): void {
  // const [gx, gy]: i32[] = [0, 1]
  // const [cx, cy]: i32[] = xDir === -1  ? [-1, 0] : [1, 0]
  const gx = 0
  const gy = 1
  const cx = xDir === -1 ? -1 : 1
  const cy = 0
  // const points = this.interpolator.calculate(x, y, x + gx + cx, y + gy + cy)

  // if (points.length === 0) {
  //   return
  // }
  // const p = points[0]
  const nx = x + gx + cx
  const ny = y + gy + cy

  if (getVal(nx, ny) === M.SPACE) {
    move(x, y, nx, ny)
  } 
}

export function update(): void {

  const xParams = getRandomStepParams(WIDTH)
  const yParams = getRandomStepParams(HEIGHT)
  let rx = 0
  let ry = 0
  for (let x = 0; x < WIDTH; x++) {
    rx = (x * xParams[0] + xParams[1]) % WIDTH

    for (let y = A_HEIGHT; y >= 0; y--) {
      ry = (y * yParams[0] + yParams[1]) % HEIGHT

      if (getVisited(rx, ry)) {
        continue
      }

      const d = grid[rx + ry * HEIGHT]

      if (d === M.SPACE) {
        continue
      }

      if (d & M.SOLID) {
        continue
      }

      if (d & M.LIFE || d & M.C4 || d & M.FUSE) {
        continue
      }

      const fell = updateGravity(rx, ry)
      if (!fell) {
        const xDir = Math.random() < 0.5 ? -1 : 1
        const material = getMaterial(d)
        updateGeneric(rx, ry, material, xDir)
      }
    }
  }

  clearVisited()
}
