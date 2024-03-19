//
// Paraphrased from: https://github.com/lemire/Code-used-on-Daniel-Lemire-s-blog/blob/master/2017/09/18_2/VisitInDisorder.java
//
// Shuffle through sequence in a pseudo-random order
//
export function getRandomStepParams(range: number): [number, number] {
  const min = Math.floor(range / 2);
  const prime = _selectCoPrimeResev(min, range)
  const offset = Math.floor(Math.random() * range)

  return [prime, offset]
}

getRandomStepParams(500)

function _selectCoPrimeResev(min: number, target: number) {
  let count = 0
  let selected = 0

  for (let val = min; val < target; ++val) {
    if (_coprime(val, target)) {
      count += 1
      if ((count === 1) || Math.floor(Math.random() * count) < 1) {
        selected = val
      }
    }

    if (count === 100000) {
      return val
    }
  }
  return selected
}

function _coprime(u: number, v: number): boolean {
  return _gcd(u, v) === 1
}

function _gcd(u: number, v: number): number {
  let shift = 0

  if (u === 0) {
    return v
  }

  if (v === 0) {
    return u
  }

  for (shift = 0; ((u | v) & 1) === 0; ++shift) {
    u >>= 1
    v >>= 1
  }

  while ((u & 1) === 0) {
    u >>= 1
  }

  do {
    while ((v & 1) === 0) {
      v >>= 1
    }

    if (u > v) {
      let t = v
      v = u
      u = t
    }
    v = v - u
  } while (v !== 0)

  return u << shift
}
