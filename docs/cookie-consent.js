(function () {
  "use strict";

  var CONSENT_KEY = "urbalya_cookie_consent_v1";
  var CONSENT_COOKIE = "urbalya_cookie_consent_v1";
  var CONSENT_DURATION_DAYS = 180;
  var rootEl = document.documentElement;

  function now() {
    return Date.now();
  }

  function safeJsonParse(value) {
    try {
      return JSON.parse(value);
    } catch (_err) {
      return null;
    }
  }

  function saveLocal(value) {
    try {
      localStorage.setItem(CONSENT_KEY, JSON.stringify(value));
      return true;
    } catch (_err) {
      return false;
    }
  }

  function readLocal() {
    try {
      return safeJsonParse(localStorage.getItem(CONSENT_KEY));
    } catch (_err) {
      return null;
    }
  }

  function saveCookie(value) {
    var maxAge = CONSENT_DURATION_DAYS * 24 * 60 * 60;
    var encoded = encodeURIComponent(JSON.stringify(value));
    var secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie =
      CONSENT_COOKIE +
      "=" +
      encoded +
      "; Max-Age=" +
      maxAge +
      "; Path=/; SameSite=Lax" +
      secure;
  }

  function readCookie() {
    var matches = document.cookie.match(new RegExp("(?:^|; )" + CONSENT_COOKIE + "=([^;]*)"));
    if (!matches || !matches[1]) return null;
    return safeJsonParse(decodeURIComponent(matches[1]));
  }

  function isValidConsent(input) {
    return (
      input &&
      typeof input === "object" &&
      input.necessary === true &&
      typeof input.analytics === "boolean" &&
      typeof input.preferences === "boolean" &&
      typeof input.ts === "number"
    );
  }

  function isExpired(consent) {
    var maxMs = CONSENT_DURATION_DAYS * 24 * 60 * 60 * 1000;
    return now() - consent.ts > maxMs;
  }

  function getStoredConsent() {
    var consent = readLocal() || readCookie();
    if (!isValidConsent(consent)) return null;
    if (isExpired(consent)) return null;
    return consent;
  }

  function persistConsent(consent) {
    saveLocal(consent);
    saveCookie(consent);
  }

  function canRun(category, consent) {
    if (category === "necessary") return true;
    if (category === "analytics") return !!consent.analytics;
    if (category === "preferences") return !!consent.preferences;
    return false;
  }

  function activateDeferredScripts(consent) {
    var scripts = document.querySelectorAll('script[type="text/plain"][data-cookie-category]');
    scripts.forEach(function (oldScript) {
      if (oldScript.dataset.cookieLoaded === "1") return;
      var category = oldScript.getAttribute("data-cookie-category") || "necessary";
      if (!canRun(category, consent)) return;

      var newScript = document.createElement("script");
      Array.from(oldScript.attributes).forEach(function (attr) {
        if (attr.name === "type" || attr.name === "data-cookie-category") return;
        newScript.setAttribute(attr.name, attr.value);
      });
      newScript.text = oldScript.text;
      oldScript.dataset.cookieLoaded = "1";
      oldScript.parentNode.insertBefore(newScript, oldScript.nextSibling);
    });
  }

  function applyConsent(consent) {
    rootEl.dataset.cookieAnalytics = consent.analytics ? "granted" : "denied";
    rootEl.dataset.cookiePreferences = consent.preferences ? "granted" : "denied";
    window.URBALYA_COOKIE_CONSENT = {
      necessary: true,
      analytics: consent.analytics,
      preferences: consent.preferences,
      updatedAt: consent.ts
    };
    activateDeferredScripts(consent);
    document.dispatchEvent(
      new CustomEvent("urbalya:cookie-consent-updated", {
        detail: window.URBALYA_COOKIE_CONSENT
      })
    );
  }

  function createUI(storedConsent) {
    var manageBtn = document.createElement("button");
    manageBtn.type = "button";
    manageBtn.className = "cc-manage-btn";
    manageBtn.textContent = "Cookies";
    manageBtn.setAttribute("aria-label", "Gérer les cookies");

    var root = document.createElement("div");
    root.className = "cc-root";
    root.innerHTML =
      '<div class="cc-backdrop" data-cc-close="1"></div>' +
      '<section class="cc-panel" role="dialog" aria-modal="true" aria-label="Préférences cookies">' +
      '  <h2 class="cc-title">Préférences cookies</h2>' +
      '  <p class="cc-text">Nous utilisons uniquement les cookies nécessaires par défaut. Vous pouvez accepter ou refuser les cookies optionnels. <a href="privacy.html#cookies">En savoir plus</a>.</p>' +
      '  <div class="cc-actions">' +
      '    <button type="button" class="cc-btn is-primary" data-cc-action="accept-all">Tout accepter</button>' +
      '    <button type="button" class="cc-btn" data-cc-action="reject-all">Tout refuser</button>' +
      '    <button type="button" class="cc-btn" data-cc-action="customize">Personnaliser</button>' +
      '  </div>' +
      '  <div class="cc-pref">' +
      '    <div class="cc-pref-item">' +
      '      <div><strong>Cookies nécessaires</strong><small>Indispensables au fonctionnement du site.</small></div>' +
      '      <input class="cc-switch" type="checkbox" checked disabled />' +
      '    </div>' +
      '    <div class="cc-pref-item">' +
      '      <div><strong>Mesure d’audience</strong><small>Statistiques de fréquentation du site.</small></div>' +
      '      <input class="cc-switch" id="ccAnalytics" type="checkbox" />' +
      '    </div>' +
      '    <div class="cc-pref-item">' +
      '      <div><strong>Préférences</strong><small>Mémorisation des choix d’interface.</small></div>' +
      '      <input class="cc-switch" id="ccPreferences" type="checkbox" />' +
      '    </div>' +
      '    <div class="cc-actions">' +
      '      <button type="button" class="cc-btn is-primary" data-cc-action="save-custom">Enregistrer mes choix</button>' +
      "    </div>" +
      "  </div>" +
      "</section>";

    document.body.appendChild(manageBtn);
    document.body.appendChild(root);

    var analyticsInput = root.querySelector("#ccAnalytics");
    var preferencesInput = root.querySelector("#ccPreferences");

    function openPanel(showPreferences) {
      root.classList.add("is-open");
      if (showPreferences) root.classList.add("show-pref");
    }

    function closePanel() {
      root.classList.remove("is-open");
      root.classList.remove("show-pref");
    }

    function saveConsent(values) {
      var consent = {
        necessary: true,
        analytics: !!values.analytics,
        preferences: !!values.preferences,
        ts: now()
      };
      persistConsent(consent);
      applyConsent(consent);
      closePanel();
    }

    function setInputsFromConsent(consent) {
      analyticsInput.checked = !!consent.analytics;
      preferencesInput.checked = !!consent.preferences;
    }

    manageBtn.addEventListener("click", function () {
      var latest = getStoredConsent() || {
        necessary: true,
        analytics: false,
        preferences: false,
        ts: now()
      };
      setInputsFromConsent(latest);
      openPanel(true);
    });

    root.addEventListener("click", function (event) {
      var target = event.target;
      if (!target) return;

      if (target.dataset && target.dataset.ccClose === "1") {
        if (getStoredConsent()) closePanel();
        return;
      }

      var action = target.dataset ? target.dataset.ccAction : "";
      if (!action) return;

      if (action === "accept-all") {
        saveConsent({ analytics: true, preferences: true });
      } else if (action === "reject-all") {
        saveConsent({ analytics: false, preferences: false });
      } else if (action === "customize") {
        root.classList.add("show-pref");
      } else if (action === "save-custom") {
        saveConsent({
          analytics: analyticsInput.checked,
          preferences: preferencesInput.checked
        });
      }
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && root.classList.contains("is-open") && getStoredConsent()) {
        closePanel();
      }
    });

    if (storedConsent) {
      setInputsFromConsent(storedConsent);
      applyConsent(storedConsent);
      closePanel();
    } else {
      setInputsFromConsent({ analytics: false, preferences: false });
      openPanel(false);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      createUI(getStoredConsent());
    });
  } else {
    createUI(getStoredConsent());
  }
})();
