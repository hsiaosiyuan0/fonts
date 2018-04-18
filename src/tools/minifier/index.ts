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

    const cps: number[] = Array.from(str).map(s => s.codePointAt(0)!);
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
    const cpGidMap = lookupResult.cps.map(cp => ({ cp, gId: lookupResult.cpInfos[cp].newId }));
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
    lookupResult.allGlyphIds.forEach(id => {
      let hm = hMetrics[id];
      if (hm) {
        hmtx.hMetrics.push(hm);
        return;
      }
      const lsb = leftSideBearings[id - hMetrics.length];
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
        const name = this._post.getNameV20(id);
        if (typeof name === "number") {
          post.glyphNameIndex.push(name);
        } else {
          post.glyphNameIndex.push(258 + post.names.length);
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
}
