import { ForwardBuffer, BufferWriter } from "../util";
import { Table, TableTag, TableRecord, repeat } from "./table";
import { uint16, uint32, int16, kSizeofUInt16, kSizeofUInt32 } from "../types";

export class LocaTable extends Table {
  offsets: Array<uint16 | uint32> = [];

  // not included in table data
  indexToLocFormat: int16;
  numGlyphs: uint16;

  record = new TableRecord(TableTag.loca);

  constructor(
    record?: TableRecord,
    buf?: Buffer | ForwardBuffer,
    offset = 0,
    indexToLocFormat = 0,
    numGlyphs = 0
  ) {
    super(record, buf, offset);
    this.indexToLocFormat = indexToLocFormat;
    this.numGlyphs = numGlyphs;

    if (!this.record) {
      this.record = new TableRecord(TableTag.loca);
    }
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

  idx2offset(idx: number) {
    return this.offsets[idx];
  }

  write2(wb: BufferWriter) {
    super.write2(wb);
    if (this.indexToLocFormat === 0) {
      this.offsets.forEach(f => wb.writeUInt16(f));
    } else {
      this.offsets.forEach(f => wb.writeUInt32(f));
    }
  }

  size() {
    const size =
      this.indexToLocFormat === 0
        ? this.offsets.length * kSizeofUInt16
        : this.offsets.length * kSizeofUInt32;
    this.record.length = size;
    return size;
  }
}
