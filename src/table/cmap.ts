import { ForwardBuffer } from "../forward-buffer";
import { int16, kSizeofUInt16, uint16, uint24, uint32, uint8 } from "../types";
import { Table, TableTag, repeat, TableRecord } from "./table";

export class EncodingRecord {
  platformId: uint16;
  encodingID: uint16;
  offset: uint32;
}

export class CmapTable extends Table {
  version: uint16;
  numTables: uint16;
  encodingRecords: EncodingRecord[] = [];

  subTables: SubTable[] = [];

  satisfy() {
    this.readHead();
    this.readEncodingRecords();
    this.readSubTables();
  }

  private readHead() {
    this.version = this._rb.readUInt16BE();
    this.numTables = this._rb.readUInt16BE();
  }

  private readEncodingRecords() {
    repeat(this.numTables, () => {
      const r = new EncodingRecord();
      r.platformId = this._rb.readUInt16BE();
      r.encodingID = this._rb.readUInt16BE();
      r.offset = this._rb.readUInt32BE();
      this.encodingRecords.push(r);
    });
  }

  private readSubTables() {
    this.encodingRecords.forEach(r => {
      const buf = this._rb.branch(this._beginOfst + r.offset);
      const format = buf.readUInt16BE();
      switch (format) {
        case 0: {
          const st = new SubTableF0(buf);
          st.encoding = r;
          this.subTables.push(st);
          st.satisfy();
          break;
        }
        case 2: {
          const st = new SubTableF2(buf);
          st.encoding = r;
          this.subTables.push(st);
          st.satisfy();
          break;
        }
        case 4: {
          const st = new SubTableF4(buf);
          st.encoding = r;
          this.subTables.push(st);
          st.satisfy();
          break;
        }
        case 6: {
          const st = new SubTableF6(buf);
          st.encoding = r;
          this.subTables.push(st);
          st.satisfy();
          break;
        }
        case 8: {
          const st = new SubTableF8(buf);
          st.encoding = r;
          this.subTables.push(st);
          st.satisfy();
          break;
        }
        case 10: {
          const st = new SubTableF10(buf);
          st.encoding = r;
          this.subTables.push(st);
          st.satisfy();
          break;
        }
        case 12: {
          const st = new SubTableF12(buf);
          st.encoding = r;
          this.subTables.push(st);
          st.satisfy();
          break;
        }
        case 13: {
          const st = new SubTableF13(buf);
          st.encoding = r;
          this.subTables.push(st);
          st.satisfy();
          break;
        }
        case 14: {
          const st = new SubTableF14(buf);
          st.encoding = r;
          this.subTables.push(st);
          st.satisfy();
          break;
        }
        default:
          break;
      }
    });
  }
}

export abstract class SubTable {
  protected _rb: ForwardBuffer;

  format: uint16 = 0;
  length: uint32;
  language: uint32;

  encoding: EncodingRecord;

  constructor(format: number, buf: ForwardBuffer) {
    this.format = format;
    this._rb = buf;
  }

  satisfy() {
    this.length = this._rb.readUInt16BE();
    this.language = this._rb.readUInt16BE();
  }

  abstract lookup(cc: number): number;
}

// Format 0: Byte encoding table
// https://docs.microsoft.com/en-us/typography/opentype/spec/cmap#format-0-byte-encoding-table
export class SubTableF0 extends SubTable {
  glyphIdxArray: uint8[] = [];

  constructor(buf: ForwardBuffer) {
    super(0, buf);
  }

  satisfy() {
    super.satisfy();
    repeat(256, () => this.glyphIdxArray.push(this._rb.readUInt8()));
  }

  lookup(cc: number) {
    return this.glyphIdxArray[cc & 0x00ff];
  }
}

export const kSizeofSubHeader = 8;

export class SubHeader {
  firstCode: uint16;
  entryCount: uint16;
  idDelta: int16;
  idRangeOffset: uint16;

  pos: [number, number] = [0, 0];

  // idx starts from the beginning of glyphIndexArray
  get idRangeStartIdx() {
    if (this.idRangeOffset === 0) return 0;
    const [len, idx] = this.pos;
    return this.idRangeOffset - (len - idx - 1) * kSizeofSubHeader - kSizeofUInt16;
  }
}

