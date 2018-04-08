import { ForwardBuffer } from "./forward-buffer";
import { CmapTable, Table, TableTag, HeadTable, GlyphTable } from "./table";
import { uint16, uint32, uint8 } from "./types";

export class OffsetTable {
  sfntVersion: uint32;
  numTables: uint16;
  searchRange: uint16;
  entrySelector: uint16;
  rangeShift: uint16;
}

export class TableRecord {
  tag: uint32;
  checkSum: uint32;
  offset: uint32;
  length: uint32;

  get tagName() {
    const c1 = this.tag >> 24;
    const c2 = (this.tag >> 16) & 0xff;
    const c3 = (this.tag >> 8) & 0xff;
    const c4 = this.tag & 0xff;
    return (
      String.fromCharCode(c1) +
      String.fromCharCode(c2) +
      String.fromCharCode(c3) +
      String.fromCharCode(c4)
    );
  }
}

export class Font {
  private _rb: ForwardBuffer;

  offsetTable: OffsetTable;
  tableRecords: TableRecord[] = [];

  tables = new Map<TableTag, Table>();

  constructor(buf: Buffer, offset?: number);
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
  }

  private readTables() {
    this.tableRecords.forEach(r => this.readTable(r));
  }

  private readTable(r: TableRecord) {
    switch (r.tag) {
      case TableTag.cmap: {
        const t = new CmapTable(this._rb.buffer, r.offset);
        this.tables.set(r.tag, t);
        t.satisfy();
        break;
      }
      case TableTag.head: {
        const t = new HeadTable(this._rb.buffer, r.offset);
        this.tables.set(t.tag, t);
        t.satisfy();
        break;
      }
      case TableTag.glyf: {
        const t = new GlyphTable(this._rb.buffer, r.offset);
        this.tables.set(t.tag, t);
        t.satisfy();
        break;
      }
      default:
        break;
    }
  }
}
