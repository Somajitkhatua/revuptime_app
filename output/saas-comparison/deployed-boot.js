// Starts the app. During a deploy the old and the new server both answer for a few seconds, so a page from the new
// build can ask the old server for a file it does not have yet. Instead of a blank or unstyled page, wait and reload
// (for about 40 seconds at most). This file is not hashed and is served with no-cache, so every build uses the same one.
(function () {
  var me = document.currentScript;
  var entry = me && me.getAttribute("data-entry");
  var KEY = "rv:boot-retries";
  if (!entry) return;

  function tries() { try { return Number(sessionStorage.getItem(KEY) || 0); } catch (e) { return 10; } }
  function retry() {
    var n = tries();
    if (n >= 10) return; // give up: show whatever loaded rather than reload forever
    try { sessionStorage.setItem(KEY, String(n + 1)); } catch (e) { return; }
    setTimeout(function () { location.reload(); }, Math.min(1500 + n * 1000, 5000));
  }
  // The main stylesheet is linked in <head>; a 404 leaves it missing or empty.
  function stylesOk() {
    var link = document.querySelector('link[rel="stylesheet"][href*="/assets/index-"]');
    if (!link) return true;
    for (var i = 0; i < document.styleSheets.length; i++) {
      var sheet = document.styleSheets[i];
      if (sheet.href === link.href) { try { return sheet.cssRules.length > 0; } catch (e) { return true; } }
    }
    return false;
  }

  import(entry).then(function () {
    if (!stylesOk()) return retry();
    try { sessionStorage.removeItem(KEY); } catch (e) { /* private window */ }
  }, retry);
})();
