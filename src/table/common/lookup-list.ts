import { CommonTable } from "./table";
import { uint16, int16, kSizeofUInt16 } from "../../types";
import { BufferWriter, ForwardBuffer } from "../../util";
import { repeat } from "../../table";
import { CoverageTable } from "./coverage";

export enum LookupType {
  Single = 1,
  Multiple = 2,
  Alternate = 3,
  Ligature = 4,
  Context = 5,
  ChainingContext = 6,
  ExtensionSubstitution = 7,
  ReverseChainingContextSingle = 8,
  Reserved = 9
}

export enum LookupFlag {
  RightToLeft = 0x0001,
  IgnoreBaseGlyphs = 0x0002,
  IgnoreLigatures = 0x0004,
  IgnoreMarks = 0x0008,
  UseMarkFilteringSet = 0x0010,
  Reserved = 0x00e0,
  MarkAttachmentType = 0xff00
}

export type SubTable = SubTable11 | SubTable12 | SubTable21 | SubTable31;

export class LookupListTable extends CommonTable {
  lookupCount: uint16;
  lookups: uint16[] = [];

  lookupTables: LookupTable[] = [];

  satisfy(): void {
    this.lookupCount = this._rb.readUInt16BE();
    repeat(this.lookupCount, () => this.lookups.push(this._rb.readUInt16BE()));
    this.readLookupTables();
  }

  write2(wb: BufferWriter): void {
    wb.pushWriteGuard(this.size());
    wb.writeUInt16(this.lookupCount);
    repeat(this.lookupCount, i => wb.writeUInt16(this.lookups[i]));
    this.lookupTables.forEach(t => t.write2(wb));
    wb.applyWriteGuard();
  }

  size(): number {
    let size = kSizeofUInt16 + this.lookupCount * kSizeofUInt16;
    this.lookupTables.forEach(t => (size += t.size()));
    return size;
  }

  private readLookupTables() {
    this.lookups.forEach(ofst => {
      const t = new LookupTable(this._rb.buffer, this._beginOfst + ofst);
      t.satisfy();
      this.lookupTables.push(t);
    });
  }
}

export class LookupTable extends CommonTable {
  lookupType: uint16;
  lookupFlag: uint16;
  subTableCount: uint16;
  subtableOffsets: uint16[] = [];
  markFilteringSet: uint16;

  subTables: SubTable[] = [];

  satisfy(): void {
    this.lookupType = this._rb.readUInt16BE();
    this.lookupFlag = this._rb.readUInt16BE();
    this.subTableCount = this._rb.readUInt16BE();
    repeat(this.subTableCount, () => this.subtableOffsets.push(this._rb.readUInt16BE()));
    this.markFilteringSet = this._rb.readUInt16BE();
    this.readSubTables();
  }

  write2(wb: BufferWriter): void {
    wb.writeUInt16(this.lookupType);
    wb.writeUInt16(this.lookupFlag);
    wb.writeUInt16(this.subTableCount);
    this.subtableOffsets.forEach(i => wb.writeUInt16(i));
    wb.writeUInt16(this.markFilteringSet);
    this.subTables.forEach(t => t.write2(wb));
  }

  size(): number {
    let size = kSizeofUInt16 * 4 + this.subTableCount * kSizeofUInt16;
    this.subTables.forEach(t => (size += t.size()));
    return size;
  }

  private readSubTables() {
    this.subtableOffsets.forEach(ofst => {
      const rb = this._rb.branch(this._beginOfst + ofst);
      const format = rb.readUInt16BE();
      let st: SubTable;
      if (this.lookupType === LookupType.Single) {
        if (format === 1) {
          st = new SubTable11(rb.buffer, rb.offset - 2);
        } else if (format === 2) {
          st = new SubTable12(rb.buffer, rb.offset - 2);
        } else {
          throw new Error("unreachable");
        }
      } else if (this.lookupType === LookupType.Multiple) {
        if (format === 1) {
          st = new SubTable21(rb.buffer, rb.offset - 2);
        } else {
          throw new Error("unreachable");
        }
      } else if (this.lookupType === LookupType.Alternate) {
        if (format === 1) {
          st = new SubTable31(rb.buffer, rb.offset - 2);
        } else {
          throw new Error("unreachable");
        }
      } else {
        throw new Error("unimplemented lookup type: " + this.lookupType);
      }
      st.satisfy();
      this.subTables.push(st);
    });
  }
}

export class SubTable11 extends CommonTable {
  substFormat: uint16 = 1;
  coverageOffset: uint16;
  deltaGlyphID: int16;

  coverageTable: CoverageTable;

  satisfy(): void {
    this.substFormat = this._rb.readUInt16BE();
    this.coverageOffset = this._rb.readUInt16BE();
    this.deltaGlyphID = this._rb.readUInt16BE();
    this.coverageTable = new CoverageTable(this._rb.buffer, this._beginOfst + this.coverageOffset);
    this.coverageTable.satisfy();
  }

  write2(wb: BufferWriter): void {
    wb.writeUInt16(this.substFormat);
    wb.writeUInt16(this.coverageOffset);
    wb.writeInt16(this.deltaGlyphID);
    this.coverageTable.write2(wb);
  }

  size(): number {
    return kSizeofUInt16 * 3 + this.coverageTable.size();
  }
}

