import { CommonTable } from "./table";
import { BufferWriter } from "../../util";
import { uint16, kSizeofUInt16 } from "../../types";
import { repeat } from "../../table";

export class RangeRecord {
  startGlyphID: uint16;
  endGlyphID: uint16;
  startCoverageIndex: uint16;

  write2(wb: BufferWriter): void {
    wb.writeUInt16(this.startGlyphID);
    wb.writeUInt16(this.endGlyphID);
    wb.writeUInt16(this.startCoverageIndex);
  }

  static kSize = kSizeofUInt16 * 3;
}

export class CoverageTable extends CommonTable {
  coverageFormat: uint16;

  // format 1
  glyphCount: uint16;
  glyphArray: uint16[] = [];

  // format 2
  rangeCount: uint16;
  rangeRecords: RangeRecord[] = [];

  satisfy(): void {
    this.coverageFormat = this._rb.readUInt16BE();
    if (this.coverageFormat === 1) {
      this.readFormat1();
    } else if (this.coverageFormat === 2) {
      this.readFormat2();
    } else {
      throw new Error("unreachable");
    }
  }

  write2(wb: BufferWriter): void {
    wb.writeUInt16(this.coverageFormat);
    if (this.coverageFormat === 1) {
      wb.writeUInt16(this.glyphCount);
      repeat(this.glyphCount, i => wb.writeUInt16(this.glyphArray[i]));
    } else if (this.coverageFormat === 2) {
      wb.writeUInt16(this.rangeCount);
      repeat(this.rangeCount, i => this.rangeRecords[i].write2(wb));
    } else {
      throw new Error("unreachable");
    }
  }

  size(): number {
    let size = kSizeofUInt16;
    if (this.coverageFormat === 1) {
      size += kSizeofUInt16;
      size += kSizeofUInt16 * this.glyphCount;
    } else if (this.coverageFormat === 2) {
      size += kSizeofUInt16;
      size += this.glyphCount * RangeRecord.kSize;
    } else {
      throw new Error("unreachable");
    }
    return size;
  }

  private readFormat1() {
    this.glyphCount = this._rb.readUInt16BE();
    repeat(this.glyphCount, () => this.glyphArray.push(this._rb.readUInt16BE()));
  }

  private readFormat2() {
    this.rangeCount = this._rb.readUInt16BE();
    repeat(this.rangeCount, () => {
      const r = new RangeRecord();
      r.startGlyphID = this._rb.readUInt16BE();
      r.endGlyphID = this._rb.readUInt16BE();
      r.startCoverageIndex = this._rb.readUInt16BE();
      this.rangeRecords.push(r);
    });
  }
}
