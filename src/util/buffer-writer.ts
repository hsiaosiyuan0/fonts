import * as bigInt from "big-integer";
import * as os from "os";
import {
  int16,
  int32,
  int8,
  kSizeofUInt16,
  kSizeofUInt32,
  kSizeofUInt8,
  uint16,
  uint32,
  uint8
} from "../types";

export class BufferWriter {
  protected _cap: number;
  protected _len: number;

  protected _wb: Buffer;

  get capacity() {
    return this._cap;
  }

  get length() {
    return this._len;
  }

  get buffer() {
    return this._wb;
  }

  constructor(cap: number = 1 << 10) {
    this._cap = cap;
    this._wb = Buffer.alloc(cap);
    this._len = 0;
  }

  protected guard(len2write: number) {
    if (this._len + len2write > this._cap) {
      this._cap = (this._len + len2write) * 2;
      this._wb = Buffer.alloc(this._cap, this._wb);
    }
  }

  write(b: Buffer) {
    this.guard(b.length);
    for (let i = 0, len = b.length; i < len; ++i) {
      this._wb.writeUInt8(b.readUInt8(i), this._len);
      this._len += kSizeofUInt8;
    }
  }

  writeInt8(n: int8) {
    this.guard(kSizeofUInt8);
    this._wb.writeInt8(n, this._len);
    this._len += kSizeofUInt8;
  }

  writeInt16(n: int16) {
    this.guard(kSizeofUInt16);
    this._wb.writeInt16BE(n, this._len);
    this._len += kSizeofUInt16;
  }

  writeInt32(n: int32) {
    this.guard(kSizeofUInt32);
    this._wb.writeInt32BE(n, this._len);
    this._len += kSizeofUInt32;
  }

  writeUInt8(n: int8) {
    this.guard(kSizeofUInt8);
    this._wb.writeUInt8(n, this._len);
    this._len += kSizeofUInt8;
  }

  writeUInt16(n: int16) {
    this.guard(kSizeofUInt16);
    this._wb.writeUInt16BE(n, this._len);
    this._len += kSizeofUInt16;
  }

  writeUInt32(n: int32) {
    this.guard(kSizeofUInt32);
    this._wb.writeUInt32BE(n, this._len);
    this._len += kSizeofUInt32;
  }

  writeUInt64(n: bigInt.BigInteger) {
    const f = n.shiftRight(32).toJSNumber();
    const s = n.and("0xffffffff").toJSNumber();
    this.writeUInt32(f);
    this.writeUInt32(s);
  }

  writeInt64(n: bigInt.BigInteger) {
    const f = n.shiftRight(32).toJSNumber();
    const s = n.and("0xffffffff").toJSNumber();
    this.writeInt32(f);
    this.writeUInt32(s);
  }
}
