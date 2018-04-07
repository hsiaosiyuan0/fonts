import { ForwardBuffer } from "../forward-buffer";
import { Table, TableTag } from "./table";
import { uint16, int32, uint32, int16 } from "../types";
import * as bigInt from "big-integer";

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

  constructor(buf: Buffer | ForwardBuffer, offset = 0) {
    super(buf, offset);
    this.tag = TableTag.head;
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
}
