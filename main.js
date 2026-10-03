const { sidebar, standaloneWindow, menu, preferences, core, event, mpv } = iina;

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
  // The page fetches the playlist itself: IINA's http module refuses plain http:// URLs
  // (App Transport Security), but web content is allowed to load them.
  view.onMessage("load", () => {
    view.postMessage("config", { url: preferences.get("m3u_url") || "", sidebar: view === sidebar });
  });
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
