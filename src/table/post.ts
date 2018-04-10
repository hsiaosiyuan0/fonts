import { ForwardBuffer } from "../forward-buffer";
import { Table, TableTag, TableRecord, repeat } from "./table";
import { uint16, uint32, int16, int32, int8, uint8 } from "../types";

export class PascalString {
  length: uint8;
  bytes: number[] = [];

  private _str: string | null = null;
  get string() {
    if (this._str === null) {
      this._str = "";
      this.bytes.forEach(b => (this._str += String.fromCharCode(b)));
    }
    return this._str;
  }
}

export class PostTable extends Table {
  version: int32;
  italicAngle: int32;
  underlinePosition: int16;
  underlineThickness: int16;
  isFixedPitch: uint32;
  minMemType42: uint32;
  maxMemType42: uint32;
  minMemType1: uint32;
  maxMemType1: uint32;

  // format 2.0
  numGlyphs: uint16;
  glyphNameIndex: uint16[] = [];
  names: PascalString[] = [];

  // format 2.5
  offset: int8[] = [];

  satisfy() {
    this.version = this._rb.readInt32BE();
    this.italicAngle = this._rb.readInt32BE();
    this.underlinePosition = this._rb.readInt16BE();
    this.underlineThickness = this._rb.readInt16BE();
    this.isFixedPitch = this._rb.readUInt32BE();
    this.minMemType42 = this._rb.readUInt32BE();
    this.maxMemType42 = this._rb.readUInt32BE();
    this.minMemType1 = this._rb.readUInt32BE();
    this.maxMemType1 = this._rb.readUInt32BE();

    switch (this.version) {
      case 0x00010000:
        break;
      case 0x00020000: {
        this.readFormat20();
        break;
      }
      case 0x00025000: {
        this.readFormat25();
        break;
      }
      default:
        break;
    }
  }

  private readFormat20() {
    this.numGlyphs = this._rb.readUInt16BE();
    repeat(this.numGlyphs, () => this.glyphNameIndex.push(this._rb.readUInt16BE()));
    for (let i = 0, len = this.numGlyphs; i < len; ++i) {
      if (this.glyphNameIndex[i] > 257) {
        const str = new PascalString();
        str.length = this._rb.readUInt8();
        repeat(str.length, () => str.bytes.push(this._rb.readUInt8()));
        this.names.push(str);
      }
    }
  }

  private readFormat25() {
    this.numGlyphs = this._rb.readUInt16BE();
    repeat(this.numGlyphs, () => this.offset.push(this._rb.readInt8()));
  }
}
