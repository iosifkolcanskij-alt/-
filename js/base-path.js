(function () {
  function detectBase() {
    if (!location.hostname.endsWith('.github.io')) return '';
    const segments = location.pathname.split('/').filter(Boolean);
    if (!segments.length) return '';
    const first = segments[0];
    if (first.includes('.')) return '';
    return '/' + first;
  }
  window.SK_BASE = detectBase();
})();
