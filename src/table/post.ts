import {
  int16,
  int32,
  int8,
  kSizeofUInt16,
  kSizeofUInt32,
  kSizeofUInt8,
  uint16,
  uint32,
  uint8
} from "../types";
import { BufferWriter, ForwardBuffer } from "../util";
import { repeat, Table, TableRecord, TableTag } from "./table";

export enum PostTableVersion {
  v1_0 = 0x00010000,
  v2_0 = 0x00020000,
  v2_5 = 0x00025000,
  v3_0 = 0x00030000
}

export class PascalString {
  length: uint8 = 0;
  bytes: number[] = [];

  private _str: string | null = null;
  get string() {
    if (this._str === null) {
      this._str = "";
      this.bytes.forEach(b => (this._str += String.fromCharCode(b)));
    }
    return this._str;
  }

  write2(wb: BufferWriter) {
    wb.writeUInt8(this.length);
    this.bytes.forEach(b => wb.writeUInt8(b));
  }

  size() {
    return this.bytes.length + 1;
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

  constructor(record?: TableRecord, buf?: Buffer | ForwardBuffer, offset = 0) {
    super(record, buf, offset);
    if (!this.record) {
      this.record = new TableRecord(TableTag.post);
    }
  }

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
      case PostTableVersion.v1_0:
        break;
      case PostTableVersion.v2_0: {
        this.readFormat20();
        break;
      }
      case PostTableVersion.v2_5: {
        this.readFormat25();
        break;
      }
      default:
        break;
    }
  }

  getNameV20(gIdx: number) {
    const nIdx = this.glyphNameIndex[gIdx];
    if (nIdx < 257) return nIdx;
    return this.names[nIdx - 258];
  }

  private readFormat20() {
    this.numGlyphs = this._rb.readUInt16BE();
    repeat(this.numGlyphs, () => this.glyphNameIndex.push(this._rb.readUInt16BE()));
    for (let i = 0, len = this.numGlyphs; i < len; ++i) {
      const idx = this.glyphNameIndex[i];
      if (idx > 257) {
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

  write2(wb: BufferWriter) {
    super.write2(wb);
    wb.writeInt32(this.version);
    wb.writeInt32(this.italicAngle);
    wb.writeInt16(this.underlinePosition);
    wb.writeInt16(this.underlineThickness);
    wb.writeUInt32(this.isFixedPitch);
    wb.writeUInt32(this.minMemType42);
    wb.writeUInt32(this.maxMemType42);
    wb.writeUInt32(this.minMemType1);
    wb.writeUInt32(this.maxMemType1);
    switch (this.version) {
      case PostTableVersion.v1_0:
        break;
      case PostTableVersion.v2_0: {
        wb.writeUInt16(this.numGlyphs);
        this.glyphNameIndex.forEach(i => wb.writeUInt16(i));
        this.names.forEach(n => n.write2(wb));
        break;
      }
      case PostTableVersion.v2_5: {
        wb.writeUInt16(this.numGlyphs);
        this.offset.forEach(f => wb.writeInt8(f));
        break;
      }
      default:
        break;
    }
  }

  size() {
    let size = kSizeofUInt32 * 7 + kSizeofUInt16 * 2;
    switch (this.version) {
      case PostTableVersion.v1_0:
        break;
      case PostTableVersion.v2_0: {
        size += kSizeofUInt16;
        size += this.glyphNameIndex.length * kSizeofUInt16;
        this.names.forEach(n => (size += n.size()));
        break;
      }
      case PostTableVersion.v2_5: {
        size += kSizeofUInt16;
        size += this.offset.length * kSizeofUInt8;
        break;
      }
      default:
        break;
    }
    this.record.length = size;
    return size;
  }
}