export class SubTableF2 extends SubTable {
  subHeaderKeys: uint16[] = [];
  subHeaderCount = 0;
  subHeaders: SubHeader[] = [];
  glyphIndexArray: uint16[] = [];

  constructor(buf: ForwardBuffer) {
    super(2, buf);
  }

  satisfy() {
    super.satisfy();
    this.readSubHeaderKeys();
    this.readSubHeaders();
    this.readGlyphIndexArray();
  }

  lookup(cc: number) {
    const first = cc >>> 8;
    const second = cc & 0x00ff;
    const key = this.subHeaderKeys[first];
    const header = this.subHeaders[key / 8];
    if (header.firstCode <= second && second < header.firstCode + header.entryCount) {
      const idx = this.glyphIndexArray[second - header.firstCode + header.idRangeStartIdx];
      if (idx !== 0) return (idx + header.idDelta) & 0xffff;
    }
    return 0;
  }

  private readSubHeaderKeys() {
    let maxIdx = 0;
    repeat(256, () => {
      const v = this._rb.readUInt16BE();
      const idx = v / 8;
      maxIdx = Math.max(maxIdx, idx);
      this.subHeaderKeys.push(v);
    });
    this.subHeaderCount = maxIdx + 1;
  }

  private getSubHeaderIdx(key: uint8) {
    const v = this.subHeaderKeys[key];
    return v / 8;
  }

  private readSubHeaders() {
    const len = this.subHeaderCount;
    repeat(len, i => {
      const h = new SubHeader();
      h.firstCode = this._rb.readUInt16BE();
      h.entryCount = this._rb.readUInt16BE();
      h.idDelta = this._rb.readInt16BE();
      h.idRangeOffset = this._rb.readUInt16BE();
      h.pos[0] = len;
      h.pos[1] = i;
      this.subHeaders.push(h as any);
    });
  }

  private readGlyphIndexArray() {
    let len = this.length - (3 + 256) * kSizeofUInt16 - this.subHeaderCount * kSizeofSubHeader;
    len = len / kSizeofUInt16;
    repeat(len, () => this.glyphIndexArray.push(this._rb.readInt16BE()));
  }
}

export class SubTableF4 extends SubTable {
  segCountX2: uint16;
  searchRange: uint16;
  entrySelector: uint16;
  rangeShift: uint16;
  endCount: uint16[] = [];
  reservedPad: uint16;
  startCount: uint16[] = [];
  idDelta: int16[] = [];
  idRangeOffset: uint16[] = [];
  glyphIdArray: uint16[] = [];

  constructor(buf: ForwardBuffer) {
    super(4, buf);
  }

  satisfy() {
    super.satisfy();
    this.readHeader();
    this.readSegments();
    this.readGlyphIdArray();
  }

  lookup(cc: uint16) {
    let idx = 0;
    for (let i = 0, len = this.segCountX2 / 2; i < len; ++i) {
      if (cc <= this.endCount[i] && cc >= this.startCount[i]) {
        if (this.idRangeOffset[i] === 0) {
          idx = cc + this.idDelta[i];
          break;
        }

        const startIdx = (this.idRangeOffset[i] - (len - i) * kSizeofUInt16) / kSizeofUInt16;
        idx = cc - this.startCount[i] + startIdx;
        if (idx === 0) idx = idx + this.idDelta[i];
      }
    }
    return idx & 0xffff;
  }

  private readHeader() {
    this.segCountX2 = this._rb.readUInt16BE();
    this.searchRange = this._rb.readUInt16BE();
    this.entrySelector = this._rb.readUInt16BE();
    this.rangeShift = this._rb.readInt16BE();
  }

  private readSegments() {
    const segCount = this.segCountX2 / 2;
    repeat(segCount, () => this.endCount.push(this._rb.readUInt16BE()));
    this.reservedPad = this._rb.readUInt16BE();
    repeat(segCount, () => this.startCount.push(this._rb.readUInt16BE()));
    repeat(segCount, () => this.idDelta.push(this._rb.readInt16BE()));
    repeat(segCount, () => this.idRangeOffset.push(this._rb.readUInt16BE()));
  }

