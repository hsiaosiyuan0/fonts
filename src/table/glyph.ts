import { ForwardBuffer, BufferWriter } from "../util";
import { int16, int32, int8, uint16, uint32, uint8, kSizeofUInt16, kSizeofUInt8 } from "../types";
import { repeat, Table, TableTag, TableRecord } from "./table";
import { LocaTable } from "./loca";

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

  size() {
    let size = this.endPtsOfContours.length * kSizeofUInt16;
    size += kSizeofUInt16;
    size += this.instructions.length * kSizeofUInt8;
    for (let i = 0, len = this.flags.length; i < len; ++i) {
      const f = this.flags[i];
      size += kSizeofUInt8;

      if (f & SimpleGlyphFlag.REPEAT_FLAG) {
        while (true) {
          const nf = this.flags[i + 1];
          if (nf !== f) break;
          ++i;
        }
        size += kSizeofUInt8;
      }
    }
    for (let i = 0, len = this.xCoordinates.length; i < len; ++i) {
      const f = this.flags[i];
      if (f & SimpleGlyphFlag.X_SHORT_VECTOR) {
        size += kSizeofUInt8;
      } else if (~f & SimpleGlyphFlag.X_IS_SAME_OR_POSITIVE_X_SHORT_VECTOR) {
        size += kSizeofUInt16;
      }
      if (f & SimpleGlyphFlag.Y_SHORT_VECTOR) {
        size += kSizeofUInt8;
      } else if (~f & SimpleGlyphFlag.Y_IS_SAME_OR_POSITIVE_Y_SHORT_VECTOR) {
        size += kSizeofUInt16;
      }
    }
    return size;
  }

  write2(wb: BufferWriter) {
    this.endPtsOfContours.forEach(e => wb.writeUInt16(e));
    wb.writeUInt16(this.instructionLength);
    this.instructions.forEach(i => wb.writeUInt8(i));
    for (let i = 0, len = this.flags.length; i < len; ++i) {
      const f = this.flags[i];
      wb.writeInt8(f);

      if (f & SimpleGlyphFlag.REPEAT_FLAG) {
        let times = 0;
        while (true) {
          const nf = this.flags[i + 1];
          if (nf !== f) break;
          ++times;
          ++i;
        }
        wb.writeUInt8(times);
      }
    }
    for (let i = 0, len = this.xCoordinates.length; i < len; ++i) {
      const f = this.flags[i];
      let x = this.xCoordinates[i];
      if (f & SimpleGlyphFlag.X_SHORT_VECTOR) {
        if (~f & SimpleGlyphFlag.X_IS_SAME_OR_POSITIVE_X_SHORT_VECTOR) {
          x = -x;
        }
        wb.writeUInt8(x);
      } else {
        if (~f & SimpleGlyphFlag.X_IS_SAME_OR_POSITIVE_X_SHORT_VECTOR) {
          wb.writeInt16(x);
        }
      }
    }
    for (let i = 0, len = this.yCoordinates.length; i < len; ++i) {
      const f = this.flags[i];
      let y = this.yCoordinates[i];
      if (f & SimpleGlyphFlag.Y_SHORT_VECTOR) {
        if (~f & SimpleGlyphFlag.Y_IS_SAME_OR_POSITIVE_Y_SHORT_VECTOR) {
          y = -y;
        }
        wb.writeUInt8(y);
      } else {
        if (~f & SimpleGlyphFlag.Y_IS_SAME_OR_POSITIVE_Y_SHORT_VECTOR) {
          wb.writeInt16(y);
        }
      }
    }
  }
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

  size() {
    let size = kSizeofUInt16 * 2;
    if (this.flags & CompositeGlyphFlags.ARG_1_AND_2_ARE_WORDS) {
      size += kSizeofUInt16 * 2;
    } else {
      size += kSizeofUInt8 * 2;
    }
    if (this.flags & CompositeGlyphFlags.WE_HAVE_A_SCALE) {
      size += kSizeofUInt16;
    } else if (this.flags & CompositeGlyphFlags.WE_HAVE_AN_X_AND_Y_SCALE) {
      size += kSizeofUInt16 * 2;
    } else if (this.flags & CompositeGlyphFlags.WE_HAVE_A_TWO_BY_TWO) {
      size += kSizeofUInt16 * 4;
    }
    return size;
  }

  write2(wb: BufferWriter) {
    wb.writeUInt16(this.flags);
    wb.writeUInt16(this.glyphIndex);
    if (this.flags & CompositeGlyphFlags.ARG_1_AND_2_ARE_WORDS) {
      wb.writeUInt16(this.argument1);
      wb.writeUInt16(this.argument2);
    } else {
      wb.writeUInt8(this.argument1);
      wb.writeUInt8(this.argument2);
    }
    if (this.flags & CompositeGlyphFlags.WE_HAVE_A_SCALE) {
      wb.writeInt16(this.transOpt.scale);
    } else if (this.flags & CompositeGlyphFlags.WE_HAVE_AN_X_AND_Y_SCALE) {
      wb.writeInt16(this.transOpt.xScale);
      wb.writeInt16(this.transOpt.yScale);
    } else if (this.flags & CompositeGlyphFlags.WE_HAVE_A_TWO_BY_TWO) {
      wb.writeInt16(this.transOpt.xScale);
      wb.writeInt16(this.transOpt.scale01);
      wb.writeInt16(this.transOpt.scale10);
      wb.writeInt16(this.transOpt.yScale);
    }
  }
}

