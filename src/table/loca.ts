import { ForwardBuffer } from "../forward-buffer";
import { Table, TableTag, TableRecord, repeat } from "./table";
import { uint16, uint32, int16 } from "../types";

export class LocaTable extends Table {
  indexToLocFormat: int16;
  numGlyphs: uint16;

  offsets: Array<uint16 | uint32> = [];

  constructor(
    record: TableRecord,
    buf: Buffer | ForwardBuffer,
    offset = 0,
    indexToLocFormat: uint16,
    numGlyphs: uint16
  ) {
    super(record, buf, offset);
    this.indexToLocFormat = indexToLocFormat;
    this.numGlyphs = numGlyphs;
  }

  satisfy() {
    if (this.indexToLocFormat === 0) {
      repeat(this.numGlyphs + 1, () => this.offsets.push(this._rb.readUInt16BE()));
    } else if (this.indexToLocFormat === 1) {
      repeat(this.numGlyphs + 1, () => this.offsets.push(this._rb.readUInt32BE()));
    } else {
      throw new Error("unreachable");
    }
  }
}
