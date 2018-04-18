import { CommonTable } from "./table";
import { BufferWriter } from "../../util";
import { uint16, uint32, kSizeofUInt32, kSizeofUInt16 } from "../../types";
import { repeat, tagCode2Name } from "../../table";

export class ScriptRecord {
  scriptTag: uint32;
  scriptOffset: uint16;

  static kSize = kSizeofUInt32 + kSizeofUInt16;

  write2(wb: BufferWriter): void {
    wb.writeUInt32(this.scriptTag);
    wb.writeUInt16(this.scriptOffset);
  }

  get scriptTagName() {
    return tagCode2Name(this.scriptTag);
  }
}

export class LangSysRecord {
  langSysTag: uint32;
  langSysOffset: uint16;

  static kSize = kSizeofUInt32 + kSizeofUInt16;

  write2(wb: BufferWriter): void {
    wb.writeUInt32(this.langSysTag);
    wb.writeUInt16(this.langSysOffset);
  }

  get langSysTagName() {
    return tagCode2Name(this.langSysTag);
  }
}

export class LanguageSystemTable extends CommonTable {
  lookupOrder: uint16;
  requiredFeatureIndex: uint16;
  featureIndexCount: uint16;
  featureIndices: uint16[] = [];

  satisfy(): void {
    this.lookupOrder = this._rb.readUInt16BE();
    this.requiredFeatureIndex = this._rb.readUInt16BE();
    this.featureIndexCount = this._rb.readUInt16BE();
    repeat(this.featureIndexCount, () => this.featureIndices.push(this._rb.readUInt16BE()));
  }

  write2(wb: BufferWriter): void {
    wb.pushWriteGuard(this.size());
    wb.writeUInt16(this.lookupOrder);
    wb.writeUInt16(this.requiredFeatureIndex);
    wb.writeUInt16(this.featureIndexCount);
    repeat(this.featureIndexCount, i => wb.writeUInt16(this.featureIndices[i]));
    wb.applyWriteGuard();
  }

  size(): number {
    return kSizeofUInt16 * 3 + kSizeofUInt16 * this.featureIndexCount;
  }
}

export class ScriptTable extends CommonTable {
  defaultLangSys: uint16;
  langSysCount: uint16;
  langSysRecords: LangSysRecord[] = [];

  langSysTables: LanguageSystemTable[] = [];

  satisfy(): void {
    this.defaultLangSys = this._rb.readUInt16BE();
    this.langSysCount = this._rb.readUInt16BE();
    repeat(this.langSysCount, () => {
      const r = new LangSysRecord();
      r.langSysTag = this._rb.readUInt32BE();
      r.langSysOffset = this._rb.readUInt16BE();
      this.langSysRecords.push(r);
    });
    this.readLangSysTables();
  }

  write2(wb: BufferWriter): void {
    wb.pushWriteGuard(this.size());
    wb.writeUInt16(this.defaultLangSys);
    wb.writeUInt16(this.langSysCount);
    this.langSysRecords.forEach(r => r.write2(wb));
    this.langSysTables.forEach(t => t.write2(wb));
    wb.applyWriteGuard();
  }

  size(): number {
    let size = kSizeofUInt16 * 2 + this.langSysCount * LangSysRecord.kSize;
    this.langSysTables.forEach(t => (size += t.size()));
    return size;
  }

  private readLangSysTables() {
    this.langSysRecords.forEach(r => {
      const t = new LanguageSystemTable(this._rb.buffer, this._beginOfst + r.langSysOffset);
      t.satisfy();
      this.langSysTables.push(t);
    });
  }
}

export class ScriptListTable extends CommonTable {
  scriptCount: uint16;
  scriptRecords: ScriptRecord[] = [];

  scriptTables: ScriptTable[] = [];

  satisfy(): void {
    this.scriptCount = this._rb.readUInt16BE();
    repeat(this.scriptCount, () => {
      const r = new ScriptRecord();
      r.scriptTag = this._rb.readUInt32BE();
      r.scriptOffset = this._rb.readUInt16BE();
      this.scriptRecords.push(r);
    });
    this.readScriptTables();
  }

  write2(wb: BufferWriter): void {
    wb.pushWriteGuard(this.size());
    wb.writeUInt16(this.scriptCount);
    this.scriptRecords.forEach(r => r.write2(wb));
    this.scriptTables.forEach(t => t.write2(wb));
    wb.applyWriteGuard();
  }

  size(): number {
    let size = kSizeofUInt16;
    size += this.scriptCount * ScriptRecord.kSize;
    this.scriptTables.forEach(st => (size += st.size()));
    return size;
  }

  readScriptTables() {
    this.scriptRecords.forEach(r => {
      const t = new ScriptTable(this._rb.buffer, this._beginOfst + r.scriptOffset);
      t.satisfy();
      this.scriptTables.push(t);
    });
  }
}