export class Glyph {
  numberOfContours: int16;
  xMin: int16;
  yMin: int16;
  xMax: int16;
  yMax: int16;

  simpleGlyphTable: SimpleGlyphTable;
  compositeGlyphTables: CompositeGlyphTable[] = [];

  size() {
    let size = kSizeofUInt16 * 5;
    if (this.numberOfContours > 0) {
      size += this.simpleGlyphTable.size();
    } else {
      this.compositeGlyphTables.forEach(t => (size += t.size()));
    }
    return size;
  }

  get isSimple() {
    return this.numberOfContours > 0;
  }

  write2(wb: BufferWriter) {
    wb.writeInt16(this.numberOfContours);
    wb.writeInt16(this.xMin);
    wb.writeInt16(this.yMin);
    wb.writeInt16(this.xMax);
    wb.writeInt16(this.yMax);
    if (this.numberOfContours > 0) {
      this.simpleGlyphTable.write2(wb);
    } else {
      this.compositeGlyphTables.forEach(t => t.write2(wb));
    }
  }
}

export class GlyphTable extends Table {
  glyphs: Glyph[] = [];

  constructor(record?: TableRecord, buf?: Buffer | ForwardBuffer, offset = 0) {
    super(record, buf, offset);
    if (!this.record) {
      this.record = new TableRecord(TableTag.glyf);
    }
  }

  satisfy() {}

  size() {
    let size = 0;
    this.glyphs.forEach(g => (size += g.size()));
    this.record.length = size;
    return size;
  }

  write2(wb: BufferWriter): void {
    super.write2(wb);
    this.glyphs.forEach(g => g.write2(wb));
  }

  private readSimpleGlyphTable(glyph: Glyph, rb: ForwardBuffer) {
    const t = new SimpleGlyphTable();
    repeat(glyph.numberOfContours, () => t.endPtsOfContours.push(rb.readUInt16BE()));

    t.instructionLength = rb.readUInt16BE();
    repeat(t.instructionLength, () => t.instructions.push(rb.readUInt8()));

    const pointCount = t.endPtsOfContours[glyph.numberOfContours - 1] + 1;
    for (let i = 0; i < pointCount; ++i) {
      const f = rb.readUInt8();
      t.flags.push(f);

      if (f & SimpleGlyphFlag.REPEAT_FLAG) {
        let times = rb.readUInt8();
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
        if (f & SimpleGlyphFlag.X_IS_SAME_OR_POSITIVE_X_SHORT_VECTOR) {
          t.xCoordinates.push(rb.readUInt8());
        } else {
          t.xCoordinates.push(-rb.readUInt8());
        }
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
        if (f & SimpleGlyphFlag.Y_IS_SAME_OR_POSITIVE_Y_SHORT_VECTOR) {
          t.yCoordinates.push(rb.readUInt8());
        } else {
          t.yCoordinates.push(-rb.readUInt8());
        }
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

  private readCompositeGlyphTable(glyph: Glyph, rb: ForwardBuffer) {
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
      } else if (t.flags & CompositeGlyphFlags.ARGS_ARE_XY_VALUES) {
        t.argument1 = rb.readInt8();
        t.argument2 = rb.readInt8();
      } else {
        t.argument1 = rb.readUInt8();
        t.argument2 = rb.readUInt8();
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

  readGlyphAt(offset: number): Glyph;
  readGlyphAt(idx: number, loca: LocaTable): Glyph;
  readGlyphAt(idx: number, loca?: LocaTable) {
    if (!loca) {
      const offset = idx;
      const rb = this._rb.branch(this.record.offset + offset);
      const g = new Glyph();
      g.numberOfContours = rb.readInt16BE();
      g.xMin = rb.readInt16BE();
      g.yMin = rb.readInt16BE();
      g.xMax = rb.readInt16BE();
      g.yMax = rb.readInt16BE();

      if (g.numberOfContours > 0) {
        this.readSimpleGlyphTable(g, rb);
      } else {
        this.readCompositeGlyphTable(g, rb);
      }
      return g;
    }
    const ofst = loca.idx2offset(idx);
    return this.readGlyphAt(ofst);
  }
}
