import { repeat, tagCode2Name } from "../../table";
import { kSizeofUInt16, kSizeofUInt32, uint16, uint32 } from "../../types";
import { BufferWriter } from "../../util";
import { CommonTable } from "./table";

export class FeatureRecord {
  featureTag: uint32;
  featureOffset: uint16;

  static kSize = kSizeofUInt32 + kSizeofUInt16;

  write2(wb: BufferWriter): void {
    wb.writeUInt32(this.featureTag);
    wb.writeUInt16(this.featureOffset);
  }

  get featureTagName() {
    return tagCode2Name(this.featureTag);
  }
}

export class FeatureTable extends CommonTable {
  featureParams: uint16;
  lookupIndexCount: uint16;
  lookupListIndices: uint16[] = [];

  satisfy(): void {
    this.featureParams = this._rb.readUInt16BE();
    this.lookupIndexCount = this._rb.readUInt16BE();
    repeat(this.lookupIndexCount, () => this.lookupListIndices.push(this._rb.readUInt16BE()));
  }

  write2(wb: BufferWriter): void {
    wb.writeUInt16(this.featureParams);
    wb.writeUInt16(this.lookupIndexCount);
    repeat(this.lookupIndexCount, i => wb.writeUInt16(this.lookupListIndices[i]));
  }

  size(): number {
    return kSizeofUInt16 * 2 + this.lookupIndexCount * kSizeofUInt16;
  }
}

export class FeatureListTable extends CommonTable {
  featureCount: uint16;
  featureRecords: FeatureRecord[] = [];

  featureTables: FeatureTable[] = [];

  satisfy(): void {
    this.featureCount = this._rb.readUInt16BE();
    repeat(this.featureCount, () => {
      const r = new FeatureRecord();
      r.featureTag = this._rb.readUInt32BE();
      r.featureOffset = this._rb.readUInt16BE();
      this.featureRecords.push(r);
    });
    this.readFeatureTables();
  }

  write2(wb: BufferWriter): void {
    wb.pushWriteGuard(this.size());
    wb.writeUInt16(this.featureCount);
    this.featureRecords.forEach(r => r.write2(wb));
    this.featureTables.forEach(t => t.write2(wb));
    wb.applyWriteGuard();
  }

  size(): number {
    let size = kSizeofUInt16 + this.featureCount * FeatureRecord.kSize;
    this.featureTables.forEach(t => (size += t.size()));
    return size;
  }

  private readFeatureTables() {
    this.featureRecords.forEach(r => {
      const t = new FeatureTable(this._rb.buffer, this._beginOfst + r.featureOffset);
      t.satisfy();
      this.featureTables.push(t);
    });
  }
}