  private readGlyphIdArray() {
    const segCount = this.segCountX2 / 2;
    let len = this.length - 8 * kSizeofUInt16 - 4 * segCount * kSizeofUInt16;
    len = len / kSizeofUInt16;
    repeat(len, () => this.glyphIdArray.push(this._rb.readUInt16BE()));
  }
}

export class SubTableF6 extends SubTable {
  firstCode: uint16;
  entryCount: uint16;
  glyphIdArray: uint16[] = [];

  constructor(buf: ForwardBuffer) {
    super(6, buf);
  }

  satisfy() {
    super.satisfy();
    this.firstCode = this._rb.readUInt16BE();
    this.entryCount = this._rb.readUInt16BE();
    repeat(this.entryCount, () => this.glyphIdArray.push(this._rb.readUInt16BE()));
  }

  lookup(cc: number) {
    const idx = cc - this.firstCode;
    if (idx < this.entryCount) return this.glyphIdArray[idx];
    return 0;
  }
}

export class SequentialMapGroup {
  startCharCode: uint32;
  endCharCode: uint32;
  startGlyphID: uint32;
}

export class SubTableF8 extends SubTable {
  reserved: uint16;
  is32: uint8[] = [];
  numGroups: uint32;
  groups: SequentialMapGroup[] = [];

  constructor(buf: ForwardBuffer) {
    super(8, buf);
  }

  satisfy() {
    this.reserved = this._rb.readUInt32BE();
    super.satisfy();
    repeat(8192, () => this.is32.push(this._rb.readUInt8()));
    this.numGroups = this._rb.readUInt32BE();
    repeat(this.numGroups, () => {
      const s = new SequentialMapGroup();
      s.startCharCode = this._rb.readUInt32BE();
      s.endCharCode = this._rb.readUInt32BE();
      s.startGlyphID = this._rb.readUInt32BE();
      this.groups.push(s);
    });
  }

  lookup(cc: number) {
    for (let i = 0, len = this.groups.length; i < len; ++i) {
      const g = this.groups[i];
      if (cc >= g.startCharCode && cc <= g.endCharCode) {
        return cc - g.startCharCode + g.startGlyphID;
      }
    }
    return 0;
  }
}

export class SubTableF10 extends SubTable {
  startCharCode: uint32;
  numChars: uint32;
  glyphs: uint16[] = [];

  constructor(buf: ForwardBuffer) {
    super(10, buf);
  }

  satisfy() {
    super.satisfy();
    this.startCharCode = this._rb.readUInt32BE();
    this.numChars = this._rb.readUInt32BE();
    repeat(this.numChars, () => this.glyphs.push(this._rb.readUInt16BE()));
  }

  lookup(cc: number) {
    const idx = cc - this.startCharCode;
    if (idx < this.numChars) return this.glyphs[idx];
    return 0;
  }
}

export class SubTableF12 extends SubTable {
  reserved: uint16;
  numGroups: uint32;
  groups: SequentialMapGroup[] = [];

  constructor(buf: ForwardBuffer) {
    super(12, buf);
  }

  satisfy() {
    this.reserved = this._rb.readUInt16BE();
    super.satisfy();
    this.numGroups = this._rb.readUInt32BE();
    repeat(this.numGroups, () => {
      const s = new SequentialMapGroup();
      s.startCharCode = this._rb.readUInt32BE();
      s.endCharCode = this._rb.readUInt32BE();
      s.startGlyphID = this._rb.readUInt32BE();
      this.groups.push(s);
    });
  }

  lookup(cc: number) {
    for (let i = 0, len = this.groups.length; i < len; ++i) {
      const g = this.groups[i];
      if (cc >= g.startCharCode && cc <= g.endCharCode) {
        return cc - g.startCharCode + g.startGlyphID;
      }
    }
    return 0;
  }
}

export class ConstantMapGroup {
  startCharCode: uint32;
  endCharCode: uint32;
  glyphID: uint32;
}

