(() => {
  const $ = (id) => document.getElementById(id);
  const form = $("searchForm");
  const countrySel = $("country");
  const phoneInput = $("phone");
  const errorEl = $("error");
  const result = $("result");

  const TYPES = {
    MOBILE: "Mobile",
    FIXED_LINE: "Landline",
    FIXED_LINE_OR_MOBILE: "Mobile / Landline",
    TOLL_FREE: "Toll-free",
    PREMIUM_RATE: "Premium rate",
    SHARED_COST: "Shared cost",
    VOIP: "VoIP",
    PERSONAL_NUMBER: "Personal number",
    PAGER: "Pager",
    UAN: "UAN",
    VOICEMAIL: "Voicemail",
  };

  const regionNames = (() => {
    try { return new Intl.DisplayNames(["en"], { type: "region" }); } catch { return null; }
  })();
  const countryName = (iso) => (regionNames && regionNames.of(iso)) || iso;
  const flag = (iso) =>
    iso && iso.length === 2
      ? String.fromCodePoint(...[...iso.toUpperCase()].map((c) => 127397 + c.charCodeAt(0)))
      : "🌐";

  // Theme
  const root = document.documentElement;
  const getStored = () => { try { return localStorage.getItem("theme"); } catch { return null; } };
  const setStored = (v) => { try { localStorage.setItem("theme", v); } catch {} };
  const initial = getStored() || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  root.dataset.theme = initial;
  $("themeBtn").addEventListener("click", () => {
    const next = root.dataset.theme === "dark" ? "light" : "dark";
    root.dataset.theme = next;
    setStored(next);
  });

  $("yr").textContent = new Date().getFullYear();

  // Countries
  function fillCountries() {
    const lib = window.libphonenumber;
    let list = [];
    if (lib && lib.getCountries) {
      list = lib.getCountries().map((iso) => ({
        iso,
        code: lib.getCountryCallingCode(iso),
        name: countryName(iso),
      }));
    } else {
      list = [
        { iso: "US", code: "1", name: "United States" },
        { iso: "IN", code: "91", name: "India" },
        { iso: "GB", code: "44", name: "United Kingdom" },
        { iso: "AE", code: "971", name: "United Arab Emirates" },
        { iso: "SA", code: "966", name: "Saudi Arabia" },
      ];
    }
    list.sort((a, b) => a.name.localeCompare(b.name));
    countrySel.innerHTML = list
      .map((c) => `<option value="${c.iso}" ${c.iso === "US" ? "selected" : ""}>${flag(c.iso)} +${c.code} ${c.name}</option>`)
      .join("");
    updateLabel();
  }

  function updateLabel() {
    const opt = countrySel.selectedOptions[0];
    if (!opt) return;
    const m = opt.textContent.match(/^(\S+)\s+(\+\d+)/);
    $("ccLabel").textContent = m ? `${m[1]} ${m[2]}` : opt.textContent;
  }
  countrySel.addEventListener("change", updateLabel);

  // Keep only allowed phone characters
  phoneInput.addEventListener("input", () => {
    phoneInput.value = phoneInput.value.replace(/[^\d+\s()-]/g, "");
    errorEl.textContent = "";
  });

  function show(data) {
    $("rFlag").textContent = flag(data.iso);
    $("rNumber").textContent = data.intl;
    $("rMeta").textContent = `${data.country} · ${data.type}`;
    const badge = $("rValid");
    badge.textContent = data.valid ? "✓ Valid" : "✕ Invalid";
    badge.className = "badge " + (data.valid ? "ok" : "bad");
    $("rCountry").textContent = `${flag(data.iso)} ${data.country}`;
    $("rType").textContent = data.type;
    $("rCode").textContent = "+" + data.code;
    $("rNational").textContent = data.national;
    $("rIntl").textContent = data.intl;
    $("rE164").textContent = data.e164;

    const digits = data.e164.replace("+", "");
    const nat = String(data.nationalNumber || digits);
    $("lnkTc").href = `https://www.truecaller.com/search/${(data.iso || "us").toLowerCase()}/${nat}`;
    $("lnkWa").href = `https://wa.me/${digits}`;
    $("lnkG").href = `https://www.google.com/search?q=${encodeURIComponent('"' + data.e164 + '"')}`;
    $("lnkScam").href = `https://www.google.com/search?q=${encodeURIComponent('"' + data.e164 + '" OR "' + data.national + '" scam OR spam OR robocall')}`;
    $("copyBtn").onclick = async () => {
      try {
        await navigator.clipboard.writeText(data.e164);
        $("copyBtn").textContent = "Copied!";
        setTimeout(() => ($("copyBtn").textContent = "Copy"), 1500);
      } catch {}
    };

    result.hidden = false;
    result.style.animation = "none";
    void result.offsetWidth;
    result.style.animation = "";
    result.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function lookup(raw, iso) {
    const lib = window.libphonenumber;
    const cleaned = raw.trim();
    if (!lib) {
      // Fallback without library
      const digits = cleaned.replace(/\D/g, "");
      const code = countrySel.selectedOptions[0].textContent.match(/\+(\d+)/)[1];
      return {
        iso, code, country: countryName(iso), type: "Unknown",
        valid: digits.length >= 7 && digits.length <= 15,
        national: digits, intl: `+${code} ${digits}`, e164: `+${code}${digits}`, nationalNumber: digits,
      };
    }
    const p = lib.parsePhoneNumber(cleaned, cleaned.startsWith("+") ? undefined : iso);
    const country = p.country || iso;
    return {
      iso: country,
      code: p.countryCallingCode,
      country: countryName(country),
      type: TYPES[p.getType && p.getType()] || "Unknown",
      valid: p.isValid(),
      national: p.formatNational(),
      intl: p.formatInternational(),
      e164: p.number,
      nationalNumber: p.nationalNumber,
    };
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    errorEl.textContent = "";
    const raw = phoneInput.value;
    const digits = raw.replace(/\D/g, "");
    if (digits.length < 5) {
      errorEl.textContent = "Please enter a valid mobile number.";
      phoneInput.focus();
      return;
    }
    const btn = $("searchBtn");
    btn.classList.add("loading");
    setTimeout(() => {
      try {
        const data = lookup(raw, countrySel.value);
        show(data);
      } catch {
        errorEl.textContent = "Couldn't read this number. Check the country code and try again.";
        result.hidden = true;
      }
      btn.classList.remove("loading");
    }, 250);
  });

  // Example numbers & country shortcuts
  const setCountry = (iso) => {
    if ([...countrySel.options].some((o) => o.value === iso)) {
      countrySel.value = iso;
      updateLabel();
    }
  };
  document.addEventListener("click", (e) => {
    const el = e.target.closest("[data-cc]");
    if (!el) return;
    setCountry(el.dataset.cc);
    phoneInput.value = el.dataset.num || "";
    errorEl.textContent = "";
    document.getElementById("title").scrollIntoView({ behavior: "smooth", block: "start" });
    if (el.dataset.num) form.requestSubmit();
    else setTimeout(() => phoneInput.focus({ preventScroll: true }), 400);
  });

  if (document.readyState === "complete") fillCountries();
  else window.addEventListener("load", fillCountries);
})();
