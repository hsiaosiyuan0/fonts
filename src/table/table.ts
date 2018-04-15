import { uint8, uint16, uint32, int16, kSizeofUInt16, kSizeofUInt32 } from "../types";
import { ForwardBuffer, BufferWriter } from "../util";

/**
 * thanks [TeX Live](https://www.tug.org/texlive)
 */

export const tagName2Code = (name: string) => {
  return (
    (name.charCodeAt(0) << 24) |
    (name.charCodeAt(1) << 16) |
    (name.charCodeAt(2) << 8) |
    name.charCodeAt(3)
  );
};

export enum TableTag {
  raw = tagName2Code("raw"),
  cmap = tagName2Code("cmap"),
  glyf = tagName2Code("glyf"),
  head = tagName2Code("head"),
  hhea = tagName2Code("hhea"),
  hmtx = tagName2Code("hmtx"),
  loca = tagName2Code("loca"),
  maxp = tagName2Code("maxp"),
  name = tagName2Code("name"),
  post = tagName2Code("post"),
  cvt = tagName2Code("cvt"),
  fpgm = tagName2Code("fpgm"),
  hdmx = tagName2Code("hdmx"),
  kern = tagName2Code("kern"),
  OS2 = tagName2Code("OS/2"),
  prep = tagName2Code("prep")
}

export const tableRecordParseOrder = new Map<TableTag, number>();
tableRecordParseOrder.set(TableTag.name, 1);
tableRecordParseOrder.set(TableTag.head, 2);
tableRecordParseOrder.set(TableTag.cmap, 3);
tableRecordParseOrder.set(TableTag.maxp, 4);
tableRecordParseOrder.set(TableTag.glyf, 5);
tableRecordParseOrder.set(TableTag.loca, 6);
tableRecordParseOrder.set(TableTag.hhea, 7);
tableRecordParseOrder.set(TableTag.hmtx, 8);

export const parseOrderOfTableRecord = (tag: TableTag) => {
  if (tableRecordParseOrder.has(tag)) return tableRecordParseOrder.get(tag)!;
  return 100;
};

export class TableRecord {
  tag: uint32;
  checkSum: uint32;
  offset: uint32;
  length: uint32;

  padding = 0;

  constructor(tag = TableTag.raw, checkSum = 0, offset = 0, length = 0) {
    this.tag = tag;
    this.checkSum = checkSum;
    this.offset = offset;
    this.length = length;
  }

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

  static kSize = kSizeofUInt32 * 4;

  write2(wb: BufferWriter) {
    const c1 = this.tag >> 24;
    const c2 = (this.tag >> 16) & 0xff;
    const c3 = (this.tag >> 8) & 0xff;
    const c4 = this.tag & 0xff;
    wb.writeUInt8(c1);
    wb.writeUInt8(c2);
    wb.writeUInt8(c3);
    wb.writeUInt8(c4);
    wb.writeUInt32(this.checkSum);
    wb.writeUInt32(this.offset);
    wb.writeUInt32(this.length);
  }
}

export abstract class Table {
  protected _rb: ForwardBuffer;
  protected _beginOfst: number;

  record: TableRecord;

  constructor(record?: TableRecord, buf?: Buffer | ForwardBuffer, offset = 0) {
    if (!record || !buf) return;
    this.record = record;
    if (buf instanceof ForwardBuffer) {
      this._rb = buf;
      this._beginOfst = buf.offset;
    } else {
      this._rb = new ForwardBuffer(buf, offset);
      this._beginOfst = offset;
    }
  }

  as<T>(): T {
    return this as any;
  }

  abstract satisfy(): void;

  write2(wb: BufferWriter) {
    if (this.record.padding) {
      for (let i = 0, len = this.record.padding; i < len; ++i) {
        wb.writeUInt8(0);
      }
    }
  }

  abstract size(): number;
}

export const repeat = (times: number, cb: (i: number) => void) => {
  for (let i = 0; i < times; ++i) cb(i);
};
