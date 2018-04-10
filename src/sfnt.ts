import { ForwardBuffer } from "./forward-buffer";
import {
  CmapTable,
  GlyphTable,
  HeadTable,
  HheaTable,
  HmtxTable,
  LocaTable,
  MaxpTable,
  NameTable,
  parseOrderOfTableRecord,
  Table,
  TableRecord,
  TableTag,
  PostTable
} from "./table";
import { uint16, uint32, uint8 } from "./types";

export class OffsetTable {
  sfntVersion: uint32;
  numTables: uint16;
  searchRange: uint16;
  entrySelector: uint16;
  rangeShift: uint16;
}

export class Font {
  private _rb: ForwardBuffer;

  offsetTable: OffsetTable;
  tableRecords: TableRecord[] = [];

  tables = new Map<TableTag, Table>();

  constructor(buf: Buffer | ForwardBuffer, offset = 0) {
    this._rb = buf instanceof ForwardBuffer ? buf : new ForwardBuffer(buf, offset);
  }

  satisfy() {
    this.readOffsetTable();
    this.readTableRecords();
    this.readTables();
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
        break;
    }
  }
}
