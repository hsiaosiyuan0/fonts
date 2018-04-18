import {
  int16,
  kSizeofUInt16,
  kSizeofUInt32,
  kSizeofUInt8,
  uint16,
  uint24,
  uint32,
  uint8
} from "../types";
import { BufferWriter, ForwardBuffer } from "../util";
import { Glyph, GlyphTable } from "./glyph";
import { LocaTable } from "./loca";
import { repeat, Table, TableRecord, TableTag } from "./table";

export class EncodingRecord {
  platformId: uint16;
  encodingID: uint16;
  offset: uint32;

  static kSize = kSizeofUInt16 + kSizeofUInt16 + kSizeofUInt32;

  write2(wb: BufferWriter) {
    wb.writeUInt16(this.platformId);
    wb.writeUInt16(this.encodingID);
    wb.writeUInt32(this.offset);
  }
}

export class CPGlyphInfo {
  cp: number;
  gIdx: number;
  glyph: Glyph;
  gsub: Glyph[] = [];
}

export class LookupResult {
  cps: number[] = [];
  cpInfos: { [k: number]: CPGlyphInfo } = {};
  aloneGlyphs: Glyph[] = [];
  allGlyphIds: number[] = [];
  allGlyphs: Glyph[] = [];
  maxDepth = 0;

  getCpInfo(cp: number, insert = false) {
    let cpi = this.cpInfos[cp];
    if (!cpi) {
      cpi = new CPGlyphInfo();
      cpi.cp = cp;
      this.cpInfos[cp] = cpi;
    }
    return cpi;
  }
}

export class CmapTable extends Table {
  version: uint16;
  numTables: uint16;
  encodingRecords: EncodingRecord[] = [];

  subTables: SubTable[] = [];

  constructor(record?: TableRecord, buf?: Buffer | ForwardBuffer, offset = 0) {
    super(record, buf, offset);
    if (!this.record) {
      this.record = new TableRecord(TableTag.cmap);
    }
  }

  satisfy() {
    this.readHead();
    this.readEncodingRecords();
    this.readSubTables();
  }

  size() {
    let size = kSizeofUInt16 * 2 + this.encodingRecords.length * EncodingRecord.kSize;
    this.subTables.forEach(t => (size += t.size()));
    this.record.length = size;
    return size;
  }

  write2(wb: BufferWriter) {
    super.write2(wb);
    wb.writeUInt16(this.version);
    wb.writeUInt16(this.numTables);
    const len = this.subTables.length;
    this.subTables.forEach((t, i) => {
      if (i === 0) {
        t.encoding.offset = kSizeofUInt16 * 2 + EncodingRecord.kSize * len;
      } else {
        const prev = this.subTables[i - 1];
        t.encoding.offset = prev.encoding.offset + prev.size();
      }
    });
    this.subTables.forEach(t => t.encoding.write2(wb));
    this.subTables.forEach(t => t.write2(wb));
  }

