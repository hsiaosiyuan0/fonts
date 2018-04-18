# font-toolkit

Font file manipulating in typescript.

[demo](http://fonts.hsiaosiyuan.com/)

## Install

```bash
npm install font-toolkit
```

## Usage

```js
const util = require("util");
const fontKit = require("font-toolkit");

const readFile = util.promisify(fs.readFile);
const writeFile = util.promisify(fs.writeFile);

// read font
const buf = await readFile("path-to-your-font");
const srcFont = new fontKit.Font(buf);
srcFont.satisfy();

// minify
const mini = new fontKit.Minifier(srcFont);
const newFont = mini.with("永和九年，岁在癸丑");

// write to buf
const wb = new fontKit.BufferWriter();
newFont.write2(wb);

await writeFile("path-to-your-dist", wb.buffer);
```
