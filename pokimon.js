document.addEventListener("DOMContentLoaded", () => {
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const heroImage = $("#heroImage");
  const heroTitle = $("#heroTitle");
  const heroDescription = $("#heroDescription");
  const heroPrice = $("#heroPrice");
  const heroDotsWrap = $("#heroDots");
  const heroLocationEl = $("#heroLocation");
  const shopEmailEl = $("#shopEmail");
  const heroButton1El = $("#heroButton1");
  const heroButton2El = $("#heroButton2");
  const footerBrandTitleTextEl = $("#footerBrandTitleText");
  const footerBrandCopyEl = $("#footerBrandCopy");
  const footerBottomLeftEl = $("#footerBottomLeft");
  const footerBottomRightEl = $("#footerBottomRight");
  const navShopEl = $("#navShop");
  const navHowEl = $("#navHow");
  const navCartLabelEl = $("#navCartLabel");
  const navQualityEl = $("#navQuality");
  const navContactEl = $("#navContact");
  const productGridEl = $("#productGrid");
  const ctaTaglineEl = $("#ctaTagline");
  const contactAddressEl = $("#contactAddress");
  const contactPhoneEl = $("#contactPhone");
  const contactEmailEl = $("#contactEmail");
  const contactHoursEl = $("#contactHours");
  const storeInfoAddressEl = $("#storeInfoAddress");
  const storeInfoHoursEl = $("#storeInfoHours");
  const storeInfoPhoneEl = $("#storeInfoPhone");
  const storeInfoEmailEl = $("#storeInfoEmail");
  const storeInfoWhatsAppEl = $("#storeInfoWhatsApp");
  const footerPhoneEl = $("#footerPhone");
  const searchInput = $("#searchInput");
  const searchButton = $("#searchButton");
  const noResults = $("#noResults");
  const cartCountEl = $("#cartCount");
  const cartItemsWrap = $("#cartItems");
  const cartTotalEl = $("#cartTotal");
  const clearCartButton = $("#clearCartButton");
  const toast = $("#toast");
  const sendOrderButton = $("#sendOrderButton");
  const deliveryPhone = $("#deliveryPhone");
  const deliveryEmail = $("#deliveryEmail");
  const deliveryLandmark = $("#deliveryLandmark");
  const deliveryAddress = $("#deliveryAddress");
  const orderSuccessModal = $("#orderSuccessModal");
  const closeModalButton = $("#closeModalButton");
  const header = $("#siteHeader");
  const reviewList = $("#reviewList");
  const reviewForm = $("#reviewForm");
  const reviewPhoto = $("#reviewPhoto");
  const reviewPhotoPreview = $("#reviewPhotoPreview");
  const reviewMessage = $("#reviewMessage");

  let cart = [];
  let productEls = [];
  let products = [];
  let currentHero = 0;
  let heroTimer = null;

  function normalizeText(value) {
    return String(value || "").replace(/</g, "&lt;").replace(/"/g, "&quot;");
  }

  function parseJsonAttribute(value, fallback) {
    try { return JSON.parse(value); } catch (e) { return fallback; }
  }

  function ensureSizes(sizes) {
    if (Array.isArray(sizes) && sizes.length) return sizes;
    return ["EU 39", "EU 40", "EU 41", "EU 42", "EU 43", "EU 44"];
  }

  function ensureColors(colors, defaultImage) {
    if (Array.isArray(colors) && colors.length) return colors;
    if (defaultImage) return [{ colorName: "Default", imageUrl: defaultImage }];
    return [];
  }

  function formatPhoneDisplay(raw) {
    const digits = String(raw || "").replace(/\D/g, "");
    if (!digits) return "";
    const local = digits.startsWith("977") ? digits.slice(3) : digits;
    if (/^(98|97)\d{8}$/.test(local)) return `+977 ${local}`;
    if (/^0[1-9]\d{6,8}$/.test(local)) return local;
    return digits.startsWith("977") ? `+${digits}` : `+977 ${local}`;
  }

  function formatPhoneTel(raw) {
    const digits = String(raw || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("977")) return `tel:+${digits}`;
    if (/^(98|97)\d{8}$/.test(digits)) return `tel:+977${digits}`;
    if (/^0[1-9]\d{6,8}$/.test(digits)) return `tel:+977${digits.slice(1)}`;
    return `tel:+977${digits}`;
  }

  function formatWhatsAppUrl(raw) {
    const digits = String(raw || "").replace(/\D/g, "");
    const wa = digits.startsWith("977") ? digits : `977${digits.replace(/^0/, "")}`;
    return `https://wa.me/${wa}?text=Hi%20Collection%20Shoe%20Center,%20I%20have%20a%20question%20about%20your%20shoes.`;
  }

  function applyPhoneLinks(rawPhone) {
    const display = formatPhoneDisplay(rawPhone);
    const tel = formatPhoneTel(rawPhone);
    const wa = formatWhatsAppUrl(rawPhone);
    if (contactPhoneEl) {
      contactPhoneEl.textContent = display;
      contactPhoneEl.href = tel;
    }
    if (storeInfoPhoneEl) {
      storeInfoPhoneEl.textContent = display;
      storeInfoPhoneEl.href = tel;
    }
    if (footerPhoneEl) {
      footerPhoneEl.textContent = display;
      footerPhoneEl.href = tel;
    }
    if (storeInfoWhatsAppEl) storeInfoWhatsAppEl.href = wa;
    const waFab = $(".whatsapp-fab");
    if (waFab) waFab.href = wa;
  }

  function buildVariantRow(sizes, colors) {
    const optionsHtml = colors.length
      ? colors.map((color, index) => `
            <button type="button" class="color-chip${index === 0 ? " active" : ""}" data-color-name="${normalizeText(color.colorName)}" data-image-url="${normalizeText(color.imageUrl)}">
              ${color.imageUrl ? `<img src="${normalizeText(color.imageUrl)}" alt="${normalizeText(color.colorName)}" />` : ""}
              <span>${normalizeText(color.colorName)}</span>
            </button>`).join("")
      : "";

    return `
      <div class="variant-row">
        <div class="color-options">${optionsHtml}</div>
        <div class="size-field">
          <label>Size</label>
          <select required>
            <option value="" disabled selected>Select size</option>
            ${sizes.map((size) => `<option value="${normalizeText(size)}">${normalizeText(size)}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="validation-message" aria-live="polite"></div>
    `;
  }

  function setupProductVariants(product) {
    const sizes = ensureSizes(parseJsonAttribute(product.dataset.sizes, []));
    const colors = ensureColors(parseJsonAttribute(product.dataset.colors, []), product.querySelector("img")?.src);
    const colorContainer = product.querySelector(".color-options");
    const sizeSelect = product.querySelector("select");
    const imageEl = product.querySelector("img");

    const renderAvailableSizes = (color) => {
      const unavailable = new Set(color?.outOfStockSizes || []);
      const current = sizeSelect?.value || "";
      if (!sizeSelect) return;
      sizeSelect.innerHTML = `<option value="" disabled ${unavailable.has(current) ? "" : "selected"}>Select size</option>${sizes.map((size) => `<option value="${normalizeText(size)}" ${unavailable.has(size) ? "disabled" : ""}>${normalizeText(size)}${unavailable.has(size) ? " — out of stock" : ""}</option>`).join("")}`;
      if (current && !unavailable.has(current)) sizeSelect.value = current;
    };

    if (colorContainer) {
      if (colors.length) {
        colorContainer.innerHTML = colors
          .map((color, index) => `
            <button type="button" class="color-chip${index === 0 ? " active" : ""}" data-color-name="${normalizeText(color.colorName)}" data-image-url="${normalizeText(color.imageUrl)}">
              ${color.imageUrl ? `<img src="${normalizeText(color.imageUrl)}" alt="${normalizeText(color.colorName)}" />` : ""}
              <span>${normalizeText(color.colorName)}</span>
            </button>`)
          .join("");
        colorContainer.querySelectorAll(".color-chip").forEach((chip) => {
          chip.addEventListener("click", () => {
            colorContainer.querySelectorAll(".color-chip").forEach((node) => node.classList.toggle("active", node === chip));
            if (imageEl && chip.dataset.imageUrl) imageEl.src = chip.dataset.imageUrl;
              renderAvailableSizes(colors.find((color) => color.colorName === chip.dataset.colorName));
            syncSizeControls(product);
          });
        });
        const activeChip = colorContainer.querySelector(".color-chip.active");
        if (activeChip && imageEl && activeChip.dataset.imageUrl) {
          imageEl.src = activeChip.dataset.imageUrl;
        }
      } else {
        colorContainer.innerHTML = "";
      }
    }

    renderAvailableSizes(colors[0]);
    syncSizeControls(product);
  }

  function createProductArticle(p) {
    const sizes = ensureSizes(p.availableSizes || []);
    const colors = ensureColors(p.availableColors || [], p.img || "");
    const art = document.createElement("article");
    art.className = "product";
    art.dataset.name = (p.name || "").toLowerCase();
    art.dataset.price = p.price || "";
    art.dataset.sizes = JSON.stringify(sizes);
    art.dataset.colors = JSON.stringify(colors);
    art.dataset.productId = p.id || "";
    art.innerHTML = `
      <img src="${normalizeText((colors[0] && colors[0].imageUrl) || p.img || "")}" alt="${normalizeText(p.name)}" />
      <div class="product-content">
        <h3><a href="product.html?id=${encodeURIComponent(p.id || "")}">${normalizeText(p.name)}</a></h3>
        <p>${normalizeText(p.desc)}</p>
        ${buildVariantRow(sizes, colors)}
        <div class="product-footer">
          <div class="price-tag">Rs ${Number(p.price || 0).toLocaleString()}</div>
          <div style="display:flex;gap:.45rem;align-items:center;flex-wrap:wrap;justify-content:flex-end"><a href="product.html?id=${encodeURIComponent(p.id || "")}" class="btn btn-secondary" style="padding:.7rem .85rem;font-size:.82rem">View details</a><button class="add-button" disabled>Add to cart</button></div>
        </div>
      </div>
    `;
    productGridEl.appendChild(art);
    setupProductVariants(art);
    return art;
  }

  function rebuildProductList() {
    productEls = $$(".product", productGridEl);
    products = productEls.map((el) => {
      const img = el.querySelector("img");
      const name = el.querySelector("h3")?.textContent?.trim() || el.dataset.name || "";
      const desc = el.querySelector("p")?.textContent?.trim() || "";
      const price = el.dataset.price || "";
      return { el, imgSrc: img?.src || "", imgAlt: img?.alt || name, name, desc, price };
    });
  }

  function renderHero(index) {
    const p = products[index];
    if (!p) return;
    heroImage.src = p.imgSrc;
    heroImage.alt = p.imgAlt;
    heroTitle.textContent = p.name;
    heroDescription.textContent = p.desc;
    heroPrice.textContent = p.price ? `Rs ${Number(p.price).toLocaleString()}` : "";
    $$(".hero-dot", heroDotsWrap).forEach((b, i) => b.classList.toggle("active", i === index));
    currentHero = index;
  }

  function startHeroRotation() {
    if (heroTimer) clearInterval(heroTimer);
    if (products.length <= 1) return;
    heroTimer = setInterval(() => {
      renderHero((currentHero + 1) % products.length);
    }, 6000);
  }

  function buildHeroDots() {
    heroDotsWrap.innerHTML = "";
    products.forEach((p, i) => {
      const btn = document.createElement("button");
      btn.className = "hero-dot";
      btn.type = "button";
      btn.setAttribute("aria-label", `Show ${p.name}`);
      btn.addEventListener("click", () => {
        renderHero(i);
        startHeroRotation();
      });
      heroDotsWrap.appendChild(btn);
    });
  }

  function initHeroCarousel() {
    if (!products.length) return;
    buildHeroDots();
    renderHero(0);
    startHeroRotation();
  }

  async function loadProductsFromServer() {
    try {
      const resp = await fetch(API_BASE + "/api/products");
      if (!resp.ok) return null;
      const list = await resp.json();
      return Array.isArray(list) && list.length ? list : null;
    } catch (e) {
      return null;
    }
  }

  async function initProducts() {
    const serverProducts = await loadProductsFromServer();
    if (serverProducts) {
      productGridEl.innerHTML = "";
      serverProducts.filter((p) => p.showOnHome !== false).forEach((p) => createProductArticle(p));
    }
    rebuildProductList();
    initHeroCarousel();
  }

  async function applySiteData() {
    try {
      const [settingsResp, contentResp, heroResp] = await Promise.all([
        fetch(API_BASE + "/api/settings"),
        fetch(API_BASE + "/api/site-content"),
        fetch(API_BASE + "/api/hero")
      ]);
      const settings = settingsResp.ok ? await settingsResp.json() : {};
      const content = contentResp.ok ? await contentResp.json() : {};
      const hero = heroResp.ok ? await heroResp.json() : {};

      if (settings.shop_email) {
        if (shopEmailEl) shopEmailEl.textContent = settings.shop_email;
        if (contactEmailEl) contactEmailEl.textContent = settings.shop_email;
        if (storeInfoEmailEl) {
          storeInfoEmailEl.textContent = settings.shop_email;
          storeInfoEmailEl.href = `mailto:${settings.shop_email}`;
        }
      }
      if (settings.shop_phone) applyPhoneLinks(settings.shop_phone);
      if (settings.contact_address) {
        if (contactAddressEl) contactAddressEl.textContent = settings.contact_address;
        if (storeInfoAddressEl) storeInfoAddressEl.textContent = settings.contact_address;
      }
      if (settings.opening_hours) {
        if (contactHoursEl) contactHoursEl.textContent = settings.opening_hours;
        if (storeInfoHoursEl) storeInfoHoursEl.textContent = settings.opening_hours;
      }
      if (settings.cta_tagline && ctaTaglineEl) {
        ctaTaglineEl.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z"/><path d="M9 12l2 2 4-4"/></svg> ${normalizeText(settings.cta_tagline)}`;
      }

      if (content.hero_button_1 && heroButton1El) heroButton1El.textContent = content.hero_button_1;
      if (content.hero_button_2 && heroButton2El) heroButton2El.textContent = content.hero_button_2;
      if (content.footer_brand_title && footerBrandTitleTextEl) footerBrandTitleTextEl.textContent = content.footer_brand_title;
      if (content.footer_brand_copy && footerBrandCopyEl) footerBrandCopyEl.textContent = content.footer_brand_copy;
      if (content.footer_bottom_left && footerBottomLeftEl) footerBottomLeftEl.textContent = content.footer_bottom_left;
      if (content.footer_bottom_right && footerBottomRightEl) footerBottomRightEl.textContent = content.footer_bottom_right;
      if (content.nav_shop && navShopEl) navShopEl.textContent = content.nav_shop;
      if (content.nav_how && navHowEl) navHowEl.textContent = content.nav_how;
      if (content.nav_cart && navCartLabelEl) navCartLabelEl.textContent = content.nav_cart;
      if (content.nav_quality && navQualityEl) navQualityEl.textContent = content.nav_quality;
      if (content.nav_contact && navContactEl) navContactEl.textContent = content.nav_contact;

      if (hero) {
        if (hero.location && heroLocationEl) heroLocationEl.textContent = hero.location;
        if (hero.img) { heroImage.src = hero.img; heroImage.alt = hero.alt || heroTitle.textContent || ""; }
        if (hero.title) heroTitle.textContent = hero.title;
        if (hero.desc) heroDescription.textContent = hero.desc;
      }
    } catch (e) {
      applyPhoneLinks("9807693360");
    }
  }

  function formatPrice(n) {
    return `Rs ${(Number(n) || 0).toLocaleString()}`;
  }

  function showToast(msg = "Done") {
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), 2200);
  }

  function renderReviews(reviews) {
    if (!reviewList) return;
    if (!reviews.length) {
      reviewList.innerHTML = '<p class="review-empty">No approved reviews yet. Be the first to share your experience.</p>';
      return;
    }
    reviewList.innerHTML = reviews.map((review) => `<article class="review-card"><header><div><strong>${normalizeText(review.name)}</strong><div class="review-stars" aria-label="${Number(review.rating)} out of 5 stars">${"★".repeat(Number(review.rating))}${"☆".repeat(5 - Number(review.rating))}</div></div><small>${new Date(review.createdAt).toLocaleDateString()}</small></header><p>${normalizeText(review.text)}</p>${review.photo ? `<img src="${normalizeText(review.photo)}" alt="Photo shared by ${normalizeText(review.name)}" loading="lazy" />` : ""}</article>`).join("");
  }

  async function loadReviews() {
    if (!reviewList) return;
    try {
      const response = await fetch(API_BASE + "/api/reviews");
      renderReviews(response.ok ? await response.json() : []);
    } catch (error) {
      renderReviews([]);
    }
  }

  function initReviews() {
    if (!reviewForm) return;
    let rating = 0;
    const starButtons = $$("button[data-rating]", reviewForm);
    const updateStars = () => starButtons.forEach((button) => button.classList.toggle("active", Number(button.dataset.rating) <= rating));
    starButtons.forEach((button) => button.addEventListener("click", () => { rating = Number(button.dataset.rating); updateStars(); }));
    reviewPhoto?.addEventListener("change", () => {
      const file = reviewPhoto.files?.[0];
      if (!file) return;
      if (file.size > 3 * 1024 * 1024) {
        reviewMessage.textContent = "Photo must be smaller than 3 MB.";
        reviewPhoto.value = "";
        return;
      }
      const reader = new FileReader();
      reader.onload = () => { reviewPhotoPreview.src = reader.result; reviewPhotoPreview.style.display = "block"; };
      reader.readAsDataURL(file);
    });
    reviewForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      if (!rating) { reviewMessage.textContent = "Please choose a star rating."; return; }
      const submit = reviewForm.querySelector("button[type=submit]");
      submit.disabled = true;
      reviewMessage.textContent = "Submitting for review...";
      let photo = "";
      const file = reviewPhoto?.files?.[0];
      if (file) photo = await new Promise((resolve) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsDataURL(file); });
      try {
        const response = await fetch(API_BASE + "/api/reviews", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: $("#reviewName").value.trim(), rating, text: $("#reviewText").value.trim(), photo }) });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(data.error || "Could not submit review");
        reviewForm.reset(); rating = 0; updateStars(); reviewPhotoPreview.style.display = "none"; reviewMessage.textContent = "Thank you. Your review is awaiting approval.";
      } catch (error) { reviewMessage.textContent = error.message; } finally { submit.disabled = false; }
    });
  }

  function saveCart() {
    try { localStorage.setItem("csc_cart", JSON.stringify(cart)); } catch (e) { /* ignore */ }
  }

  function loadCart() {
    try { cart = JSON.parse(localStorage.getItem("csc_cart") || "[]"); } catch (e) { cart = []; }
    renderCart();
  }

  function renderCart() {
    cartCountEl.textContent = cart.length;
    cartItemsWrap.innerHTML = "";
    if (cart.length === 0) {
      cartItemsWrap.innerHTML = '<div class="empty-cart">Your cart is empty. Add shoes to start checkout.</div>';
      cartTotalEl.textContent = formatPrice(0);
      return;
    }
    let total = 0;
    cart.forEach((item, i) => {
      total += Number(item.price) || 0;
      const node = document.createElement("div");
      node.className = "cart-item";
      node.innerHTML = `
        <div style="display:flex;gap:0.75rem;align-items:center">
          <img src="${item.img}" alt="${item.name}" style="width:48px;height:48px;object-fit:cover;border-radius:8px;flex-shrink:0" />
          <div style="min-width:0">
            <strong style="display:block;font-family:var(--font-display)">${item.name}</strong>
            <span style="color:var(--muted);font-size:0.95rem">${formatPrice(item.price)}</span>
            ${item.color ? `<div style="color:var(--muted);font-size:0.85rem;margin-top:0.3rem">Color: ${item.color}</div>` : ""}
            ${item.size ? `<div style="color:var(--muted);font-size:0.85rem;margin-top:0.3rem">Size: ${item.size}</div>` : ""}
          </div>
        </div>
        <div><button data-index="${i}">Remove</button></div>
      `;
      node.querySelector("button").addEventListener("click", () => {
        cart.splice(i, 1);
        saveCart();
        renderCart();
        showToast("Removed from cart");
      });
      cartItemsWrap.appendChild(node);
    });
    cartTotalEl.textContent = formatPrice(total);
  }

  function syncSizeControls(product) {
    const select = product.querySelector("select");
    const btn = product.querySelector(".add-button");
    if (!select || !btn) return;
    const updateState = () => { btn.disabled = !select.value; };
    select.addEventListener("change", updateState);
    updateState();
  }

  function doSearch() {
    const q = (searchInput.value || "").trim().toLowerCase();
    let visible = 0;
    productEls.forEach((el) => {
      const name = (el.dataset.name || el.querySelector("h3")?.textContent || "").toLowerCase();
      const desc = (el.querySelector("p")?.textContent || "").toLowerCase();
      const match = q === "" || name.includes(q) || desc.includes(q);
      el.style.display = match ? "" : "none";
      if (match) visible += 1;
    });
    noResults.classList.toggle("show", visible === 0);
  }

  searchButton.addEventListener("click", doSearch);
  searchInput.addEventListener("keydown", (e) => { if (e.key === "Enter") doSearch(); });
  searchInput.addEventListener("input", doSearch);

  productGridEl.addEventListener("click", (e) => {
    const btn = e.target.closest(".add-button");
    if (!btn) return;
    const product = btn.closest(".product");
    if (!product) return;
    const select = product.querySelector("select");
    const size = select?.value || "";
    if (!size) {
      showToast("Please select a size before adding to cart");
      return;
    }
    const colorChip = product.querySelector(".color-chip.active");
    const colorName = colorChip ? colorChip.dataset.colorName : "";
    const image = colorChip?.dataset.imageUrl || product.querySelector("img")?.src || "";
    const name = product.querySelector("h3")?.textContent || product.dataset.name || "";
    const price = Number(product.dataset.price) || 0;
    cart.push({ name, img: image, price, size, color: colorName });
    saveCart();
    renderCart();
    showToast("Added to cart!");
  });

  clearCartButton?.addEventListener("click", () => {
    cart = [];
    saveCart();
    renderCart();
  });

  sendOrderButton?.addEventListener("click", async () => {
    const phone = (deliveryPhone?.value || "").trim();
    if (!/^(?:98|97)\d{8}$/.test(phone)) {
      showToast("Enter a valid Nepali mobile number starting with 98 or 97 (10 digits)");
      return;
    }
    if (cart.length === 0) {
      showToast("Your cart is empty");
      return;
    }
    const paymentMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || "";
    sendOrderButton.disabled = true;
    try {
      const response = await fetch(API_BASE + "/api/order-request", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          email: deliveryEmail?.value.trim() || "",
          landmark: deliveryLandmark?.value.trim() || "",
          address: deliveryAddress?.value.trim() || "",
          paymentMethod,
          items: cart.map((item) => ({ name: item.name, size: item.size, color: item.color, price: formatPrice(item.price) }))
        })
      });
      if (!response.ok) throw new Error("Request failed");
      orderSuccessModal?.classList.add("active");
      cart = [];
      saveCart();
      renderCart();
    } catch (error) {
      showToast("We could not send your request. Please try again.");
    } finally {
      sendOrderButton.disabled = false;
    }
  });

  closeModalButton?.addEventListener("click", () => orderSuccessModal?.classList.remove("active"));
  orderSuccessModal?.addEventListener("click", (event) => {
    if (event.target === orderSuccessModal) orderSuccessModal.classList.remove("active");
  });

  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) entry.target.classList.add("is-visible");
      });
    }, { threshold: 0.12 });
    $$(".section").forEach((s) => io.observe(s));
  } else {
    $$(".section").forEach((s) => s.classList.add("is-visible"));
  }

  function onScroll() {
    const y = window.scrollY || window.pageYOffset;
    header.classList.toggle("is-scrolled", y > 12);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  // Secret admin access: click the footer brand logo 7 times within 1.2 seconds
  (function initSecretAdminGate() {
    const footerLogo = document.querySelector(".footer-brand .logo");
    if (!footerLogo) return;
    let clicks = 0;
    let timer = null;
    footerLogo.addEventListener("click", (e) => {
      e.preventDefault();
      clicks += 1;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { clicks = 0; }, 1200);
      if (clicks >= 7) {
        clicks = 0;
        window.location.href = "admin.html";
      }
    });
  })();

  applyPhoneLinks("9807693360");
  applySiteData();
  initProducts();
  initReviews();
  loadReviews();
  loadCart();
});
