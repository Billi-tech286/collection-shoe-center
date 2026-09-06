document.addEventListener("DOMContentLoaded", async () => {
  const id = new URLSearchParams(window.location.search).get("id");
  const image = document.getElementById("productImage");
  const name = document.getElementById("productName");
  const description = document.getElementById("productDescription");
  const price = document.getElementById("productPrice");
  const colors = document.getElementById("colors");
  const size = document.getElementById("size");
  const message = document.getElementById("message");
  const cartCount = document.getElementById("cartCount");
  let cart = [];
  let product;
  let selectedColor;

  function escapeHtml(value) { return String(value || "").replace(/[&<>\"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char])); }
  function readCart() { try { return JSON.parse(localStorage.getItem("csc_cart") || "[]"); } catch (error) { return []; } }
  function saveCart() { localStorage.setItem("csc_cart", JSON.stringify(cart)); cartCount.textContent = cart.length; }
  function variants() { return Array.isArray(product.availableColors) && product.availableColors.length ? product.availableColors : [{ colorName: "Default", imageUrl: product.img, outOfStockSizes: [] }]; }
  function renderSizes() {
    const unavailable = new Set(selectedColor?.outOfStockSizes || []);
    size.innerHTML = `<option value="">Select size</option>${(product.availableSizes || []).map((item) => `<option value="${escapeHtml(item)}" ${unavailable.has(item) ? "disabled" : ""}>${escapeHtml(item)}${unavailable.has(item) ? " — out of stock" : ""}</option>`).join("")}`;
  }
  function renderColors() {
    colors.innerHTML = variants().map((item, index) => `<button type="button" class="option${index === 0 ? " active" : ""}" data-index="${index}">${escapeHtml(item.colorName || "Default")}</button>`).join("");
    selectedColor = variants()[0];
    colors.querySelectorAll(".option").forEach((button) => button.addEventListener("click", () => {
      colors.querySelectorAll(".option").forEach((node) => node.classList.toggle("active", node === button));
      selectedColor = variants()[Number(button.dataset.index)];
      image.src = selectedColor.imageUrl || product.img;
      renderSizes();
    }));
    renderSizes();
  }

  try {
    const response = await fetch(API_BASE + "/api/products");
    const products = response.ok ? await response.json() : [];
    product = products.find((item) => String(item.id) === String(id));
  } catch (error) { product = null; }
  if (!product) {
    name.textContent = "Product not found";
    description.textContent = "This product may have been removed or the link is incomplete.";
    document.getElementById("add").disabled = true;
    return;
  }
  document.title = `${product.name} | Collection Shoe Center`;
  name.textContent = product.name;
  description.textContent = product.desc || "Quality footwear selected by Collection Shoe Center.";
  price.textContent = `Rs ${(Number(product.price) || 0).toLocaleString()}`;
  image.src = variants()[0].imageUrl || product.img || "";
  image.alt = product.name;
  cart = readCart();
  saveCart();
  renderColors();
  document.getElementById("add").addEventListener("click", () => {
    if (!size.value) { message.textContent = "Please select an available size."; return; }
    cart.push({ id: product.id, name: product.name, img: selectedColor.imageUrl || product.img, price: Number(product.price) || 0, size: size.value, color: selectedColor.colorName || "Default" });
    saveCart();
    message.textContent = "Added to cart. Continue shopping or open your cart to checkout.";
  });
});