export class SubTableF13 extends SubTable {
  reserved: uint16;
  numGroups: uint32;
  groups: ConstantMapGroup[] = [];

  constructor(buf: ForwardBuffer) {
    super(13, buf);
  }

  satisfy() {
    this.reserved = this._rb.readUInt16BE();
    super.satisfy();
    this.numGroups = this._rb.readUInt32BE();
    repeat(this.numGroups, () => {
      const c = new ConstantMapGroup();
      c.startCharCode = this._rb.readUInt32BE();
      c.endCharCode = this._rb.readUInt32BE();
      c.glyphID = this._rb.readUInt32BE();
      this.groups.push(c);
    });
  }

  lookup(cc: number) {
    for (let i = 0, len = this.groups.length; i < len; ++i) {
      const g = this.groups[i];
      if (cc >= g.startCharCode && cc <= g.endCharCode) {
        return g.glyphID;
      }
    }
    return 0;
  }
}

export class UnicodeRange {
  startUnicodeValue: uint24;
  additionalCount: uint8;
}

export class DefaultUVS {
  numUnicodeValueRanges: uint32;
  ranges: UnicodeRange[] = [];
}

export class NonDefaultUVS {
  numUVSMappings: uint32;
  uvsMappings: UVSMapping[] = [];
}

export class UVSMapping {
  unicodeValue: uint24;
  glyphID: uint16;
}

export class VariationSelector {
  private _rb: ForwardBuffer;
  private _beginOfst: number;

  varSelector: uint24;
  defaultUVSOffset: uint32;
  nonDefaultUVSOffset: uint32;

  defaultUVS: DefaultUVS;
  nonDefaultUVS: NonDefaultUVS;

  constructor(buf: ForwardBuffer) {
    this._rb = buf;
    this._beginOfst = buf.offset;
  }

  satisfy() {
    this.readDefaultUVS();
    this.readNonDefaultUVS();
  }

  private readDefaultUVS() {
    const buf = this._rb.branch();
    buf.advance(this.defaultUVSOffset);
    const d = new DefaultUVS();
    d.numUnicodeValueRanges = buf.readUInt32BE();
    repeat(d.numUnicodeValueRanges, () => {
      const u = new UnicodeRange();
      const b1 = buf.readUInt8();
      const b2 = buf.readUInt8();
      const b3 = buf.readUInt8();
      u.startUnicodeValue = (b1 << 16) | (b2 << 8) | b3;
      u.additionalCount = buf.readUInt8();
      d.ranges.push(u);
    });
  }

  private readNonDefaultUVS() {
    const buf = this._rb.branch();
    buf.advance(this.nonDefaultUVSOffset);
    const d = new NonDefaultUVS();
    d.numUVSMappings = buf.readUInt32BE();
    repeat(d.numUVSMappings, () => {
      const u = new UVSMapping();
      const b1 = buf.readUInt8();
      const b2 = buf.readUInt8();
      const b3 = buf.readUInt8();
      u.unicodeValue = (b1 << 16) | (b2 << 8) | b3;
      u.glyphID = buf.readUInt16BE();
      d.uvsMappings.push(u);
    });
  }
}

export class SubTableF14 extends SubTable {
  private _beginOfst: number;

  numVarSelectorRecords: uint32;
  varSelector: VariationSelector[] = [];

  constructor(buf: ForwardBuffer) {
    super(14, buf);
    this._beginOfst = buf.offset;
  }

  satisfy() {
    this.length = this._rb.readUInt32BE();
    this.numVarSelectorRecords = this._rb.readUInt32BE();
    repeat(this.numVarSelectorRecords, () => {
      const b1 = this._rb.readUInt8();
      const b2 = this._rb.readUInt8();
      const b3 = this._rb.readUInt8();
      const v = new VariationSelector(this._rb.branch(this._beginOfst));
      v.varSelector = (b1 << 16) | (b2 << 8) | b3;
      v.defaultUVSOffset = this._rb.readUInt32BE();
      v.nonDefaultUVSOffset = this._rb.readUInt32BE();
      v.satisfy();
      this.varSelector.push(v);
    });
  }

  lookup(cc: number) {
    return 0;
  }
}
