import { ForwardBuffer } from "../forward-buffer";
import { Table, TableTag } from "./table";
import { uint16, uint32 } from "../types";

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
}
