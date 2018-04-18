import { ForwardBuffer, BufferWriter } from "../../util";

export abstract class CommonTable {
  protected _rb: ForwardBuffer;
  protected _beginOfst: number;

  constructor(buf?: Buffer | ForwardBuffer, offset = 0) {
    if (buf instanceof ForwardBuffer) {
      this._rb = buf;
      this._beginOfst = buf.offset;
    } else if (buf instanceof Buffer) {
      this._rb = new ForwardBuffer(buf, offset);
      this._beginOfst = offset;
    }
  }

  as<T>(): T {
    return this as any;
  }

  abstract satisfy(): void;

  abstract write2(wb: BufferWriter): void;

  abstract size(): number;
}
