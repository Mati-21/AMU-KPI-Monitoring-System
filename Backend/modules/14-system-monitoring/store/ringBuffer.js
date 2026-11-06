/**
 * A list that keeps only its newest items, so what is remembered never grows.
 */
export class RingBuffer {
  constructor(size) {
    this.size = size;
    this.items = [];
  }

  push(item) {
    this.items.push(item);
    if (this.items.length > this.size) this.items.shift();
  }

  toArray() {
    return [...this.items];
  }

  last(count = 1) {
    return this.items.slice(-count);
  }
}

export default RingBuffer;
