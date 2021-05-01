


var onload_callback = function() {
  var first = document.getElementsByClassName('first')[0];
  // var second = document.getElementsByClassName('second')[0];

  if (first) {
      document.styleSheets[0].insertRule("tr.second th {top:" + (first.offsetHeight) + "px; }");
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

