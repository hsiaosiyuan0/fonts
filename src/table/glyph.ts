import { ForwardBuffer } from "../forward-buffer";
import { int16, int32, int8, uint16, uint32, uint8 } from "../types";
import { repeat, Table, TableTag } from "./table";
import { NOTFOUND } from "dns";

export enum SimpleGlyphFlag {
  ON_CURVE_POINT = 0x01,
  X_SHORT_VECTOR = 0x02,
  Y_SHORT_VECTOR = 0x04,
  REPEAT_FLAG = 0x08,
  X_IS_SAME_OR_POSITIVE_X_SHORT_VECTOR = 0x10,
  Y_IS_SAME_OR_POSITIVE_Y_SHORT_VECTOR = 0x20,
  Reserved = 0xc0
}

export enum CompositeGlyphFlags {
  ARG_1_AND_2_ARE_WORDS = 0x0001,
  ARGS_ARE_XY_VALUES = 0x0002,
  ROUND_XY_TO_GRID = 0x0004,
  WE_HAVE_A_SCALE = 0x0008,
  MORE_COMPONENTS = 0x0020,
  WE_HAVE_AN_X_AND_Y_SCALE = 0x0040,
  WE_HAVE_A_TWO_BY_TWO = 0x0080,
  WE_HAVE_INSTRUCTIONS = 0x0100,
  USE_MY_METRICS = 0x0200,
  OVERLAP_COMPOUND = 0x0400,
  SCALED_COMPONENT_OFFSET = 0x0800,
  UNSCALED_COMPONENT_OFFSET = 0x1000,
  Reserved = 0xe010
}

export class SimpleGlyphTable {
  endPtsOfContours: uint16[] = [];
  instructionLength: uint16;
  instructions: uint8[] = [];
  flags: uint8[] = [];
  xCoordinates: Array<uint8 | int16> = [];
  yCoordinates: Array<uint8 | int16> = [];
}

export class TransformationOpt {
  scale: int16;
  xScale: int16;
  yScale: int16;
  scale01: int16;
  scale10: int16;
}

export class CompositeGlyphTable {
  flags: uint16;
  glyphIndex: uint16;
  argument1: uint8 | int8 | uint16 | int16;
  argument2: uint8 | int8 | uint16 | int16;
  transOpt: TransformationOpt;
}

export class Glyph {
  numberOfContours: int16;
  xMin: int16;
  yMin: int16;
  xMax: int16;
  yMax: int16;

  simpleGlyphTable: SimpleGlyphTable;
  compositeGlyphTables: CompositeGlyphTable[] = [];
}

export class GlyphTable extends Table {
  satisfy() {}

  readSimpleGlyphTable(glyph: Glyph, rb: ForwardBuffer) {
    const t = new SimpleGlyphTable();
    repeat(glyph.numberOfContours, () => t.endPtsOfContours.push(rb.readUInt16BE()));

    t.instructionLength = rb.readUInt16BE();
    repeat(t.instructionLength, () => t.instructions.push(rb.readUInt8()));

    const pointCount = t.endPtsOfContours[glyph.numberOfContours - 1] + 1;
    for (let i = 0; i < pointCount; ++i) {
      const f = rb.readUInt8();
      t.flags.push(f);

      if (f & SimpleGlyphFlag.REPEAT_FLAG) {
        let times = this._rb.readUInt8();
        while (times) {
          t.flags.push(f);
          --times;
          ++i;
        }
      }
    }

    for (let i = 0; i < pointCount; ++i) {
      const f = t.flags[i];
      if (f & SimpleGlyphFlag.X_SHORT_VECTOR) {
        let x = rb.readUInt8();
        if (~f & SimpleGlyphFlag.X_IS_SAME_OR_POSITIVE_X_SHORT_VECTOR) {
          x = -x;
        }
        t.xCoordinates.push(x);
      } else {
        if (f & SimpleGlyphFlag.X_IS_SAME_OR_POSITIVE_X_SHORT_VECTOR) {
          t.xCoordinates.push(0);
        } else {
          t.xCoordinates.push(rb.readInt16BE());
        }
      }
    }

    for (let i = 0; i < pointCount; ++i) {
      const f = t.flags[i];
      if (f & SimpleGlyphFlag.Y_SHORT_VECTOR) {
        let x = rb.readUInt8();
        if (~f & SimpleGlyphFlag.Y_IS_SAME_OR_POSITIVE_Y_SHORT_VECTOR) {
          x = -x;
        }
        t.yCoordinates.push(x);
      } else {
        if (f & SimpleGlyphFlag.Y_IS_SAME_OR_POSITIVE_Y_SHORT_VECTOR) {
          t.yCoordinates.push(0);
        } else {
          t.yCoordinates.push(rb.readInt16BE());
        }
      }
    }

    glyph.simpleGlyphTable = t;
  }

  readCompositeGlyphTable(glyph: Glyph, rb: ForwardBuffer) {
    while (true) {
      const t = new CompositeGlyphTable();
      t.flags = rb.readUInt16BE();
      t.glyphIndex = rb.readUInt16BE();

      if (t.flags & CompositeGlyphFlags.ARG_1_AND_2_ARE_WORDS) {
        if (t.flags & CompositeGlyphFlags.ARGS_ARE_XY_VALUES) {
          t.argument1 = rb.readInt16BE();
          t.argument2 = rb.readInt16BE();
        } else {
          t.argument1 = rb.readUInt16BE();
          t.argument2 = rb.readUInt16BE();
        }
      } else {
        if (t.flags & CompositeGlyphFlags.ARGS_ARE_XY_VALUES) {
          t.argument1 = rb.readInt8();
          t.argument2 = rb.readInt8();
        } else {
          t.argument1 = rb.readUInt8();
          t.argument2 = rb.readUInt8();
        }
      }

      const transOpt = new TransformationOpt();
      if (t.flags & CompositeGlyphFlags.WE_HAVE_A_SCALE) {
        transOpt.scale = rb.readInt16BE();
      } else if (t.flags & CompositeGlyphFlags.WE_HAVE_AN_X_AND_Y_SCALE) {
        transOpt.xScale = rb.readInt16BE();
        transOpt.yScale = rb.readInt16BE();
      } else if (t.flags & CompositeGlyphFlags.WE_HAVE_A_TWO_BY_TWO) {
        transOpt.xScale = rb.readInt16BE();
        transOpt.scale01 = rb.readInt16BE();
        transOpt.scale10 = rb.readInt16BE();
        transOpt.yScale = rb.readInt16BE();
      }

      glyph.compositeGlyphTables.push(t);

      if (~t.flags & CompositeGlyphFlags.MORE_COMPONENTS) break;
    }
  }

  readGlyphAt(offset: number) {
    const rb = this._rb.branch(this.record.offset + offset);
    const g = new Glyph();
    g.numberOfContours = this._rb.readInt16BE();
    g.xMin = this._rb.readInt16BE();
    g.yMin = this._rb.readInt16BE();
    g.xMax = this._rb.readInt16BE();
    g.yMax = this._rb.readInt16BE();

    if (g.numberOfContours > 0) {
      this.readSimpleGlyphTable(g, rb);
    } else {
      this.readCompositeGlyphTable(g, rb);
    }
    return g;
  }
}
