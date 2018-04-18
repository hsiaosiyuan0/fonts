import { Table } from "./table";
import { uint16, uint32, kSizeofUInt16 } from "../types";
import { ScriptListTable, FeatureListTable, LookupListTable } from "./common";
import { BufferWriter } from "..";

// spec https://docs.microsoft.com/en-us/typography/opentype/spec/gsub#SS
export class GsubTable extends Table {
  // version 1.0
  majorVersion: uint16;
  minorVersion: uint16;
  scriptListOffset: uint16;
  featureListOffset: uint16;
  lookupListOffset: uint16;

  // version 1.1
  featureVariationsOffset: uint32;

  scriptList: ScriptListTable;
  featureList: FeatureListTable;
  lookupList: LookupListTable;

  satisfy(): void {
    this.majorVersion = this._rb.readUInt16BE();
    this.minorVersion = this._rb.readUInt16BE();
    this.scriptListOffset = this._rb.readUInt16BE();
    this.featureListOffset = this._rb.readUInt16BE();
    this.lookupListOffset = this._rb.readUInt16BE();
    if (this.minorVersion === 1) {
      this.featureVariationsOffset = this._rb.readUInt32BE();
    }
    this.readScriptList();
    this.readFeatureList();
    this.readLookupList();
  }

  size(): number {
    let size = kSizeofUInt16 * 5;
    if (this.minorVersion === 1) {
      size += kSizeofUInt16;
    }
    size += this.scriptList.size();
    size += this.featureList.size();
    size += this.lookupList.size();
    this.record.length = size;
    return size;
  }

  write2(wb: BufferWriter) {
    super.write2(wb);
    wb.pushWriteGuard(this.size());
    wb.writeUInt16(this.majorVersion);
    wb.writeUInt16(this.minorVersion);
    wb.writeUInt16(this.scriptListOffset);
    wb.writeUInt16(this.featureListOffset);
    wb.writeUInt16(this.lookupListOffset);
    if (this.minorVersion === 1) wb.writeUInt16(this.featureVariationsOffset);
    this.scriptList.write2(wb);
    this.featureList.write2(wb);
    this.lookupList.write2(wb);
    wb.applyWriteGuard();
  }

  private readScriptList() {
    const t = new ScriptListTable(this._rb.buffer, this._beginOfst + this.scriptListOffset);
    t.satisfy();
    this.scriptList = t;
  }

  private readFeatureList() {
    const t = new FeatureListTable(this._rb.buffer, this._beginOfst + this.featureListOffset);
    t.satisfy();
    this.featureList = t;
  }

  private readLookupList() {
    const t = new LookupListTable(this._rb.buffer, this._beginOfst + this.lookupListOffset);
    t.satisfy();
    this.lookupList = t;
  }
}
