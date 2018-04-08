import { ForwardBuffer } from "../forward-buffer";
import { Table, TableTag, repeat } from "./table";
import { uint16, uint32 } from "../types";

export class NameRecord {
  platformID: uint16;
  encodingID: uint16;
  languageID: uint16;
  nameID: uint16;
  length: uint16;
  offset: uint16;
}

export class LangTagRecord {
  length: uint16;
  offset: uint16;
}

export class NameTable extends Table {
  format: uint16;
  count: uint16;
  stringOffset: uint16;
  stringData: Buffer;

  // format 0
  nameRecords: NameRecord[] = [];

  // format 1
  langTagCount: uint16;
  langTagRecords: LangTagRecord[] = [];

  satisfy() {
    this.format = this._rb.readUInt16BE();
    this.count = this._rb.readUInt16BE();
    this.stringOffset = this._rb.readUInt16BE();

    if (this.format === 0) {
      repeat(this.count, () => {
        const r = new NameRecord();
        r.platformID = this._rb.readUInt16BE();
        r.encodingID = this._rb.readUInt16BE();
        r.languageID = this._rb.readUInt16BE();
        r.nameID = this._rb.readUInt16BE();
        r.length = this._rb.readUInt16BE();
        r.offset = this._rb.readUInt16BE();
        this.nameRecords.push(r);
      });
    } else if (this.format === 1) {
      const r = new LangTagRecord();
      r.length = this._rb.readUInt16BE();
      r.offset = this._rb.readUInt16BE();
      this.langTagRecords.push(r);
    } else {
      throw new Error("unreachable");
    }

    this.stringData = this._rb.buffer.slice(
      this.record.offset + this.stringOffset,
      this.record.offset + this.record.length
    );
  }
}