  lookupUnicode(cps: number[], glyf: GlyphTable, loca: LocaTable) {
    let table: SubTable | null = null;
    this.subTables.every(t => {
      if (
        t.encoding.platformId === 0 ||
        (t.encoding.platformId === 3 && t.encoding.encodingID === 1)
      ) {
        table = t;
        return false;
      }
      return true;
    });
    if (table === null) throw new Error("font does not support unicode");

    const result = new LookupResult();
    const uniqueCp: { [k: number]: boolean } = {};
    cps.forEach(cp => {
      if (uniqueCp[cp] !== true) {
        result.cps.push(cp);
        uniqueCp[cp] = true;
      }
    });
    result.cps.sort((a, b) => a - b);

    result.cps.forEach(cp => {
      const sid = table!.lookup(cp);
      if (result.allGlyphIds.includes(sid)) return;

      result.allGlyphIds.push(sid);
      const rcp = result.getCpInfo(cp, true);
      rcp.gIdx = sid;
      rcp.glyph = glyf.readGlyphAt(sid, loca);
    });

    const recurveGlyph = (g: Glyph, ret: { depth: number }) => {
      if (g.isSimple) return;
      ++ret.depth;
      g.compositeGlyphTables.forEach(cg => {
        const sid = cg.glyphIndex;
        const cgg = glyf.readGlyphAt(sid, loca);
        if (!result.allGlyphIds.includes(sid)) {
          result.allGlyphIds.push(sid);
          result.aloneGlyphs.push(cgg);
        }
        if (!cgg.isSimple) {
          recurveGlyph(g, ret);
        }
      });
    };

    Object.values(result.cpInfos).forEach(({ glyph: g }) => {
      const ret = { depth: 0 };
      if (!g.isSimple) recurveGlyph(g, ret);
      result.maxDepth = Math.max(result.maxDepth, ret.depth);
    });

    let allGlyphs: Glyph[] = [];
    let gsub: Glyph[] = [];
    result.cps.forEach(cp => {
      const info = result.cpInfos[cp];
      allGlyphs.push(info.glyph);
      gsub = gsub.concat(info.gsub);
    });
    allGlyphs = allGlyphs.concat(gsub);
    result.allGlyphs = allGlyphs.concat(result.aloneGlyphs);

    return result;
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
  length: uint16 | uint32;
  language: uint16 | uint32;

  encoding: EncodingRecord;

  constructor(format: number, buf?: ForwardBuffer) {
    this.format = format;
    if (buf) this._rb = buf;
  }

  satisfy() {
    this.length = this._rb.readUInt16BE();
    this.language = this._rb.readUInt16BE();
  }

  abstract lookup(cc: number): number;

  abstract size(): number;

  abstract write2(wb: BufferWriter): void;
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

  size(): number {
    return kSizeofUInt8 * this.glyphIdxArray.length;
  }

  write2(wb: BufferWriter) {
    wb.writeUInt16(this.format);
    wb.writeUInt16(this.length);
    wb.writeUInt16(this.language);
    this.glyphIdxArray.forEach(b => wb.writeUInt8(b));
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

  static kSize = kSizeofUInt16 * 4;

  write2(wb: BufferWriter) {
    wb.writeUInt16(this.firstCode);
    wb.writeUInt16(this.entryCount);
    wb.writeInt16(this.idDelta);
    wb.writeUInt16(this.idRangeOffset);
  }
}

export class SubTableF2 extends SubTable {
  subHeaderKeys: uint16[] = [];
  subHeaders: SubHeader[] = [];
  glyphIndexArray: uint16[] = [];

  subHeaderCount = 0;

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
    const first = (cc & 0xff) >>> 8;
    const second = cc & 0x00ff;
    const key = this.subHeaderKeys[first];
    const header = this.subHeaders[key / 8];
    if (header.firstCode <= second && second < header.firstCode + header.entryCount) {
      const idx = this.glyphIndexArray[second - header.firstCode + header.idRangeStartIdx];
      if (idx !== 0) return (idx + header.idDelta) & 0xffff;
    }
    return 0;
  }

  write2(wb: BufferWriter) {
    wb.writeUInt16(this.format);
    wb.writeUInt16(this.length);
    wb.writeUInt16(this.language);
    this.subHeaderKeys.forEach(k => wb.writeUInt16(k));
    this.subHeaders.forEach(h => h.write2(wb));
    this.glyphIndexArray.forEach(i => wb.writeUInt16(i));
  }

  size() {
    let size = kSizeofUInt16 * 3;
    size += this.subHeaderKeys.length * kSizeofUInt16;
    size += this.subHeaders.length * SubHeader.kSize;
    size += this.getSubHeaderIdx.length * kSizeofUInt16;
    return size;
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
  reservedPad: uint16 = 0;
  startCount: uint16[] = [];
  idDelta: uint16[] = [];
  idRangeOffset: uint16[] = [];
  glyphIdArray: uint16[] = [];

  constructor(buf?: ForwardBuffer) {
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

        const ro = this.idRangeOffset[i];
        const startIdx = ro / kSizeofUInt16 - (len - i);
        idx = this.glyphIdArray[cc - this.startCount[i] + startIdx];
        if (idx !== 0) idx = idx + this.idDelta[i];
      }
    }
    return idx & 0xffff;
  }

  static pack(data: Array<{ cp: number; gId: number }>) {
    data.sort((a, b) => a.cp - b.cp);
    const t = new SubTableF4();
    data.forEach(({ cp, gId }) => {
      t.endCount.push(cp);
      t.startCount.push(cp);
      t.idRangeOffset.push(0);
      t.idDelta.push(0xffff & (gId - cp));
    });

    // last
    t.endCount.push(0xffff);
    t.startCount.push(0xffff);
    t.idRangeOffset.push(0);
    t.idDelta.push(1);

    const segCount = t.endCount.length;
    t.segCountX2 = segCount * 2;
    t.searchRange = 2 * Math.pow(2, Math.floor(Math.log2(segCount)));
    t.entrySelector = Math.log2(t.searchRange / 2);
    t.rangeShift = 2 * segCount - t.searchRange;
    t.length = t.size();
    return t;
  }

  write2(wb: BufferWriter) {
    wb.writeUInt16(this.format);
    wb.writeUInt16(this.length);
    wb.writeUInt16(this.language);
    wb.writeUInt16(this.segCountX2);
    wb.writeUInt16(this.searchRange);
    wb.writeUInt16(this.entrySelector);
    wb.writeUInt16(this.rangeShift);
    this.endCount.forEach(e => wb.writeUInt16(e));
    wb.writeUInt16(this.reservedPad);
    this.startCount.forEach(s => wb.writeUInt16(s));
    this.idDelta.forEach(i => wb.writeUInt16(i));
    this.idRangeOffset.forEach(i => wb.writeUInt16(i));
    this.glyphIdArray.forEach(i => wb.writeUInt16(i));
  }

