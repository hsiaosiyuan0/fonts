import * as bigInt from "big-integer";
import {
  int16,
  int32,
  kSizeofUInt16,
  kSizeofUInt32,
  kSizeofUInt64,
  uint16,
  uint32
} from "../types";
import { BufferWriter, ForwardBuffer } from "../util";
import { Table, TableTag, TableRecord } from "./table";

export class HeadTable extends Table {
  majorVersion: uint16;
  minorVersion: uint16;
  fontRevision: int32;
  checkSumAdjustment: uint32;
  magicNumber: uint32;
  flags: uint16;
  unitsPerEm: uint16;
  created: bigInt.BigInteger;
  modified: bigInt.BigInteger;
  xMin: int16;
  yMin: int16;
  xMax: int16;
  yMax: int16;
  macStyle: uint16;
  lowestRecPPEM: uint16;
  fontDirectionHint: int16;
  indexToLocFormat: int16;
  glyphDataFormat: int16;

  constructor(record?: TableRecord, buf?: Buffer | ForwardBuffer, offset = 0) {
    super(record, buf, offset);
    if (!this.record) {
      this.record = new TableRecord(TableTag.head);
    }
  }

  satisfy() {
    this.majorVersion = this._rb.readUInt16BE();
    this.minorVersion = this._rb.readUInt16BE();
    this.fontRevision = this._rb.readInt32BE();
    this.checkSumAdjustment = this._rb.readUInt32BE();
    this.magicNumber = this._rb.readUInt32BE();
    this.flags = this._rb.readUInt16BE();
    this.unitsPerEm = this._rb.readUInt16BE();
    this.created = this._rb.readInt64BE();
    this.modified = this._rb.readInt64BE();
    this.xMin = this._rb.readInt16BE();
    this.yMin = this._rb.readInt16BE();
    this.xMax = this._rb.readInt16BE();
    this.yMax = this._rb.readInt16BE();
    this.macStyle = this._rb.readUInt16BE();
    this.lowestRecPPEM = this._rb.readUInt16BE();
    this.fontDirectionHint = this._rb.readInt16BE();
    this.indexToLocFormat = this._rb.readInt16BE();
    this.glyphDataFormat = this._rb.readInt16BE();
  }

  write2(wb: BufferWriter) {
    super.write2(wb);
    wb.writeUInt16(this.majorVersion);
    wb.writeUInt16(this.minorVersion);
    wb.writeInt32(this.fontRevision);
    wb.writeUInt32(this.checkSumAdjustment);
    wb.writeUInt32(this.magicNumber);
    wb.writeUInt16(this.flags);
    wb.writeUInt16(this.unitsPerEm);
    wb.writeUInt64(this.created);
    wb.writeUInt64(this.modified);
    wb.writeInt16(this.xMin);
    wb.writeInt16(this.yMin);
    wb.writeInt16(this.xMax);
    wb.writeInt16(this.yMax);
    wb.writeUInt16(this.macStyle);
    wb.writeUInt16(this.lowestRecPPEM);
    wb.writeInt16(this.fontDirectionHint);
    wb.writeInt16(this.indexToLocFormat);
    wb.writeInt16(this.glyphDataFormat);
  }

  size() {
    const size = kSizeofUInt16 * 13 + kSizeofUInt32 * 3 + kSizeofUInt64 * 2;
    this.record.length = size;
    return size;
  }
}
