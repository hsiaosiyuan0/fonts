import { ForwardBuffer } from "../forward-buffer";
import { Table, TableTag, TableRecord, repeat } from "./table";
import { uint16, uint32, int16 } from "../types";

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
}
