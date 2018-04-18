import * as assert from "assert";
import { Font, OffsetTable } from "../../sfnt";
import {
  CmapTable,
  EncodingRecord,
  Glyph,
  GlyphTable,
  GsubTable,
  HeadTable,
  HheaTable,
  HmtxTable,
  LocaTable,
  LongHorMetricRecord,
  MaxpTable,
  PostTable,
  PostTableVersion,
  SubTableF4,
  TableTag,
  LookupResult
} from "../../table";

// As a initial implementation, the parameter is just a javascript string
// and it's internal codepoints will be iterated one by one to filter their
// corresponding glyphs - this restricts our font must support unicode
export class Minifier {
  protected _font: Font;

  protected _cmap: CmapTable;
  protected _loca: LocaTable;
  protected _glyf: GlyphTable;
  protected _maxp: MaxpTable;
  protected _hmtx: HmtxTable;
  protected _hhea: HheaTable;
  protected _head: HeadTable;
  protected _post: PostTable;
  protected _gsub?: GsubTable;

  constructor(font: Font) {
    this._font = font;
    this.prepareFont();
  }

  private retrieveTable(tag: TableTag, label: string, assert = true) {
    const t = this._font.tables.get(tag);
    if (!t && assert) throw new Error(`missing ${label} table`);
    return t as any;
  }

  private prepareFont() {
    this._cmap = this.retrieveTable(TableTag.cmap, "cmap");
    this._loca = this.retrieveTable(TableTag.loca, "loca");
    this._glyf = this.retrieveTable(TableTag.glyf, "glyf");
    this._maxp = this.retrieveTable(TableTag.maxp, "maxp");
    this._hmtx = this.retrieveTable(TableTag.hmtx, "hmtx");
    this._hhea = this.retrieveTable(TableTag.hhea, "hhea");
    this._head = this.retrieveTable(TableTag.head, "head");
    this._post = this.retrieveTable(TableTag.post, "post");
    this._gsub = this.retrieveTable(TableTag.GSUB, "GSUB", false);
  }

  with(str: string) {
    if (typeof str !== "string" || str.length === 0) throw new Error("deformed parameter");

    const cps: number[] = Array.from(str).map(s => s.charCodeAt(0));
    cps.push(0);
    const lookupResult = this._cmap.lookupUnicode(cps, this._glyf, this._loca);

    const newFont = new Font();

    const cmap = this.buildCmap(lookupResult);
    newFont.addTable(cmap);

    const glyph = this.buildGlyph(lookupResult);
    newFont.addTable(glyph);

    const loca = this.buildLoca(lookupResult);
    newFont.addTable(loca);

    const maxp = this.buildMaxp(lookupResult);
    newFont.addTable(maxp);

    const hmtx = this.buildHmtx(lookupResult);
    newFont.addTable(hmtx);

    const post = this.buildPost(lookupResult);
    newFont.addTable(post);

    const hhea = this.buildHhea(lookupResult, hmtx);
    newFont.addTable(hhea);

    const head = this.buildHead(lookupResult);
    newFont.addTable(head);

    for (const [tag, table] of this._font.tables) {
      if (
        ![
          TableTag.cmap,
          TableTag.loca,
          TableTag.glyf,
          TableTag.maxp,
          TableTag.hhea,
          TableTag.hmtx,
          TableTag.post,
          TableTag.head
        ].includes(tag)
      ) {
        newFont.tables.set(tag, table);
      }
    }

    return newFont;
  }

  private buildCmap(lookupResult: LookupResult) {
    const cmap = new CmapTable();
    cmap.version = 0;
    cmap.numTables = 1;
    const cpGidMap = lookupResult.cps.map((cp, i) => ({ cp, gId: i }));
    const subTable = SubTableF4.pack(cpGidMap);
    subTable.encoding = new EncodingRecord();
    subTable.encoding.platformId = 0;
    subTable.encoding.encodingID = 3;
    cmap.encodingRecords = [subTable.encoding];
    cmap.subTables = [subTable];
    return cmap;
  }

