import * as assert from "assert";
import {
  CmapTable,
  EncodingRecord,
  Glyph,
  GlyphTable,
  HeadTable,
  HheaTable,
  HmtxTable,
  LocaTable,
  MaxpTable,
  NameTable,
  parseOrderOfTableRecord,
  PostTable,
  SubTableF12,
  Table,
  TableRecord,
  TableTag,
  kTTFRequiredTags
} from "./table";
import { kSizeofUInt16, kSizeofUInt32, uint16, uint32, uint8 } from "./types";
import { BufferWriter, ForwardBuffer } from "./util";
import { GsubTable } from "./table/gsub";

export class OffsetTable {
  sfntVersion: uint32;
  numTables: uint16;
  searchRange: uint16;
  entrySelector: uint16;
  rangeShift: uint16;

  write2(wb: BufferWriter) {
    wb.writeUInt32(this.sfntVersion);
    wb.writeUInt16(this.numTables);
    wb.writeUInt16(this.searchRange);
    wb.writeUInt16(this.entrySelector);
    wb.writeInt16(this.rangeShift);
  }

  static kSize = kSizeofUInt32 + 4 * kSizeofUInt16;
}

export class RawTable extends Table {
  bytes: Buffer;

  constructor(record?: TableRecord, buf?: Buffer | ForwardBuffer, offset = 0) {
    super(record, buf, offset);
    if (!this.record) {
      this.record = new TableRecord(TableTag.raw);
    }
  }

  satisfy() {
    const { offset, length } = this.record;
    this.bytes = this._rb.buffer.slice(offset, offset + length);
  }

  write2(wb: BufferWriter) {
    super.write2(wb);
    wb.write(this.bytes);
  }

  size() {
    return this.bytes.length;
  }
}

export class Font {
  private _rb: ForwardBuffer;

  offsetTable: OffsetTable;
  tableRecords: TableRecord[] = [];

  tables = new Map<TableTag, Table>();
  rawTables: RawTable[] = [];

  constructor();
  constructor(buf: Buffer | ForwardBuffer, offset?: number);
  constructor(buf?: Buffer | ForwardBuffer, offset = 0) {
    if (!buf) return;
    this._rb = buf instanceof ForwardBuffer ? buf : new ForwardBuffer(buf, offset);
  }

  satisfy() {
    this.readOffsetTable();
    this.readTableRecords();
    this.readTables();
  }

  updateOffsetTable(numTables: number) {
    if (!this.offsetTable) {
      this.offsetTable = new OffsetTable();
      this.offsetTable.sfntVersion = 0x00010000;
    }
    this.offsetTable.numTables = numTables;
    // checkout https://www.geeksforgeeks.org/highest-power-2-less-equal-given-number
    const mp2 = Math.pow(2, Math.floor(Math.log2(numTables)));
    this.offsetTable.searchRange = mp2 * 16;
    this.offsetTable.entrySelector = Math.log2(mp2);
    this.offsetTable.rangeShift = numTables * 16 - this.offsetTable.searchRange;
  }

  write2(wb: BufferWriter) {
    const tables = Array.from(this.tables.values()).concat(this.rawTables);
    tables.sort((a, b) => {
      return a.record.tag - b.record.tag;
    });
    const len = tables.length;
    this.updateOffsetTable(len);
    this.offsetTable.write2(wb);
    tables.forEach((t, i) => {
      // calc byte size
      t.size();
      if (i === 0) {
        t.record.offset = OffsetTable.kSize + len * TableRecord.kSize;
      } else {
        const prev = tables[i - 1];
        t.record.offset = prev.record.offset + prev.record.length;
      }
      const delta = t.record.offset & 3;
      if (delta !== 0) {
        const padding = 4 - delta;
        t.record.offset += padding;
        t.record.padding = padding;
      }
      t.record.write2(wb);
    });
    tables.forEach(t => {
      wb.pushWriteGuard(t.size() + t.record.padding, `write table ` + t.record.tagName);
      t.write2(wb);
      wb.applyWriteGuard();
    });
  }

