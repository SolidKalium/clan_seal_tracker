


var onload_callback = function() {
  var first = document.getElementsByClassName('first')[0];
  if (first) {
      document.styleSheets[0].insertRule("tr.second th, tr.second th {top:" + (first.offsetHeight + 2) + "px; }");
  }
};

if (
    document.readyState === "complete" ||
    (document.readyState !== "loading" && !document.documentElement.doScroll)
) {
  onload_callback();
} else {
  document.addEventListener("DOMContentLoaded", onload_callback);
}