  private buildGlyph(lookupResult: LookupResult) {
    const glyph = new GlyphTable();
    glyph.glyphs = lookupResult.allGlyphs;
    return glyph;
  }

  private buildLoca(lookupResult: LookupResult) {
    const loca = new LocaTable();
    const allGlyphs = lookupResult.allGlyphs;
    loca.numGlyphs = allGlyphs.length;
    loca.indexToLocFormat = 1;
    const ofstArr: number[] = [];
    let ofst = 0;
    for (let i = 0, len = allGlyphs.length; i <= len; ++i) {
      if (i > 0) {
        ofst += allGlyphs[i - 1].size();
      }
      ofstArr.push(ofst);
    }
    loca.offsets = ofstArr;
    return loca;
  }

  private buildMaxp(lookupResult: LookupResult) {
    const maxp = new MaxpTable();
    const r = maxp.record;
    Object.assign(maxp, this._maxp);
    maxp.record = r;
    maxp.numGlyphs = lookupResult.allGlyphs.length;
    return maxp;
  }

  private buildHmtx(lookupResult: LookupResult) {
    const hmtx = new HmtxTable();
    const hMetrics = this._hmtx.hMetrics;
    const leftSideBearings = this._hmtx.leftSideBearings;
    const lastH = hMetrics[hMetrics.length - 1];
    lookupResult.allGlyphs.forEach(g => {
      let hm = hMetrics[g.id!];
      if (hm) {
        hmtx.hMetrics.push(hm);
        return;
      }
      const lsb = leftSideBearings[g.id! - hMetrics.length];
      hm = new LongHorMetricRecord();
      hm.advanceWidth = lastH.advanceWidth;
      hm.lsb = lsb;
      hmtx.hMetrics.push(hm);
    });
    return hmtx;
  }

  private buildPost(lookupResult: LookupResult) {
    const post = new PostTable();
    Object.assign(post, this._post);
    if (post.version === PostTableVersion.v2_0) {
      post.names = [];
      post.glyphNameIndex = [];
      post.numGlyphs = lookupResult.allGlyphs.length;
      lookupResult.allGlyphIds.forEach(id => {
        const name = post.getNameV20(id);
        if (typeof name === "number") {
          post.glyphNameIndex.push(name);
        } else {
          post.glyphNameIndex.push(258 + id);
          post.names.push(name);
        }
      });
    }
    return post;
  }

  private buildHhea(lookupResult: LookupResult, hmtx: HmtxTable) {
    const hhea = new HheaTable();
    Object.assign(hhea, this._hhea);
    hhea.minLeftSideBearing = Number.MAX_VALUE;
    hhea.minRightSideBearing = Number.MAX_VALUE;
    hhea.advanceWidthMax = Number.MIN_VALUE;
    hhea.minRightSideBearing = Number.MAX_VALUE;
    hhea.xMaxExtent = Number.MIN_VALUE;
    lookupResult.allGlyphs.forEach((g, i) => {
      const hm = hmtx.hMetrics[i];
      hhea.minLeftSideBearing = Math.min(hhea.minLeftSideBearing, hm.lsb);
      hhea.advanceWidthMax = Math.max(hhea.advanceWidthMax, hm.advanceWidth);
      hhea.minRightSideBearing = Math.min(
        hhea.minRightSideBearing,
        hm.advanceWidth - hm.lsb - (g.xMax - g.xMin)
      );
      hhea.xMaxExtent = Math.max(hhea.xMaxExtent, hm.lsb + (g.xMax - g.xMin));
    });
    hhea.numberOfHMetrics = hmtx.hMetrics.length;
    return hhea;
  }

  private buildHead(lookupResult: LookupResult) {
    const head = new HeadTable();
    Object.assign(head, this._head);
    head.xMax = Number.MIN_VALUE;
    head.yMax = Number.MIN_VALUE;
    head.xMin = Number.MAX_VALUE;
    head.yMin = Number.MAX_VALUE;
    lookupResult.allGlyphs.forEach(g => {
      head.xMax = Math.max(head.xMax, g.xMax);
      head.yMax = Math.max(head.yMax, g.yMax);
      head.xMin = Math.min(head.xMin, g.xMin);
      head.yMin = Math.min(head.yMin, g.yMin);
    });
    return head;
  }

