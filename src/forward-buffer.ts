export class ForwardBuffer {
  private _buf: Buffer;
  private _ofst: number;

  get buffer() {
    return this._buf;
  }

  get offset() {
    return this._ofst;
  }

  constructor(buf: Buffer, offset: number) {
    this._buf = buf;
    this._ofst = offset;
  }

  readUInt8() {
    const n = this._buf.readUInt8(this._ofst);
    this._ofst += 1;
    return n;
  }

  readUInt16BE() {
    const n = this._buf.readUInt16BE(this._ofst);
    this._ofst += 2;
    return n;
  }

  readUInt32BE() {
    const n = this._buf.readUInt32BE(this._ofst);
    this._ofst += 4;
    return n;
  }

  readInt16BE() {
    const n = this._buf.readInt16BE(this._ofst);
    this._ofst += 2;
    return n;
  }

  forward(cnt: number, wrap = false) {
    // does not use a Buffer.slice here
    // since we need a boundary check
    const r = new Buffer(cnt);
    for (let i = 0; i < cnt; ++i) {
      r.writeUInt8(this.readUInt8(), i);
    }
    if (wrap) return new ForwardBuffer(r, 0);
    return r;
  }

  advance(cnt: number) {
    this._ofst += cnt;
  }

  branch(offset = 0) {
    return new ForwardBuffer(this._buf, offset);
  }
}
