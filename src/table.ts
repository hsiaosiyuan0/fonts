import { uint8, uint16, uint32, int16, kSizeofUInt16 } from "./types";

export const tagName2Code = (name: string) => {
  return (
    (name.charCodeAt(0) << 24) |
    (name.charCodeAt(1) << 16) |
    (name.charCodeAt(2) << 8) |
    name.charCodeAt(3)
  );
};

export enum TableTag {
  cmap = tagName2Code("cmap"),
  glyf = tagName2Code("glyf"),
  head = tagName2Code("head"),
  hhea = tagName2Code("hhea"),
  hmtx = tagName2Code("hmtx"),
  loca = tagName2Code("loca"),
  maxp = tagName2Code("maxp"),
  name = tagName2Code("name"),
  post = tagName2Code("post"),
  cvt = tagName2Code("cvt"),
  fpgm = tagName2Code("fpgm"),
  hdmx = tagName2Code("hdmx"),
  kern = tagName2Code("kern"),
  OS2 = tagName2Code("OS/2"),
  prep = tagName2Code("prep")
}

export enum PlatformId {
  // just a code as comment style
  Unicode = 0 as uint16,
  Macintosh = 1 as uint16,
  ISO = 2 as uint16,
  Windows = 3 as uint16,
  Custom = 4 as uint16
}

export abstract class Table {
  tag: TableTag;

  constructor(tag: TableTag) {
    this.tag = tag;
  }

  as<T>(): T {
    return this as any;
  }
}