  // filter(str: string) {
  //   if (typeof str !== "string" || str.length === 0) throw new Error("deformed parameter");

  //   const cps: number[] = Array.from(str).map(s => s.charCodeAt(0));

  //   const uniTables = cmap.subTables.filter(
  //     t =>
  //       t.encoding.platformId === 0 || (t.encoding.platformId === 3 && t.encoding.encodingID === 1)
  //   );
  //   if (uniTables.length === 0) throw new Error("font does not support unicode");

  //   const uni = uniTables[0];
  //   const glyphs: Glyph[] = [];
  //   const cpGidMap: Map<number, number> = new Map();
  //   const gIdSrcIdMap: Map<number, number> = new Map();
  //   const srcIdGidMap: Map<number, number> = new Map();
  //   cps.forEach(cp => {
  //     let srcId = uni.lookup(cp);
  //     if (srcIdGidMap.has(srcId)) return;

  //     let g = glyf.readGlyphAt(srcId, loca);
  //     glyphs.push(g);

  //     let gId = glyphs.length - 1;
  //     cpGidMap.set(cp, gId);
  //     gIdSrcIdMap.set(gId, srcId);
  //     srcIdGidMap.set(srcId, gId);

  //     if (!g.isSimple) {
  //       g.compositeGlyphTables.forEach(cg => {
  //         srcId = cg.glyphIndex;
  //         if (srcIdGidMap.has(srcId)) {
  //           cg.glyphIndex = srcIdGidMap.get(srcId)!;
  //           return;
  //         }
  //         g = glyf.readGlyphAt(srcId, loca);
  //         glyphs.push(g);
  //         gId = glyphs.length - 1;
  //         gIdSrcIdMap.set(gId, srcId);
  //         srcIdGidMap.set(srcId, gId);
  //         cg.glyphIndex = gId;
  //       });
  //     }
  //   });

  //   const newFont = new Font();
  //   // keep raw tables
  //   newFont.rawTables = font.rawTables;

  //   // build glyf table
  //   const glyfTable = new GlyphTable();
  //   glyfTable.glyphs = glyphs;
  //   newFont.tables.set(TableTag.glyf, glyfTable);

  //   // build loca table
  //   const locaTable = new LocaTable();
  //   locaTable.numGlyphs = glyphs.length;
  //   locaTable.indexToLocFormat = 1;
  //   const ofstArr: number[] = [];
  //   let ofst = 0;
  //   for (let i = 0, len = glyphs.length; i <= len; ++i) {
  //     if (i > 0) {
  //       ofst += glyphs[i - 1].size();
  //     }
  //     ofstArr.push(ofst);
  //   }
  //   locaTable.offsets = ofstArr;
  //   newFont.tables.set(TableTag.loca, locaTable);

  //   // build cmap table
  //   const cmapTable = new CmapTable();
  //   cmapTable.version = 0;
  //   cmapTable.numTables = 1;
  //   const cpGidData = Array.from(cpGidMap.entries()).map(([cp, gIdx]) => ({ cp, gIdx }));
  //   const subTable = SubTableF4.pack(cpGidData);
  //   subTable.encoding = new EncodingRecord();
  //   subTable.encoding.platformId = 0;
  //   subTable.encoding.encodingID = 3;
  //   cmapTable.encodingRecords = [subTable.encoding];
  //   cmapTable.subTables = [subTable];
  //   newFont.tables.set(TableTag.cmap, cmapTable);

  //   // build maxp table
  //   const maxpTable = new MaxpTable();
  //   const r = maxpTable.record;
  //   Object.assign(maxpTable, maxp);
  //   maxpTable.record = r;
  //   maxpTable.numGlyphs = glyphs.length;
  //   newFont.tables.set(TableTag.maxp, maxpTable);

