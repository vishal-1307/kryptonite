// Runs synchronously in <head> (external file, so a strict CSP without 'unsafe-inline' still allows it):
// applies saved preferences before first paint, so there is no theme or sidebar flash.
// Light is the default; dark only if the user chose it. Sidebar: saved choice, else expanded on wide screens.
(function () {
  var root = document.documentElement;
  try {
    if (localStorage.getItem('cv-theme') === 'dark') {
      root.classList.add('dark');
      var meta = document.querySelector('meta[name=theme-color]');
      if (meta) meta.content = '#000000';
    }
    if (localStorage.getItem('cv-motion') === 'reduce') root.classList.add('reduce-motion');
    var sb = localStorage.getItem('cv-sidebar');
    if (sb === 'collapsed' || (sb !== 'expanded' && window.innerWidth < 1200)) root.classList.add('sb-collapsed');
  } catch (e) { /* storage blocked: defaults */ }
  root.classList.add('booting'); // no sidebar transition on the first frame; core/app.js removes it
})();
