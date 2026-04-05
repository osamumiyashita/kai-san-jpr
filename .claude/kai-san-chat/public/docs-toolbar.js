// docs-toolbar.js — Docs tab toolbar: open in new window
// §17-7: Separate file.

(function () {
  'use strict';

  document.addEventListener('DOMContentLoaded', () => {
    const btn = document.getElementById('btn-docs-external');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const frame = document.getElementById('docs-frame');
      if (!frame || !frame.src || frame.src === 'about:blank') {
        alert('表示中のドキュメントがありません');
        return;
      }
      // Build full URL for new window
      const url = frame.src;
      window.open(url, '_blank', 'width=900,height=700,menubar=no,toolbar=no,scrollbars=yes');
    });
  });
})();
