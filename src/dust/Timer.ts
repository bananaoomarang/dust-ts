export default class Timer {
  start = Date.now()

  getTime = (): number => {
    const currentTime = Date.now()

    return currentTime - this.start
  }

  reset = () => {
    this.start = Date.now()
  }
}