  addTable(table: Table) {
    if (table instanceof CmapTable) {
      this.tables.set(TableTag.cmap, table);
    } else if (table instanceof GlyphTable) {
      this.tables.set(TableTag.glyf, table);
    } else if (table instanceof LocaTable) {
      this.tables.set(TableTag.loca, table);
    } else if (table instanceof MaxpTable) {
      this.tables.set(TableTag.maxp, table);
    } else if (table instanceof HmtxTable) {
      this.tables.set(TableTag.hmtx, table);
    } else if (table instanceof PostTable) {
      this.tables.set(TableTag.post, table);
    } else if (table instanceof HheaTable) {
      this.tables.set(TableTag.hhea, table);
    } else if (table instanceof HeadTable) {
      this.tables.set(TableTag.head, table);
    } else if (table instanceof GsubTable) {
      this.tables.set(TableTag.GSUB, table);
    } else if (table instanceof RawTable) {
      this.rawTables.push(table);
    }
  }

  private readOffsetTable() {
    const tbl = new OffsetTable();
    tbl.sfntVersion = this._rb.readUInt32BE();
    tbl.numTables = this._rb.readUInt16BE();
    tbl.searchRange = this._rb.readUInt16BE();
    tbl.entrySelector = this._rb.readUInt16BE();
    tbl.rangeShift = this._rb.readUInt16BE();
    this.offsetTable = tbl;
  }

  private readTableRecords() {
    for (let i = 0, len = this.offsetTable.numTables; i < len; ++i) {
      const r = new TableRecord();
      r.tag = this._rb.readUInt32BE();
      r.checkSum = this._rb.readUInt32BE();
      r.offset = this._rb.readUInt32BE();
      r.length = this._rb.readUInt32BE();
      this.tableRecords.push(r);
    }
    this.tableRecords.sort((a, b) => {
      const oa = parseOrderOfTableRecord(a.tag);
      const ob = parseOrderOfTableRecord(b.tag);
      return oa - ob;
    });
  }

  private readTables() {
    this.tableRecords.forEach(r => this.readTable(r));
  }

  private readTable(r: TableRecord) {
    switch (r.tag) {
      case TableTag.cmap: {
        const t = new CmapTable(r, this._rb.buffer, r.offset);
        this.tables.set(r.tag, t);
        t.satisfy();
        break;
      }
      case TableTag.head: {
        const t = new HeadTable(r, this._rb.buffer, r.offset);
        this.tables.set(r.tag, t);
        t.satisfy();
        break;
      }
      case TableTag.glyf: {
        const t = new GlyphTable(r, this._rb.buffer, r.offset);
        this.tables.set(r.tag, t);
        t.satisfy();
        break;
      }
      case TableTag.loca: {
        const maxp = this.tables.get(TableTag.maxp)!.as<MaxpTable>();
        const head = this.tables.get(TableTag.head)!.as<HeadTable>();
        const t = new LocaTable(
          r,
          this._rb.buffer,
          r.offset,
          head.indexToLocFormat,
          maxp.numGlyphs
        );
        this.tables.set(r.tag, t);
        t.satisfy();
        break;
      }
      case TableTag.maxp: {
        const t = new MaxpTable(r, this._rb.buffer, r.offset);
        this.tables.set(r.tag, t);
        t.satisfy();
        break;
      }
      case TableTag.name: {
        const t = new NameTable(r, this._rb.buffer, r.offset);
        this.tables.set(r.tag, t);
        t.satisfy();
        break;
      }
      case TableTag.hhea: {
        const t = new HheaTable(r, this._rb.buffer, r.offset);
        this.tables.set(r.tag, t);
        t.satisfy();
        break;
      }
      case TableTag.hmtx: {
        const maxp = this.tables.get(TableTag.maxp)!.as<MaxpTable>();
        const hhea = this.tables.get(TableTag.hhea)!.as<HheaTable>();
        const t = new HmtxTable(
          r,
          this._rb.buffer,
          r.offset,
          hhea.numberOfHMetrics,
          maxp.numGlyphs
        );
        this.tables.set(r.tag, t);
        t.satisfy();
        break;
      }
      case TableTag.post: {
        const t = new PostTable(r, this._rb.buffer, r.offset);
        this.tables.set(r.tag, t);
        t.satisfy();
        break;
      }
      default:
        const t = new RawTable(r, this._rb.buffer, r.offset);
        t.satisfy();
        if (kTTFRequiredTags.includes(r.tag)) {
          this.tables.set(r.tag, t);
        } else {
          this.rawTables.push(t);
        }
        break;
    }
  }
}
