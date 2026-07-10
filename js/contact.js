/* ===== Contact — populate machine select + wire form to WhatsApp/email ===== */
(function () {
  const B = ART.brand;

  // direct contact cards
  const wa = document.getElementById("waCard");
  if (wa) wa.href = ART.helper.wa();
  const ph = document.getElementById("phoneCard"), phv = document.getElementById("phoneVal");
  if (ph) { ph.href = "tel:+" + B.phoneDial; phv.textContent = B.phoneDisplay; }
  const em = document.getElementById("emailCard"), emv = document.getElementById("emailVal");
  if (em) { em.href = "mailto:" + B.email; emv.textContent = B.email; }

  // machine select
  const sel = document.getElementById("fMachine");
  if (sel) {
    const opts = ['<option value="Complete automatic line">Complete automatic line</option>']
      .concat([...ART.machines].sort((a, b) => a.order - b.order).map(m => `<option value="${m.name}">${m.name}</option>`))
      .concat('<option value="Not sure yet" selected>Not sure yet</option>');
    sel.innerHTML = opts.join("");
  }

  // compose message from form
  const form = document.getElementById("ctForm");
  const confirm = document.getElementById("ctConfirm");
  const mailFallback = document.getElementById("mailFallback");

  // returns PLAIN text (real newlines); callers URL-encode it themselves
  function compose() {
    const g = id => (document.getElementById(id).value || "").trim();
    const name = g("fName"), company = g("fCompany"), contact = g("fContact"),
      machine = document.getElementById("fMachine").value, msg = g("fMsg");
    let t = "Hi ART Mechatronics,\n\n";
    t += "Name: " + name + "\n";
    if (company) t += "Company: " + company + "\n";
    t += "Contact: " + contact + "\n";
    t += "Interested in: " + machine + "\n\n";
    t += msg;
    return t;
  }

  function valid() {
    let ok = true;
    ["fName", "fContact", "fMsg"].forEach(id => {
      const el = document.getElementById(id);
      if (!el.value.trim()) { el.style.borderColor = "var(--stop)"; ok = false; }
      else el.style.borderColor = "";
    });
    return ok;
  }

  if (form) {
    form.addEventListener("submit", e => {
      e.preventDefault();
      if (!valid()) return;
      const url = "https://wa.me/" + B.phoneDial + "?text=" + encodeURIComponent(compose());
      window.open(url, "_blank", "noopener");
      confirm.classList.add("show");
    });
  }
  if (mailFallback) {
    mailFallback.addEventListener("click", e => {
      e.preventDefault();
      if (!valid()) return;
      location.href = `mailto:${B.email}?subject=${encodeURIComponent("Enquiry — ART Mechatronics")}&body=${encodeURIComponent(compose())}`;
      confirm.classList.add("show");
    });
  }
})();
