(function () {
  // Only run on the real public web app. Does nothing in the desktop app,
  // on localhost, or anywhere else, so no network call is ever made there.
  if (location.hostname !== 'vistaimagestudio.thestreamic.in') return;

  var s = document.createElement('script');
  s.defer = true;
  s.src = 'https://cloud.umami.is/script.js';
  s.setAttribute('data-website-id', '151765df-c49a-46ba-bf73-e26470d4ea00');
  s.setAttribute('data-domains', 'vistaimagestudio.thestreamic.in');
  document.head.appendChild(s);

  // Counts clicks on important links (event names only, nothing else sent)
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a');
    if (!a || !window.umami) return;
    var href = a.href || '';
    var name = null;
    if (/\.exe(\?|$)|\.appx(\?|$)/i.test(href) || href.indexOf('/releases') > -1) {
      name = 'windows_download_click';
    } else if (/eula|privacy|notice|legal|terms/i.test(href)) {
      name = 'legal_click';
    } else if (/guide|docs/i.test(href)) {
      name = 'guide_click';
    } else if (/github\.com/i.test(href)) {
      name = 'github_click';
    }
    if (name) window.umami.track(name);
  }, true);
})();