export class SubTable12 extends CommonTable {
  substFormat: uint16 = 2;
  coverageOffset: uint16;
  glyphCount: uint16;
  substituteGlyphIDs: uint16[] = [];

  coverageTable: CoverageTable;

  satisfy(): void {
    this.substFormat = this._rb.readUInt16BE();
    this.coverageOffset = this._rb.readUInt16BE();
    this.glyphCount = this._rb.readUInt16BE();
    repeat(this.glyphCount, () => this.substituteGlyphIDs.push(this._rb.readUInt16BE()));
    this.coverageTable = new CoverageTable(this._rb.buffer, this._beginOfst + this.coverageOffset);
    this.coverageTable.satisfy();
  }

  write2(wb: BufferWriter): void {
    wb.writeUInt16(this.substFormat);
    wb.writeUInt16(this.coverageOffset);
    wb.writeUInt16(this.glyphCount);
    repeat(this.glyphCount, i => wb.writeUInt16(this.substituteGlyphIDs[i]));
    this.coverageTable.write2(wb);
  }

  size(): number {
    return kSizeofUInt16 * 3 + this.glyphCount * kSizeofUInt16 + this.coverageTable.size();
  }
}

export class SequenceTable extends CommonTable {
  glyphCount: uint16;
  substituteGlyphIDs: uint16[] = [];

  satisfy(): void {
    this.glyphCount = this._rb.readUInt16BE();
    repeat(this.glyphCount, () => this.substituteGlyphIDs.push(this._rb.readUInt16BE()));
  }

  write2(wb: BufferWriter): void {
    wb.writeUInt16(this.glyphCount);
    repeat(this.glyphCount, i => wb.writeUInt16(this.substituteGlyphIDs[i]));
  }

  size(): number {
    return kSizeofUInt16 + kSizeofUInt16 * this.glyphCount;
  }
}

export class SubTable21 extends CommonTable {
  substFormat: uint16 = 1;
  coverageOffset: uint16;
  sequenceCount: uint16;
  sequenceOffsets: uint16[] = [];

  sequenceTables: SequenceTable[] = [];

  satisfy(): void {
    this.substFormat = this._rb.readUInt16BE();
    this.coverageOffset = this._rb.readUInt16BE();
    this.sequenceCount = this._rb.readUInt16BE();
    repeat(this.sequenceCount, () => this.sequenceOffsets.push(this._rb.readUInt16BE()));
    repeat(this.sequenceCount, i => {
      const s = new SequenceTable(this._rb.buffer, this._beginOfst + this.sequenceOffsets[i]);
      s.satisfy();
      this.sequenceTables.push(s);
    });
  }

  write2(wb: BufferWriter): void {
    wb.writeUInt16(this.substFormat);
    wb.writeUInt16(this.coverageOffset);
    wb.writeUInt16(this.sequenceCount);
    this.sequenceOffsets.forEach(i => wb.writeUInt16(i));
    this.sequenceTables.forEach(t => t.write2(wb));
  }

  size(): number {
    let size = kSizeofUInt16 * 3 + this.sequenceCount * kSizeofUInt16;
    this.sequenceTables.forEach(s => (size += s.size()));
    return size;
  }
}

export class AlternateSetTable extends CommonTable {
  glyphCount: uint16;
  alternateGlyphIDs: uint16[] = [];

  satisfy(): void {
    this.glyphCount = this._rb.readUInt16BE();
    repeat(this.glyphCount, () => this.alternateGlyphIDs.push(this._rb.readUInt16BE()));
  }

  write2(wb: BufferWriter): void {
    wb.writeUInt16(this.glyphCount);
    repeat(this.glyphCount, i => wb.writeUInt16(this.alternateGlyphIDs[i]));
  }

  size(): number {
    return kSizeofUInt16 + this.glyphCount * kSizeofUInt16;
  }
}

export class SubTable31 extends CommonTable {
  substFormat: uint16 = 1;
  coverageOffset: uint16;
  alternateSetCount: uint16;
  alternateSetOffsets: uint16[] = [];

  alternateSetTables: AlternateSetTable[] = [];

  satisfy(): void {
    this.substFormat = this._rb.readUInt16BE();
    this.coverageOffset = this._rb.readUInt16BE();
    this.alternateSetCount = this._rb.readUInt16BE();
    repeat(this.alternateSetCount, () => this.alternateSetOffsets.push(this._rb.readUInt16BE()));
    repeat(this.alternateSetCount, i => {
      const a = new AlternateSetTable(
        this._rb.buffer,
        this._beginOfst + this.alternateSetOffsets[i]
      );
      a.satisfy();
      this.alternateSetTables.push(a);
    });
  }

  write2(wb: BufferWriter): void {
    wb.writeUInt16(this.substFormat);
    wb.writeUInt16(this.coverageOffset);
    wb.writeUInt16(this.alternateSetCount);
    this.alternateSetOffsets.forEach(i => wb.writeUInt16(i));
    this.alternateSetTables.forEach(t => t.write2(wb));
  }

  size(): number {
    let size = kSizeofUInt16 * 3 + this.alternateSetCount * kSizeofUInt16;
    this.alternateSetTables.forEach(a => (size += a.size()));
    return size;
  }
}
