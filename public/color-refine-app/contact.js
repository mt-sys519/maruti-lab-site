"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  if (params.get("sent") !== "1") return;

  const success = document.getElementById("contact-success");
  const form = document.querySelector(".contact-form");
  if (!success) return;

  success.hidden = false;
  if (form) form.hidden = true;
  success.focus();

  const cleanUrl = `${window.location.pathname}${window.location.hash}`;
  window.history.replaceState({}, document.title, cleanUrl);
});
