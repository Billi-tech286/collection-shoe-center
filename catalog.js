document.addEventListener("DOMContentLoaded", async () => {
  const grid = document.getElementById("productGrid");
  const search = document.getElementById("search");
  const sort = document.getElementById("sort");
  const count = document.getElementById("cartCount");
  const params = new URLSearchParams(window.location.search);
  let allProducts = [];
  let cart = readCart();

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char]));
  }

  function fallbackImage(name) {
    const label = String(name || "Collection Shoe Center").slice(0, 32);
    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600"><rect width="800" height="600" fill="#201712"/><path d="M150 370c115-42 188-144 270-150 82-6 117 61 190 96 36 18 55 47 35 82-22 39-89 48-155 43l-266-20c-70-5-111-19-74-51z" fill="#cf6a35"/><path d="M184 370c95-19 167-58 220-105" fill="none" stroke="#f4e9d8" stroke-width="12" stroke-linecap="round"/><text x="400" y="530" fill="#f4e9d8" font-family="sans-serif" font-size="30" text-anchor="middle">${label}</text></svg>`)}`;
  }

  function readCart() {
    try { return JSON.parse(localStorage.getItem("csc_cart") || "[]"); } catch (error) { return []; }
  }

  function saveCart() {
    localStorage.setItem("csc_cart", JSON.stringify(cart));
    count.textContent = cart.length;
  }

  function colorsFor(product) {
    return Array.isArray(product.availableColors) && product.availableColors.length ? product.availableColors : [{ colorName: "Default", imageUrl: product.img }];
  }

  function firstAvailableSize(product) {
    const sizes = Array.isArray(product.availableSizes) ? product.availableSizes : [];
    const unavailable = new Set((colorsFor(product)[0].outOfStockSizes || []));
    return sizes.find((size) => !unavailable.has(size)) || "";
  }

  function addToCart(product) {
    const color = colorsFor(product)[0];
    const size = firstAvailableSize(product);
    if (!size) {
      window.location.href = `product.html?id=${encodeURIComponent(product.id)}`;
      return;
    }
    cart.push({ id: product.id, name: product.name, img: color.imageUrl || product.img, price: Number(product.price) || 0, size, color: color.colorName || "Default" });
    saveCart();
  }

  function card(product) {
    const colors = colorsFor(product);
    const image = colors[0].imageUrl || product.img || "";
    const fallback = fallbackImage(product.name);
    const sale = product.salePrice && Number(product.salePrice) < Number(product.price);
    return `<article class="product-card">
      <a class="product-image" href="product.html?id=${encodeURIComponent(product.id)}"><img loading="lazy" src="${escapeHtml(image)}" alt="${escapeHtml(product.name)}" onerror="this.onerror=null;this.src='${escapeHtml(fallback)}'" />${sale ? '<span class="badge">Sale</span>' : ''}</a>
      <div class="product-info"><h2><a href="product.html?id=${encodeURIComponent(product.id)}">${escapeHtml(product.name)}</a></h2><p>${escapeHtml(product.desc)}</p><div class="colors" aria-label="Available colors">${colors.map((color) => `<span class="swatch" title="${escapeHtml(color.colorName)}" style="background:${escapeHtml(color.colorName || "#888")}"></span>`).join("")}</div><span class="price">Rs ${(Number(sale ? product.salePrice : product.price) || 0).toLocaleString()}${sale ? ` <del style="color:var(--muted);font-size:.8rem;font-weight:400">Rs ${Number(product.price).toLocaleString()}</del>` : ""}</span><div class="card-actions"><a class="btn btn-light" href="product.html?id=${encodeURIComponent(product.id)}">View details</a><button class="btn btn-primary quick-add" type="button" data-id="${escapeHtml(product.id)}">Quick add</button></div></div>
    </article>`;
  }

  function matches(product) {
    if (product.showInCatalog === false) return false;
    const query = search.value.trim().toLowerCase();
    const category = (params.get("category") || "").toLowerCase();
    const filter = (params.get("filter") || "").toLowerCase();
    const text = `${product.name} ${product.desc} ${(product.category || "")} ${(product.gender || "")} ${colorsFor(product).map((color) => color.colorName).join(" ")}`.toLowerCase();
    if (query && !text.includes(query)) return false;
    if (category && !text.includes(category)) return false;
    if (filter === "new" && !product.isNew && !product.newArrival) return false;
    if (filter === "bestseller" && !product.bestseller && !product.isBestseller) return false;
    if (filter === "sale" && !(product.salePrice && Number(product.salePrice) < Number(product.price))) return false;
    return true;
  }

  function render() {
    let visible = allProducts.filter(matches);
    if (sort.value === "low") visible.sort((a, b) => Number(a.price) - Number(b.price));
    if (sort.value === "high") visible.sort((a, b) => Number(b.price) - Number(a.price));
    if (sort.value === "newest") visible = visible.slice().reverse();
    grid.innerHTML = visible.length ? visible.map(card).join("") : '<div class="empty"><h2>NO PRODUCTS FOUND</h2><p>Try another search or clear the filters.</p></div>';
  }

  try {
    const response = await fetch("/api/products");
    allProducts = response.ok ? await response.json() : [];
  } catch (error) { allProducts = []; }
  search.value = params.get("search") || "";
  saveCart();
  render();
  search.addEventListener("input", render);
  sort.addEventListener("change", render);
  document.getElementById("clear").addEventListener("click", () => { search.value = ""; window.history.replaceState({}, "", "catalog.html"); render(); });
  grid.addEventListener("click", (event) => {
    const button = event.target.closest(".quick-add");
    if (!button) return;
    const product = allProducts.find((item) => String(item.id) === button.dataset.id);
    if (!product) return;
    addToCart(product);
  });
});