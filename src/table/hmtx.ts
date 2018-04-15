import { ForwardBuffer, BufferWriter } from "../util";
import { Table, TableTag, TableRecord, repeat } from "./table";
import { uint16, uint32, int16, kSizeofUInt16 } from "../types";

export class LongHorMetricRecord {
  advanceWidth: uint16;
  lsb: int16;

  write2(wb: BufferWriter) {
    wb.writeUInt16(this.advanceWidth);
    wb.writeInt16(this.lsb);
  }

  static kSize = kSizeofUInt16 * 2;
}

export class HmtxTable extends Table {
  hMetrics: LongHorMetricRecord[] = [];
  leftSideBearings: uint16[] = [];

  // not included in table data
  numberOfHMetrics: uint16;
  numGlyphs: uint16;

  constructor(
    record?: TableRecord,
    buf?: Buffer | ForwardBuffer,
    offset = 0,
    numberOfHMetrics = 0,
    numGlyphs = 0
  ) {
    super(record, buf, offset);
    this.numberOfHMetrics = numberOfHMetrics;
    this.numGlyphs = numGlyphs;

    if (!this.record) {
      this.record = new TableRecord(TableTag.hmtx);
    }
  }

  satisfy() {
    repeat(this.numberOfHMetrics, () => {
      const r = new LongHorMetricRecord();
      r.advanceWidth = this._rb.readUInt16BE();
      r.lsb = this._rb.readInt16BE();
      this.hMetrics.push(r);
    });

    if (this.numberOfHMetrics < this.numGlyphs) {
      repeat(this.numGlyphs - this.numberOfHMetrics, () =>
        this.leftSideBearings.push(this._rb.readInt16BE())
      );
    }
  }

  write2(wb: BufferWriter) {
    super.write2(wb);
    this.hMetrics.forEach(h => h.write2(wb));
    this.leftSideBearings.forEach(b => wb.writeInt16(b));
  }

  size() {
    const size =
      this.hMetrics.length * LongHorMetricRecord.kSize +
      this.leftSideBearings.length * kSizeofUInt16;
    this.record.length = size;
    return size;
  }
}