  size() {
    let size = kSizeofUInt16 * 7;
    size += this.endCount.length * kSizeofUInt16;
    size += kSizeofUInt16;
    size += this.startCount.length * kSizeofUInt16;
    size += this.idDelta.length * kSizeofUInt16;
    size += this.idRangeOffset.length * kSizeofUInt16;
    size += this.glyphIdArray.length * kSizeofUInt16;
    return size;
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
    repeat(segCount, () => this.idDelta.push(this._rb.readUInt16BE()));
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

  size() {
    return kSizeofUInt16 * 3 + kSizeofUInt16 * 2 + this.glyphIdArray.length * kSizeofUInt16;
  }

  write2(wb: BufferWriter) {
    wb.writeUInt16(this.format);
    wb.writeUInt16(this.length);
    wb.writeUInt16(this.language);
    wb.writeUInt16(this.firstCode);
    wb.writeUInt16(this.entryCount);
    this.glyphIdArray.forEach(i => wb.writeUInt16(i));
  }
}

export class SequentialMapGroup {
  startCharCode: uint32;
  endCharCode: uint32;
  startGlyphID: uint32;

  static kSize = kSizeofUInt32 * 3;

  write2(wb: BufferWriter) {
    wb.writeUInt32(this.startCharCode);
    wb.writeUInt32(this.endCharCode);
    wb.writeUInt32(this.startGlyphID);
  }
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
    this.reserved = this._rb.readUInt16BE();
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

  size() {
    let size = kSizeofUInt16 * 2 + kSizeofUInt32 * 2;
    size += this.is32.length * kSizeofUInt8;
    size += kSizeofUInt32;
    size += this.groups.length * SequentialMapGroup.kSize;
    return size;
  }

  write2(wb: BufferWriter) {
    wb.writeUInt16(this.format);
    wb.writeUInt16(this.reserved);
    wb.writeUInt32(this.length);
    wb.writeUInt32(this.language);
    this.is32.forEach(i => wb.writeUInt8(i));
    wb.writeUInt32(this.numGroups);
    this.groups.forEach(g => g.write2(wb));
  }
}

export class SubTableF10 extends SubTable {
  reserved: uint16;

  startCharCode: uint32;
  numChars: uint32;
  glyphs: uint16[] = [];

  constructor(buf: ForwardBuffer) {
    super(10, buf);
  }

  satisfy() {
    this.reserved = this._rb.readUInt16BE();
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

  size() {
    return kSizeofUInt16 * 2 + kSizeofUInt32 * 2 + this.glyphs.length * kSizeofUInt16;
  }

  write2(wb: BufferWriter) {
    wb.writeUInt16(this.format);
    wb.writeUInt16(this.reserved);
    wb.writeUInt32(this.length);
    wb.writeUInt32(this.language);
    wb.writeUInt32(this.startCharCode);
    wb.writeUInt32(this.numChars);
    this.glyphs.forEach(i => wb.writeUInt16(i));
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
    for (let i = 0, len = this.numGroups; i < len; ++i) {
      const g = this.groups[i];
      if (cc >= g.startCharCode && cc <= g.endCharCode) {
        return cc - g.startCharCode + g.startGlyphID;
      }
    }
    return 0;
  }

  size() {
    return kSizeofUInt16 * 2 + kSizeofUInt32 * 3 + this.numGroups * SequentialMapGroup.kSize;
  }

  write2(wb: BufferWriter) {
    wb.writeUInt16(this.format);
    wb.writeUInt16(this.reserved);
    wb.writeUInt32(this.length);
    wb.writeUInt32(this.language);
    wb.writeUInt32(this.numGroups);
    this.groups.forEach(g => g.write2(wb));
  }
}

export class ConstantMapGroup {
  startCharCode: uint32;
  endCharCode: uint32;
  glyphID: uint32;

  static kSize = kSizeofUInt32 * 3;

  write2(wb: BufferWriter) {
    wb.writeUInt32(this.startCharCode);
    wb.writeUInt32(this.endCharCode);
    wb.writeUInt32(this.glyphID);
  }
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

  size() {
    return kSizeofUInt16 * 2 + kSizeofUInt32 * 3 + this.groups.length * ConstantMapGroup.kSize;
  }

  write2(wb: BufferWriter) {
    wb.writeUInt16(this.format);
    wb.writeUInt16(this.reserved);
    wb.writeUInt32(this.length);
    wb.writeUInt32(this.language);
    wb.writeUInt32(this.numGroups);
    this.groups.forEach(g => g.write2(wb));
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

  size() {
    return 0;
  }

  write2(wb: BufferWriter) {}
}
