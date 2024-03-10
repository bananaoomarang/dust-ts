export function getGl (canvas: HTMLCanvasElement): WebGLRenderingContext {
  const ctx = canvas.getContext('webgl')

  if (!ctx) {
    throw new Error('Could not get GL context :(')
  }

  return ctx
}

export function getShaderProgram (gl: WebGLRenderingContext, vert: string, frag: string): WebGLProgram {
  const vertexShader = gl.createShader(gl.VERTEX_SHADER)
  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)

  if (!vertexShader || !fragmentShader) {
    throw new Error('Could not create shaders')
  }

  gl.shaderSource(vertexShader, vert)
  gl.shaderSource(fragmentShader, frag)

  gl.compileShader(vertexShader)
  gl.compileShader(fragmentShader)

  if (!gl.getShaderParameter(vertexShader, gl.COMPILE_STATUS)) {
    console.error("Vertex shader won't compile mate: ", gl.getShaderInfoLog(vertexShader))
  }

  if (!gl.getShaderParameter(fragmentShader, gl.COMPILE_STATUS)) {
    console.error("Fragment shader won't compile mate: ", gl.getShaderInfoLog(fragmentShader))
  }

  const program = gl.createProgram()

  if (!program) {
    throw new Error('Could not create GL program')
  }

  gl.attachShader(program, vertexShader)
  gl.attachShader(program, fragmentShader)
  gl.linkProgram(program)

  return program
}

export function makeProjectionMatrix (width: number, height: number): number[] {
  return [
    2 / width, 0, 0,
    0, -2 / height, 0,
    -1, 1, 1
  ]
}

export function matrixMultiply (a: number[], b: number[]): number[] {
  const a00 = a[0 * 3 + 0]
  const a01 = a[0 * 3 + 1]
  const a02 = a[0 * 3 + 2]
  const a10 = a[1 * 3 + 0]
  const a11 = a[1 * 3 + 1]
  const a12 = a[1 * 3 + 2]
  const a20 = a[2 * 3 + 0]
  const a21 = a[2 * 3 + 1]
  const a22 = a[2 * 3 + 2]
  const b00 = b[0 * 3 + 0]
  const b01 = b[0 * 3 + 1]
  const b02 = b[0 * 3 + 2]
  const b10 = b[1 * 3 + 0]
  const b11 = b[1 * 3 + 1]
  const b12 = b[1 * 3 + 2]
  const b20 = b[2 * 3 + 0]
  const b21 = b[2 * 3 + 1]
  const b22 = b[2 * 3 + 2]
  return [a00 * b00 + a01 * b10 + a02 * b20,
    a00 * b01 + a01 * b11 + a02 * b21,
    a00 * b02 + a01 * b12 + a02 * b22,
    a10 * b00 + a11 * b10 + a12 * b20,
    a10 * b01 + a11 * b11 + a12 * b21,
    a10 * b02 + a11 * b12 + a12 * b22,
    a20 * b00 + a21 * b10 + a22 * b20,
    a20 * b01 + a21 * b11 + a22 * b21,
    a20 * b02 + a21 * b12 + a22 * b22]
}
