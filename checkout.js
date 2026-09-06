document.addEventListener("DOMContentLoaded", () => {
  const itemsEl = document.getElementById("items");
  const totalEl = document.getElementById("total");
  const form = document.getElementById("checkoutForm");
  const message = document.getElementById("message");
  let cart = readCart();

  function readCart() {
    try { return JSON.parse(localStorage.getItem("csc_cart") || "[]"); } catch (error) { return []; }
  }

  function saveCart() { localStorage.setItem("csc_cart", JSON.stringify(cart)); }
  function escapeHtml(value) { return String(value || "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char])); }
  function money(value) { return `Rs ${(Number(value) || 0).toLocaleString()}`; }

  function render() {
    if (!cart.length) {
      itemsEl.innerHTML = '<div class="empty">Your cart is empty.<br /><a class="btn btn-primary" href="catalog.html">Explore collection</a></div>';
      totalEl.textContent = money(0);
      form.querySelector("button[type=submit]").disabled = true;
      return;
    }
    form.querySelector("button[type=submit]").disabled = false;
    itemsEl.innerHTML = cart.map((item, index) => `<div class="item"><div class="item-info"><img src="${escapeHtml(item.img)}" alt="${escapeHtml(item.name)}" /><div><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.color || "Default")} · ${escapeHtml(item.size || "Size not selected")}</small></div></div><div><strong>${money(item.price)}</strong><br /><button type="button" data-index="${index}">Remove</button></div></div>`).join("");
    totalEl.textContent = money(cart.reduce((sum, item) => sum + (Number(item.price) || 0), 0));
    itemsEl.querySelectorAll("button[data-index]").forEach((button) => button.addEventListener("click", () => {
      cart.splice(Number(button.dataset.index), 1);
      saveCart();
      render();
    }));
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const phone = document.getElementById("phone").value.trim();
    if (!/^(?:98|97)\d{8}$/.test(phone)) {
      message.textContent = "Enter a valid Nepali mobile number starting with 98 or 97.";
      message.className = "message error";
      return;
    }
    if (!cart.length) return;
    const submit = form.querySelector("button[type=submit]");
    submit.disabled = true;
    message.textContent = "Submitting your order...";
    message.className = "message";
    try {
      const response = await fetch("/api/order-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          email: document.getElementById("email").value.trim(),
          landmark: document.getElementById("landmark").value.trim(),
          address: document.getElementById("address").value.trim(),
          paymentMethod: document.querySelector('input[name="payment"]:checked')?.value || "",
          items: cart.map((item) => ({ id: item.id || "", name: item.name, size: item.size, color: item.color, priceValue: Number(item.price) || 0 }))
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Could not place order");
      cart = [];
      saveCart();
      render();
      message.textContent = `Order received. Reference: ${data.orderId || "confirmed"}. We will contact you shortly.`;
      message.className = "message success";
      form.reset();
    } catch (error) {
      message.textContent = error.message;
      message.className = "message error";
      submit.disabled = false;
    }
  });

  render();
});
