import { Font } from "../src/sfnt";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { TableTag } from "../src/table";
import { CmapTable } from "../src/cmap";
// tslint:disable-next-line:no-implicit-dependencies
import { performance } from "perf_hooks";

const readFile = promisify(fs.readFile);
(async () => {
  const buf = await readFile(path.resolve(__dirname, "UnBom.ttf"));

  performance.mark("font.satisfy.begin");
  const font = new Font(buf);
  font.satisfy();
  performance.mark("font.satisfy.end");
  performance.measure("font.satisfy", "font.satisfy.begin", "font.satisfy.end");
  console.log(performance.getEntriesByName("font.satisfy")[0].duration + "ms");

  font.tableRecords.forEach(r => console.log(r.tagName));
  const cmap = font.tables.get(TableTag.cmap)!.as<CmapTable>();
  console.log(cmap.subTables);
})();
