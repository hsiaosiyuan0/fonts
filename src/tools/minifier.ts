import * as assert from "assert";
import { Font, OffsetTable } from "../sfnt";
import {
  CmapTable,
  EncodingRecord,
  Glyph,
  GlyphTable,
  HheaTable,
  HmtxTable,
  LocaTable,
  LongHorMetricRecord,
  MaxpTable,
  PostTable,
  PostTableVersion,
  SubTableF4,
  TableTag,
  HeadTable
} from "../table";

export class Minifier {
  // As a initial implementation, the parameter is just a javascript string
  // and it's internal codepoints will be iterated one by one to filter their
  // corresponding glyphs - this restricts our font must support unicode
  filter(font: Font, str: string) {
    if (typeof str !== "string" || str.length === 0) throw new Error("deformed parameter");

    const cps: number[] = [];
    for (let i = 0, len = str.length; i < len; ++i) {
      cps.push(str.codePointAt(i)!);
    }
    cps.push(0);
    cps.sort((a, b) => a - b);

    let t = font.tables.get(TableTag.cmap);
    if (!t) throw new Error("missing cmap table");
    const cmap = t as CmapTable;

    t = font.tables.get(TableTag.loca);
    if (!t) throw new Error("missing loca table");
    const loca = t as LocaTable;

    t = font.tables.get(TableTag.glyf);
    if (!t) throw new Error("missing glyf table");
    const glyf = t as GlyphTable;

    t = font.tables.get(TableTag.maxp);
    if (!t) throw new Error("missing maxp table");
    const maxp = t as MaxpTable;

    t = font.tables.get(TableTag.hmtx);
    if (!t) throw new Error("missing hmtx table");
    const hmtx = t as HmtxTable;

    t = font.tables.get(TableTag.hhea);
    if (!t) throw new Error("missing hhea table");
    const hhea = t as HheaTable;

    t = font.tables.get(TableTag.head);
    if (!t) throw new Error("missing head table");
    const head = t as HeadTable;

    t = font.tables.get(TableTag.post);
    if (!t) throw new Error("missing post table");
    const post = t as PostTable;

    const uniTables = cmap.subTables.filter(
      t =>
        t.encoding.platformId === 0 || (t.encoding.platformId === 3 && t.encoding.encodingID === 1)
    );
    if (uniTables.length === 0) throw new Error("font does not support unicode");

    const uni = uniTables[0];
    const glyphs: Glyph[] = [];
    const cpGidMap: Map<number, number> = new Map();
    const gIdSrcIdMap: Map<number, number> = new Map();
    const srcIdGidMap: Map<number, number> = new Map();
    cps.forEach(cp => {
      let srcId = uni.lookup(cp);
      if (srcIdGidMap.has(srcId)) return;

      let g = glyf.readGlyphAt(srcId, loca);
      glyphs.push(g);

      let gId = glyphs.length - 1;
      cpGidMap.set(cp, gId);
      gIdSrcIdMap.set(gId, srcId);
      srcIdGidMap.set(srcId, gId);

      if (!g.isSimple) {
        g.compositeGlyphTables.forEach(cg => {
          srcId = cg.glyphIndex;
          if (srcIdGidMap.has(srcId)) {
            cg.glyphIndex = srcIdGidMap.get(srcId)!;
            return;
          }
          g = glyf.readGlyphAt(srcId, loca);
          glyphs.push(g);
          gId = glyphs.length - 1;
          gIdSrcIdMap.set(gId, srcId);
          srcIdGidMap.set(srcId, gId);
          cg.glyphIndex = gId;
        });
      }
    });

    const newFont = new Font();
    // keep raw tables
    newFont.rawTables = font.rawTables;

    // build glyf table
    const glyfTable = new GlyphTable();
    glyfTable.glyphs = glyphs;
    newFont.tables.set(TableTag.glyf, glyfTable);

    // build loca table
    const locaTable = new LocaTable();
    locaTable.numGlyphs = glyphs.length;
    locaTable.indexToLocFormat = 1;
    const ofstArr: number[] = [];
    let ofst = 0;
    for (let i = 0, len = glyphs.length; i <= len; ++i) {
      if (i > 0) {
        ofst += glyphs[i - 1].size();
      }
      ofstArr.push(ofst);
    }
    locaTable.offsets = ofstArr;
    newFont.tables.set(TableTag.loca, locaTable);

    // build cmap table
    const cmapTable = new CmapTable();
    cmapTable.version = 0;
    cmapTable.numTables = 1;
    const cpGidData = Array.from(cpGidMap.entries()).map(([cp, gIdx]) => ({ cp, gIdx }));
    const subTable = SubTableF4.pack(cpGidData);
    subTable.encoding = new EncodingRecord();
    subTable.encoding.platformId = 0;
    subTable.encoding.encodingID = 3;
    cmapTable.encodingRecords = [subTable.encoding];
    cmapTable.subTables = [subTable];
    newFont.tables.set(TableTag.cmap, cmapTable);

    // build maxp table
    const maxpTable = new MaxpTable();
    const r = maxpTable.record;
    Object.assign(maxpTable, maxp);
    maxpTable.record = r;
    maxpTable.numGlyphs = glyphs.length;
    newFont.tables.set(TableTag.maxp, maxpTable);

    // build hmtx table
    const hmtxTable = new HmtxTable();
    const lastH = hmtx.hMetrics[hmtx.hMetrics.length - 1];
    glyphs.forEach((g, i) => {
      const srcIdx = gIdSrcIdMap.get(i)!;
      let hm = hmtx.hMetrics[srcIdx];
      if (hm) {
        hmtxTable.hMetrics.push(hm);
        return;
      }
      const ls = hmtx.leftSideBearings[srcIdx - hmtx.hMetrics.length];
      assert.ok(ls !== undefined);
      hm = new LongHorMetricRecord();
      hm.advanceWidth = lastH.advanceWidth;
      hm.lsb = ls;
      hmtxTable.hMetrics.push(hm);
    });
    newFont.tables.set(TableTag.hmtx, hmtxTable);

    // build post table
    const postTable = new PostTable();
    Object.assign(postTable, post);
    if (postTable.version === PostTableVersion.v2_0) {
      postTable.names = [];
      postTable.glyphNameIndex = [];
      if (postTable.version === PostTableVersion.v2_0) {
        postTable.numGlyphs = glyphs.length;
        glyphs.forEach((g, i) => {
          const srcIdx = gIdSrcIdMap.get(i)!;
          const name = post.getNameV20(srcIdx);
          if (typeof name === "number") {
            postTable.glyphNameIndex.push(name);
          } else {
            postTable.glyphNameIndex.push(258 + i);
            postTable.names.push(name);
          }
        });
      }
    }
    newFont.tables.set(TableTag.post, postTable);

    // build hhea table
    const hheaTable = new HheaTable();
    Object.assign(hheaTable, hhea);
    hheaTable.minLeftSideBearing = Number.MAX_VALUE;
    hheaTable.minRightSideBearing = Number.MAX_VALUE;
    hheaTable.advanceWidthMax = Number.MIN_VALUE;
    hheaTable.minRightSideBearing = Number.MAX_VALUE;
    hheaTable.xMaxExtent = Number.MIN_VALUE;
    glyphs.forEach((g, i) => {
      const hm = hmtxTable.hMetrics[i];
      hheaTable.minLeftSideBearing = Math.min(hheaTable.minLeftSideBearing, hm.lsb);
      hheaTable.advanceWidthMax = Math.max(hheaTable.advanceWidthMax, hm.advanceWidth);
      hheaTable.minRightSideBearing = Math.min(
        hheaTable.minRightSideBearing,
        hm.advanceWidth - hm.lsb - (g.xMax - g.xMin)
      );
      hheaTable.xMaxExtent = Math.max(hheaTable.xMaxExtent, hm.lsb + (g.xMax - g.xMin));
    });
    hheaTable.numberOfHMetrics = hmtxTable.hMetrics.length;
    newFont.tables.set(TableTag.hhea, hheaTable);

    // build head table
    const headTable = new HeadTable();
    Object.assign(headTable, head);
    headTable.xMax = Number.MIN_VALUE;
    headTable.yMax = Number.MIN_VALUE;
    headTable.xMin = Number.MAX_VALUE;
    headTable.yMin = Number.MAX_VALUE;
    glyphs.forEach(g => {
      headTable.xMax = Math.max(headTable.xMax, g.xMax);
      headTable.yMax = Math.max(headTable.yMax, g.yMax);
      headTable.xMin = Math.min(headTable.xMin, g.xMin);
      headTable.yMin = Math.min(headTable.yMin, g.yMin);
    });
    newFont.tables.set(TableTag.head, headTable);

    Array.from(font.tables.values())
      .filter(
        t =>
          ![
            TableTag.cmap,
            TableTag.loca,
            TableTag.glyf,
            TableTag.maxp,
            TableTag.hhea,
            TableTag.hmtx,
            TableTag.post,
            TableTag.head
          ].includes(t.record.tag)
      )
      .forEach(t => newFont.tables.set(t.record.tag, t));

    return newFont;
  }
}
