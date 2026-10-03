// "#EXTINF:-1 tvg-id="x" group-title="News",CNN" followed by the stream URL on the next line.
function parseM3U(text) {
  const channels = [];
  let name = null, group = "", id = "";
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (line.startsWith("#EXTINF")) {
      group = (line.match(/group-title="([^"]*)"/) || [])[1] || "";
      id = (line.match(/tvg-id="([^"]*)"/) || [])[1] || "";
      // The name starts after the comma that follows the quoted attributes, so commas inside either survive.
      const m = line.match(/^#EXTINF:-?\d+(?:\s+[\w-]+="[^"]*")*\s*,(.*)$/);
      name = (m ? m[1] : line.slice(line.lastIndexOf(",") + 1)).trim();
    } else if (line && !line.startsWith("#")) {
      channels.push({ name: name || line, group, id, url: line });
      name = null;
      group = "";
      id = "";
    }
  }
  return channels;
}

// The guide (XMLTV) URL a playlist advertises on its #EXTM3U line, if any.
function guideUrl(text) {
  const m = text.split("\n", 1)[0].match(/(?:url-tvg|x-tvg-url)="([^"]+)"/);
  return m ? m[1].split(",")[0].trim() : "";
}

// XMLTV times look like "20261002000000 +0000"; returns epoch milliseconds, or NaN.
function xmltvTime(s) {
  const m = /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)?\s*(?:([+-])(\d\d)(\d\d))?/.exec(s || "");
  if (!m) return NaN;
  const utc = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0));
  const offset = m[7] ? (m[7] === "-" ? -1 : 1) * (m[8] * 60 + +m[9]) * 60000 : 0;
  return utc - offset;
}

if (typeof module !== "undefined" && require.main === module) {
  // Self-check: `node m3u.js`
  const assert = require("assert");
  const playlist = [
    '#EXTM3U url-tvg="http://g/xmltv.php?u=1,http://g/other" x-tvg-url="http://g/x"',
    '#EXTINF:-1 tvg-id="a,b" tvg-logo="http://x/l.png" group-title="US, News",CNN, HD',
    "http://h/1.ts",
    "#EXTVLCOPT:foo",
    "#EXTINF:-1,Plain\r",
    "http://h/2.ts\r",
    "http://h/3.ts",
  ].join("\n");
  assert.deepStrictEqual(parseM3U(playlist), [
    { name: "CNN, HD", group: "US, News", id: "a,b", url: "http://h/1.ts" },
    { name: "Plain", group: "", id: "", url: "http://h/2.ts" },
    { name: "http://h/3.ts", group: "", id: "", url: "http://h/3.ts" },
  ]);
  assert.strictEqual(guideUrl(playlist), "http://g/xmltv.php?u=1");
  assert.strictEqual(guideUrl("#EXTM3U\n#EXTINF:-1,x"), "");
  assert.strictEqual(xmltvTime("20261002000000 +0000"), Date.UTC(2026, 9, 2));
  assert.strictEqual(xmltvTime("20261002200000 -0400"), Date.UTC(2026, 9, 3));
  assert.strictEqual(xmltvTime("202610022000"), Date.UTC(2026, 9, 2, 20));
  assert.ok(Number.isNaN(xmltvTime("")));
  console.log("ok");
}
