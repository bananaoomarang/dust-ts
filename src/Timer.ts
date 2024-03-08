export default class Timer {
  start = new Date().getTime()

  getTime = (): number => {
    const currentTime = new Date().getTime()

    return currentTime - this.start
  }

  reset = () => {
    this.start = new Date().getTime()
  }
}
