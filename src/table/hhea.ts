import { int16, kSizeofUInt16, uint16, uint32 } from "../types";
import { BufferWriter, ForwardBuffer } from "../util";
import { repeat, Table, TableRecord, TableTag } from "./table";

export class HheaTable extends Table {
  majorVersion: uint16;
  minorVersion: uint16;
  ascender: int16;
  descender: int16;
  lineGap: int16;
  advanceWidthMax: uint16;
  minLeftSideBearing: int16;
  minRightSideBearing: int16;
  xMaxExtent: int16;
  caretSlopeRise: int16;
  caretSlopeRun: int16;
  caretOffset: int16;
  reserved1: int16;
  reserved2: int16;
  reserved3: int16;
  reserved4: int16;
  metricDataFormat: int16;
  numberOfHMetrics: uint16;

  constructor(record?: TableRecord, buf?: Buffer | ForwardBuffer, offset = 0) {
    super(record, buf, offset);
    if (!this.record) {
      this.record = new TableRecord(TableTag.hhea);
    }
  }

  satisfy() {
    this.majorVersion = this._rb.readUInt16BE();
    this.minorVersion = this._rb.readUInt16BE();
    this.ascender = this._rb.readInt16BE();
    this.descender = this._rb.readInt16BE();
    this.lineGap = this._rb.readInt16BE();
    this.advanceWidthMax = this._rb.readUInt16BE();
    this.minLeftSideBearing = this._rb.readInt16BE();
    this.minRightSideBearing = this._rb.readInt16BE();
    this.xMaxExtent = this._rb.readInt16BE();
    this.caretSlopeRise = this._rb.readInt16BE();
    this.caretSlopeRun = this._rb.readInt16BE();
    this.caretOffset = this._rb.readInt16BE();
    this.reserved1 = this._rb.readInt16BE();
    this.reserved2 = this._rb.readInt16BE();
    this.reserved3 = this._rb.readInt16BE();
    this.reserved4 = this._rb.readInt16BE();
    this.metricDataFormat = this._rb.readInt16BE();
    this.numberOfHMetrics = this._rb.readUInt16BE();
  }

  write2(wb: BufferWriter) {
    super.write2(wb);
    wb.writeUInt16(this.majorVersion);
    wb.writeUInt16(this.minorVersion);
    wb.writeInt16(this.ascender);
    wb.writeInt16(this.descender);
    wb.writeInt16(this.lineGap);
    wb.writeUInt16(this.advanceWidthMax);
    wb.writeInt16(this.minLeftSideBearing);
    wb.writeInt16(this.minRightSideBearing);
    wb.writeInt16(this.xMaxExtent);
    wb.writeInt16(this.caretSlopeRise);
    wb.writeInt16(this.caretSlopeRun);
    wb.writeInt16(this.caretOffset);
    wb.writeInt16(this.reserved1);
    wb.writeInt16(this.reserved2);
    wb.writeInt16(this.reserved3);
    wb.writeInt16(this.reserved4);
    wb.writeInt16(this.metricDataFormat);
    wb.writeUInt16(this.numberOfHMetrics);
  }

  size() {
    const size = kSizeofUInt16 * 18;
    this.record.length = size;
    return size;
  }
}
