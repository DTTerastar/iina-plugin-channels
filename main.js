const { sidebar, standaloneWindow, menu, preferences, core, event, mpv, utils } = iina;

// Playlists and guides are fetched with curl: IINA's http module refuses plain http:// URLs
// (App Transport Security), and a web view only gets them if the server sends CORS headers.
async function fetchText(url) {
  // The guide URL comes out of the playlist, so only ever hand curl an http(s) URL.
  if (!/^https?:\/\//i.test(url)) throw new Error("not an http(s) URL");
  const out = await utils.exec("/usr/bin/curl", [
    "-fsSL", "--compressed", "--proto", "=http,https", "--max-time", "60",
    "-A", "iina-plugin-channels", "--", url,
  ]);
  if (out.status !== 0) throw new Error((out.stderr || "").trim() || "curl exited with " + out.status);
  return out.stdout;
}

async function send(view, name, url) {
  try {
    view.postMessage(name, { text: await fetchText(url) });
  } catch (e) {
    view.postMessage(name, { error: e.message || String(e) });
  }
}

// The channel just picked in the list, until mpv starts loading it.
let pending = null;

// Title the stream with its channel name instead of the URL's file name.
// The option is file-local, so it clears itself when the stream ends.
// IINA only allows this mpv option with the "file-system" permission.
mpv.addHook("on_load", 9, () => {
  if (!pending) return;
  mpv.set("file-local-options/force-media-title", pending.name);
  pending = null;
});

// One page backs both the sidebar tab and a standalone window, so the list can be
// browsed before anything is playing. loadFile clears listeners, so register after it.
function show(view) {
  view.loadFile("channels.html");
  view.onMessage("load", () => {
    const url = preferences.get("m3u_url") || "";
    view.postMessage("config", { sidebar: view === sidebar, configured: !!url });
    if (url) send(view, "playlist", url);
  });
  view.onMessage("guide", ({ url }) => send(view, "guide", url));
  // core.open on an http(s) URL needs "network-request" plus the stream's host in allowedDomains.
  view.onMessage("play", ({ url, name }) => {
    try {
      pending = { url, name };
      core.open(url);
      core.osd(name);
    } catch (e) {
      pending = null;
      view.postMessage("error", "Could not play " + name + ": " + (e.message || e));
    }
  });
}

show(standaloneWindow);
standaloneWindow.setProperty({ title: "Browse" });
standaloneWindow.setFrame(380, 640);
menu.addItem(menu.item("Show Channel List", () => standaloneWindow.open()));

event.on("iina.window-loaded", () => show(sidebar));