  //   // build hmtx table
  //   const hmtxTable = new HmtxTable();
  //   const lastH = hmtx.hMetrics[hmtx.hMetrics.length - 1];
  //   glyphs.forEach((g, i) => {
  //     const srcIdx = gIdSrcIdMap.get(i)!;
  //     let hm = hmtx.hMetrics[srcIdx];
  //     if (hm) {
  //       hmtxTable.hMetrics.push(hm);
  //       return;
  //     }
  //     const ls = hmtx.leftSideBearings[srcIdx - hmtx.hMetrics.length];
  //     assert.ok(ls !== undefined);
  //     hm = new LongHorMetricRecord();
  //     hm.advanceWidth = lastH.advanceWidth;
  //     hm.lsb = ls;
  //     hmtxTable.hMetrics.push(hm);
  //   });
  //   newFont.tables.set(TableTag.hmtx, hmtxTable);

  //   // build post table
  //   const postTable = new PostTable();
  //   Object.assign(postTable, post);
  //   if (postTable.version === PostTableVersion.v2_0) {
  //     postTable.names = [];
  //     postTable.glyphNameIndex = [];
  //     if (postTable.version === PostTableVersion.v2_0) {
  //       postTable.numGlyphs = glyphs.length;
  //       glyphs.forEach((g, i) => {
  //         const srcIdx = gIdSrcIdMap.get(i)!;
  //         const name = post.getNameV20(srcIdx);
  //         if (typeof name === "number") {
  //           postTable.glyphNameIndex.push(name);
  //         } else {
  //           postTable.glyphNameIndex.push(258 + i);
  //           postTable.names.push(name);
  //         }
  //       });
  //     }
  //   }
  //   newFont.tables.set(TableTag.post, postTable);

  //   // build hhea table
  //   const hheaTable = new HheaTable();
  //   Object.assign(hheaTable, hhea);
  //   hheaTable.minLeftSideBearing = Number.MAX_VALUE;
  //   hheaTable.minRightSideBearing = Number.MAX_VALUE;
  //   hheaTable.advanceWidthMax = Number.MIN_VALUE;
  //   hheaTable.minRightSideBearing = Number.MAX_VALUE;
  //   hheaTable.xMaxExtent = Number.MIN_VALUE;
  //   glyphs.forEach((g, i) => {
  //     const hm = hmtxTable.hMetrics[i];
  //     hheaTable.minLeftSideBearing = Math.min(hheaTable.minLeftSideBearing, hm.lsb);
  //     hheaTable.advanceWidthMax = Math.max(hheaTable.advanceWidthMax, hm.advanceWidth);
  //     hheaTable.minRightSideBearing = Math.min(
  //       hheaTable.minRightSideBearing,
  //       hm.advanceWidth - hm.lsb - (g.xMax - g.xMin)
  //     );
  //     hheaTable.xMaxExtent = Math.max(hheaTable.xMaxExtent, hm.lsb + (g.xMax - g.xMin));
  //   });
  //   hheaTable.numberOfHMetrics = hmtxTable.hMetrics.length;
  //   newFont.tables.set(TableTag.hhea, hheaTable);

  //   // build head table
  //   const headTable = new HeadTable();
  //   Object.assign(headTable, head);
  //   headTable.xMax = Number.MIN_VALUE;
  //   headTable.yMax = Number.MIN_VALUE;
  //   headTable.xMin = Number.MAX_VALUE;
  //   headTable.yMin = Number.MAX_VALUE;
  //   glyphs.forEach(g => {
  //     headTable.xMax = Math.max(headTable.xMax, g.xMax);
  //     headTable.yMax = Math.max(headTable.yMax, g.yMax);
  //     headTable.xMin = Math.min(headTable.xMin, g.xMin);
  //     headTable.yMin = Math.min(headTable.yMin, g.yMin);
  //   });
  //   newFont.tables.set(TableTag.head, headTable);

  //   Array.from(font.tables.values())
  //     .filter(
  //       t =>
  //         ![
  //           TableTag.cmap,
  //           TableTag.loca,
  //           TableTag.glyf,
  //           TableTag.maxp,
  //           TableTag.hhea,
  //           TableTag.hmtx,
  //           TableTag.post,
  //           TableTag.head
  //         ].includes(t.record.tag)
  //     )
  //     .forEach(t => newFont.tables.set(t.record.tag, t));

  //   return newFont;
  // }
}
