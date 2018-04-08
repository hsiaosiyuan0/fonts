import { ForwardBuffer } from "../forward-buffer";
import { Table, TableTag, repeat } from "./table";
import { uint16, uint32 } from "../types";

export class NameRecord {
  platformID: uint16;
  encodingID: uint16;
  languageID: uint16;
  nameID: uint16;
  length: uint16;
  offset: uint16;

  nameTable: NameTable;

  private _str: string | null = null;

  get string() {
    if (this._str === null) {
      this._str = "";
      const buf = new ForwardBuffer(this.nameTable.stringData, this.offset);
      repeat(this.length, () => {
        this._str += String.fromCharCode(buf.readUInt8());
      });
    }
    return this._str;
  }

  get desc() {
    if (nameIdDescMap.has(this.nameID)) return nameIdDescMap.get(this.nameID);
    return this.nameID <= 255 ? "Reserved for future expansion" : "Font-specific names";
  }
}

export class LangTagRecord {
  length: uint16;
  offset: uint16;
}

export class NameTable extends Table {
  format: uint16;
  count: uint16;
  stringOffset: uint16;
  stringData: Buffer;

  // format 0
  nameRecords: NameRecord[] = [];

  // format 1
  langTagCount: uint16;
  langTagRecords: LangTagRecord[] = [];

  satisfy() {
    this.format = this._rb.readUInt16BE();
    this.count = this._rb.readUInt16BE();
    this.stringOffset = this._rb.readUInt16BE();

    if (this.format === 0) {
      repeat(this.count, () => {
        const r = new NameRecord();
        r.platformID = this._rb.readUInt16BE();
        r.encodingID = this._rb.readUInt16BE();
        r.languageID = this._rb.readUInt16BE();
        r.nameID = this._rb.readUInt16BE();
        r.length = this._rb.readUInt16BE();
        r.offset = this._rb.readUInt16BE();
        r.nameTable = this;
        this.nameRecords.push(r);
      });
    } else if (this.format === 1) {
      const r = new LangTagRecord();
      r.length = this._rb.readUInt16BE();
      r.offset = this._rb.readUInt16BE();
      this.langTagRecords.push(r);
    } else {
      throw new Error("unreachable");
    }

    this.stringData = this._rb.buffer.slice(
      this.record.offset + this.stringOffset,
      this.record.offset + this.record.length
    );
  }
}

// just a code as comment style
export enum PlatformId {
  Unicode = 0 as uint16,
  Macintosh = 1 as uint16,
  // deprecated
  ISO = 2 as uint16,
  Windows = 3 as uint16,
  Custom = 4 as uint16
}

export const encodingDescMap = new Map<number, string>();

export const platformEncodingId = (platformId: number, encodingId: number) =>
  (platformId << 8) | encodingId;

// Unicode platform-specific encoding and language IDs (platform ID = 0)
encodingDescMap.set(platformEncodingId(0, 0), "Unicode 1.0 semantics");
encodingDescMap.set(platformEncodingId(0, 1), "Unicode 1.1 semantics");
encodingDescMap.set(platformEncodingId(0, 2), "ISO/IEC 10646 semantics");
encodingDescMap.set(
  platformEncodingId(0, 3),
  "	Unicode 2.0 and onwards semantics, Unicode BMP only (cmap subtable formats 0, 4, 6)"
);
encodingDescMap.set(
  platformEncodingId(0, 4),
  "Unicode 2.0 and onwards semantics, Unicode full repertoire (cmap subtable formats 0, 4, 6, 10, 12"
);
encodingDescMap.set(
  platformEncodingId(0, 5),
  "	Unicode Variation Sequences (cmap subtable format 14)"
);
encodingDescMap.set(
  platformEncodingId(0, 6),
  "Unicode full repertoire (cmap subtable formats 0, 4, 6, 10, 12, 13)"
);

// Windows platform-specific encoding and language IDs (platform ID= 3)
encodingDescMap.set(platformEncodingId(3, 0), "Symbol");
encodingDescMap.set(platformEncodingId(3, 1), "Unicode BMP (UCS-2)");
encodingDescMap.set(platformEncodingId(3, 2), "ShiftJIS");
encodingDescMap.set(platformEncodingId(3, 3), "PRC");
encodingDescMap.set(platformEncodingId(3, 4), "Big5");
encodingDescMap.set(platformEncodingId(3, 5), "Wansung");
encodingDescMap.set(platformEncodingId(3, 6), "Johab");
encodingDescMap.set(platformEncodingId(3, 7), "Reserved");
encodingDescMap.set(platformEncodingId(3, 8), "Reserved");
encodingDescMap.set(platformEncodingId(3, 9), "Reserved");
encodingDescMap.set(platformEncodingId(3, 10), "Unicode UCS-4");

