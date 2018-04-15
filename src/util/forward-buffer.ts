import * as bigInt from "big-integer";
import { kSizeofUInt8, kSizeofUInt32, kSizeofUInt16 } from "../types";

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
    this._ofst += kSizeofUInt8;
    return n;
  }

  readUInt16BE() {
    const n = this._buf.readUInt16BE(this._ofst);
    this._ofst += kSizeofUInt16;
    return n;
  }

  readUInt32BE() {
    const n = this._buf.readUInt32BE(this._ofst);
    this._ofst += kSizeofUInt32;
    return n;
  }

  readInt8() {
    const n = this._buf.readInt8(this._ofst);
    this._ofst += kSizeofUInt8;
    return n;
  }

  readInt16BE() {
    const n = this._buf.readInt16BE(this._ofst);
    this._ofst += kSizeofUInt16;
    return n;
  }

  readInt32BE() {
    const n = this._buf.readInt32BE(this._ofst);
    this._ofst += kSizeofUInt32;
    return n;
  }

  readInt64BE() {
    const fi32 = this.readInt32BE();
    const si32 = this.readUInt32BE();
    return bigInt(fi32)
      .shiftLeft(32)
      .or(si32);
  }

  readUInt64BE() {
    const fi32 = this.readUInt32BE();
    const si32 = this.readUInt32BE();
    return bigInt(fi32)
      .shiftLeft(32)
      .or(si32);
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
