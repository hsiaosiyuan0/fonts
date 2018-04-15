import { ForwardBuffer, BufferWriter } from "../util";
import { Table, TableTag, TableRecord } from "./table";
import { uint16, uint32, kSizeofUInt16, kSizeofUInt32 } from "../types";

export class MaxpTable extends Table {
  version: uint32;
  numGlyphs: uint16;
  maxPoints: uint16;
  maxContours: uint16;
  maxCompositePoints: uint16;
  maxCompositeContours: uint16;
  maxZones: uint16;
  maxTwilightPoints: uint16;
  maxStorage: uint16;
  maxFunctionDefs: uint16;
  maxInstructionDefs: uint16;
  maxStackElements: uint16;
  maxSizeOfInstructions: uint16;
  maxComponentElements: uint16;
  maxComponentDepth: uint16;

  constructor(record?: TableRecord, buf?: Buffer | ForwardBuffer, offset = 0) {
    super(record, buf, offset);
    if (!this.record) {
      this.record = new TableRecord(TableTag.maxp);
    }
  }

  satisfy() {
    this.version = this._rb.readUInt32BE();
    this.numGlyphs = this._rb.readUInt16BE();
    this.maxPoints = this._rb.readUInt16BE();
    this.maxContours = this._rb.readUInt16BE();
    this.maxCompositePoints = this._rb.readUInt16BE();
    this.maxCompositeContours = this._rb.readUInt16BE();
    this.maxZones = this._rb.readUInt16BE();
    this.maxTwilightPoints = this._rb.readUInt16BE();
    this.maxStorage = this._rb.readUInt16BE();
    this.maxFunctionDefs = this._rb.readUInt16BE();
    this.maxInstructionDefs = this._rb.readUInt16BE();
    this.maxStackElements = this._rb.readUInt16BE();
    this.maxSizeOfInstructions = this._rb.readUInt16BE();
    this.maxComponentElements = this._rb.readUInt16BE();
    this.maxComponentDepth = this._rb.readUInt16BE();
  }

  write2(wb: BufferWriter) {
    super.write2(wb);
    wb.writeUInt32(this.version);
    wb.writeUInt16(this.numGlyphs);
    wb.writeUInt16(this.maxPoints);
    wb.writeUInt16(this.maxContours);
    wb.writeUInt16(this.maxCompositePoints);
    wb.writeUInt16(this.maxCompositeContours);
    wb.writeUInt16(this.maxZones);
    wb.writeUInt16(this.maxTwilightPoints);
    wb.writeUInt16(this.maxStorage);
    wb.writeUInt16(this.maxFunctionDefs);
    wb.writeUInt16(this.maxInstructionDefs);
    wb.writeUInt16(this.maxStackElements);
    wb.writeUInt16(this.maxSizeOfInstructions);
    wb.writeUInt16(this.maxComponentElements);
    wb.writeUInt16(this.maxComponentDepth);
  }

  size() {
    const size = kSizeofUInt16 * 14 + kSizeofUInt32;
    this.record.length = size;
    return size;
  }
}