// Macintosh platform-specific encoding and language IDs (platform ID = 1)
encodingDescMap.set(platformEncodingId(1, 0), "Roman");
encodingDescMap.set(platformEncodingId(1, 1), "Japanese");
encodingDescMap.set(platformEncodingId(1, 2), "Chinese (Traditional)");
encodingDescMap.set(platformEncodingId(1, 3), "Korean");
encodingDescMap.set(platformEncodingId(1, 4), "Arabic");
encodingDescMap.set(platformEncodingId(1, 5), "Hebrew");
encodingDescMap.set(platformEncodingId(1, 6), "Greek");
encodingDescMap.set(platformEncodingId(1, 7), "Russian");
encodingDescMap.set(platformEncodingId(1, 8), "RSymbol");
encodingDescMap.set(platformEncodingId(1, 9), "Devanagari");
encodingDescMap.set(platformEncodingId(1, 10), "Gurmukhi");
encodingDescMap.set(platformEncodingId(1, 11), "Gujarati");
encodingDescMap.set(platformEncodingId(1, 12), "Oriya");
encodingDescMap.set(platformEncodingId(1, 13), "Bengali");
encodingDescMap.set(platformEncodingId(1, 14), "Tamil");
encodingDescMap.set(platformEncodingId(1, 15), "Telugu");
encodingDescMap.set(platformEncodingId(1, 16), "Kannada");
encodingDescMap.set(platformEncodingId(1, 17), "Malayalam");
encodingDescMap.set(platformEncodingId(1, 18), "Sinhalese");
encodingDescMap.set(platformEncodingId(1, 19), "Burmese");
encodingDescMap.set(platformEncodingId(1, 20), "Khmer");
encodingDescMap.set(platformEncodingId(1, 21), "Thai");
encodingDescMap.set(platformEncodingId(1, 22), "Laotian");
encodingDescMap.set(platformEncodingId(1, 23), "Georgian");
encodingDescMap.set(platformEncodingId(1, 24), "Armenian");
encodingDescMap.set(platformEncodingId(1, 25), "Chinese (Simplified)");
encodingDescMap.set(platformEncodingId(1, 26), "Tibetan");
encodingDescMap.set(platformEncodingId(1, 27), "Mongolian");
encodingDescMap.set(platformEncodingId(1, 28), "Geez");
encodingDescMap.set(platformEncodingId(1, 29), "Slavic");
encodingDescMap.set(platformEncodingId(1, 30), "Vietnamese");
encodingDescMap.set(platformEncodingId(1, 31), "Sindhi");
encodingDescMap.set(platformEncodingId(1, 32), "Uninterpreted");

export const nameIdDescMap = new Map<number, string>();
nameIdDescMap.set(0, "Copyright notice");
nameIdDescMap.set(1, "Font Family");
nameIdDescMap.set(2, "Font Subfamily");
nameIdDescMap.set(3, "Unique subfamily identification");
nameIdDescMap.set(4, "Full name of the font");
nameIdDescMap.set(5, "Version of the name table");
nameIdDescMap.set(6, "PostScript name of the font");
nameIdDescMap.set(7, "Trademark notice");
nameIdDescMap.set(8, "Manufacturer name");
nameIdDescMap.set(9, "Designer");
nameIdDescMap.set(10, "Description");
nameIdDescMap.set(11, "URL of the font vendor");
nameIdDescMap.set(12, "URL of the font designer");
nameIdDescMap.set(13, "License description");
nameIdDescMap.set(14, "License information URL");
nameIdDescMap.set(15, "Reserved");
nameIdDescMap.set(16, "Preferred Family");
nameIdDescMap.set(17, "Preferred Subfamily");
nameIdDescMap.set(18, "Compatible Full (Macintosh only)");
nameIdDescMap.set(19, "Sample text");
nameIdDescMap.set(20, "PostScript CID findfont name");
nameIdDescMap.set(21, "WWS Family Name");
nameIdDescMap.set(22, "WWS Subfamily Name");
nameIdDescMap.set(23, "Light Background Palette");
nameIdDescMap.set(24, "Dark Background Palette");
nameIdDescMap.set(25, "Variations PostScript Name Prefix");
