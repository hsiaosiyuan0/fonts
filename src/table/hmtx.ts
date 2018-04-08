import { ForwardBuffer } from "../forward-buffer";
import { Table, TableTag, TableRecord, repeat } from "./table";
import { uint16, uint32, int16 } from "../types";

export class LongHorMetricRecord {
  advanceWidth: uint16;
  lsb: int16;
}

export class HmtxTable extends Table {
  hMetrics: LongHorMetricRecord[] = [];
  leftSideBearings: uint16[] = [];

  numberOfHMetrics: uint16;
  numGlyphs: uint16;

  constructor(
    record: TableRecord,
    buf: Buffer | ForwardBuffer,
    offset = 0,
    numberOfHMetrics: uint16,
    numGlyphs: uint16
  ) {
    super(record, buf, offset);
    this.numberOfHMetrics = numberOfHMetrics;
    this.numGlyphs = numGlyphs;
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
        this.leftSideBearings.push(this._rb.readUInt16BE())
      );
    }
  }
}
