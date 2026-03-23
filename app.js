const SUPABASE_URL = "https://zlzmggylxgxhnldyrqiw.supabase.co";
const SUPABASE_KEY = "sb_publishable_NtfGopi1_Oi0zqSCACxZWA_JV5mP_2T";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ─────────────────────────────────────────────
// HELPER: detect current page
// ─────────────────────────────────────────────
const onPage = id => !!document.getElementById(id);


// ─────────────────────────────────────────────
// UNDO-DELETE SYSTEM
// ─────────────────────────────────────────────
// Each delete is deferred 5 seconds — user can cancel via toast button
const _pendingDeletes = {};

function softDelete(label, deleteFn, refreshFn) {
  const key = 'del_' + Date.now();
  let cancelled = false;

  // Show undo toast
  const t = document.getElementById('toast');
  if (t) {
    t.innerHTML =
      '<span>' + label + ' deleted</span>' +
      '<button onclick="undoDelete(\'' + key + '\')" style="' +
        'margin-left:12px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);' +
        'border-radius:6px;padding:3px 10px;color:#fff;cursor:pointer;font-family:Syne,sans-serif;' +
        'font-size:12px;font-weight:700">Undo</button>';
    t.className = 'toast success show';
  }

  // Schedule actual delete after 5s
  _pendingDeletes[key] = setTimeout(async () => {
    if (!cancelled) {
      await deleteFn();
      refreshFn();
    }
    if (t) t.classList.remove('show');
    delete _pendingDeletes[key];
  }, 5000);

  // Store cancel flag reference
  _pendingDeletes[key + '_cancel'] = () => { cancelled = true; };
}

function undoDelete(key) {
  if (_pendingDeletes[key]) {
    clearTimeout(_pendingDeletes[key]);
    if (_pendingDeletes[key + '_cancel']) _pendingDeletes[key + '_cancel']();
    delete _pendingDeletes[key];
    const t = document.getElementById('toast');
    if (t) {
      t.textContent = '↩️ Deletion cancelled';
      t.className = 'toast success show';
      setTimeout(() => t.classList.remove('show'), 2000);
    }
  }
}

// ─────────────────────────────────────────────
// INIT — single window.onload
// ─────────────────────────────────────────────
window.onload = async () => {

  // Dashboard
  if (onPage("statSchools"))    loadDashboard();

  // Schools page
  if (onPage("schoolList"))     loadSchools();

  // Items page — load schools into the "Add Item" dropdown + load items list
  if (onPage("itemList")) {
    await loadSchoolsIntoItemForm();
    loadItems();
  }

  // Pricing page
  if (onPage("schoolSelect"))   loadSchoolsIntoDropdown("schoolSelect", onSchoolChange);

  // Deliveries page
  if (onPage("deliverySchool")) {
    await loadSchoolsIntoDropdown("deliverySchool");
    await loadAllItemsForDelivery();
    loadDeliveries();
  }

  // Invoices page
  if (onPage("invoiceSchool")) {
    await loadSchoolsIntoDropdown("invoiceSchool");
    loadInvoices();
  }

  // Payments page
  if (onPage("paymentSchool")) {
    await loadSchoolsIntoDropdown("paymentSchool", loadInvoicesForSchool);
    loadPayments();
  }

  // Reports page
  if (onPage("reportSchool")) {
    await loadSchoolsIntoDropdown("reportSchool", runReport);
  }
};

// ─────────────────────────────────────────────
// SHARED: load schools into any <select>
// ─────────────────────────────────────────────
async function loadSchoolsIntoDropdown(selectId, onChangeCallback) {
  const { data, error } = await client.from("schools").select("*").order("name");
  if (error) { console.error("loadSchoolsIntoDropdown:", error); return; }

  const sel = document.getElementById(selectId);
  if (!sel) return;

  sel.innerHTML = "<option value=''>— Select school —</option>";
  data.forEach(s => {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name;
    sel.appendChild(opt);
  });

  if (typeof onChangeCallback === "function") {
    sel.addEventListener("change", onChangeCallback);
  }
}

// ─────────────────────────────────────────────
// SCHOOLS
// ─────────────────────────────────────────────
async function addSchool() {
  const nameEl = document.getElementById("schoolName");
  const name = nameEl.value.trim();
  if (!name) return showToast("Enter a school name", "error");

  const { error } = await client.from("schools").insert([{ name }]);
  if (error) return showToast("Error adding school: " + error.message, "error");

  nameEl.value = "";
  showToast("School added");
  loadSchools();
}

async function loadSchools() {
  const { data, error } = await client.from("schools").select("*").order("name");
  if (error) return showToast("Error loading schools", "error");

  // For the schools.html list UI
  if (typeof renderSchools === "function") {
    renderSchools(data);
  }
}

async function deleteSchool(id) {
  softDelete("School", async () => {
    const { error } = await client.from("schools").delete().eq("id", id);
    if (error) showToast("Error deleting school", "error");
  }, loadSchools);
}

// ─────────────────────────────────────────────
// ITEMS  (school-scoped)
// ─────────────────────────────────────────────

// Load schools into the "Add Item" form dropdown on items.html
async function loadSchoolsIntoItemForm() {
  const { data, error } = await client.from("schools").select("*").order("name");
  if (error) { console.error("loadSchoolsIntoItemForm:", error); return; }

  // renderSchoolOptions() is defined in items.html
  if (typeof renderSchoolOptions === "function") {
    renderSchoolOptions(data);
  }

  // Also populate the school filter dropdown in the list
  const sf = document.getElementById("schoolFilter");
  if (sf) {
    // options will be rebuilt by renderItems() once data loads
  }
}

async function addItem() {
  const schoolId  = document.getElementById("itemSchool").value;
  const name      = document.getElementById("itemName").value.trim();
  const category  = document.getElementById("category").value;

  if (!schoolId) return showToast("Select a school first", "error");
  if (!name)     return showToast("Enter an item name", "error");

  const { error } = await client.from("items").insert([{ school_id: schoolId, name, category }]);
  if (error) return showToast("Error adding item: " + error.message, "error");

  document.getElementById("itemName").value = "";
  showToast("Item added");
  loadItems();
}

async function loadItems() {
  // Join with schools so we get school_name for display
  // Order by school name first, then item name — so groups stay together
  const { data, error } = await client
    .from("items")
    .select("*, schools(name)")
    .order("name");

  if (error) return showToast("Error loading items", "error");

  // Flatten school name onto each row
  const rows = data.map(i => ({
    ...i,
    school_name: i.schools?.name || "—"
  }));

  // Sort by school name, then item name within each school
  rows.sort((a, b) => {
    const schoolCmp = (a.school_name || "").localeCompare(b.school_name || "");
    if (schoolCmp !== 0) return schoolCmp;
    return (a.name || "").localeCompare(b.name || "");
  });

  if (typeof renderItems === "function") renderItems(rows);
}

async function deleteItem(id) {
  softDelete("Item", async () => {
    const { error } = await client.from("items").delete().eq("id", id);
    if (error) showToast("Error deleting item", "error");
  }, loadItems);
}

// ─────────────────────────────────────────────
// PRICING
// ─────────────────────────────────────────────

// Called when school selector changes on pricing.html
async function onSchoolChange() {
  const schoolId = document.getElementById("schoolSelect")?.value;
  if (!schoolId) return;
  loadPricingForSchool(schoolId);
}

async function loadPricingForSchool(schoolId) {
  if (!schoolId) return;

  // Fetch items that belong to this school
  const { data: items, error: iErr } = await client
    .from("items")
    .select("*")
    .eq("school_id", schoolId)
    .order("name");

  if (iErr) {
    console.error("loadPricingForSchool items error:", iErr);
    showToast("Error loading items: " + iErr.message, "error");
    return;
  }

  // No items yet for this school
  if (!items || items.length === 0) {
    if (typeof renderPricing === "function") renderPricing([]);
    showToast("No items found for this school — add items in the Items page first.", "error");
    return;
  }

  // Fetch existing prices for this school
  const { data: prices, error: pErr } = await client
    .from("school_prices")
    .select("*")
    .eq("school_id", schoolId);

  if (pErr) {
    console.error("loadPricingForSchool prices error:", pErr);
    showToast("Error loading prices: " + pErr.message, "error");
    return;
  }

  // Merge: attach existing price to each item (default 0)
  const rows = items.map(item => {
    const existing = (prices || []).find(p => p.item_id === item.id);
    return {
      id:       item.id,
      name:     item.name,
      category: item.category,
      price:    existing ? Number(existing.price) : 0
    };
  });

  // renderPricing() is defined in pricing.html
  if (typeof renderPricing === "function") renderPricing(rows);
}

async function updatePrice(itemId, price) {
  const schoolId = document.getElementById("schoolSelect")?.value;
  if (!schoolId) return;

  const { error } = await client
    .from("school_prices")
    .upsert({ school_id: schoolId, item_id: itemId, price: Number(price) },
            { onConflict: "school_id,item_id" });

  if (error) showToast("Error saving price: " + error.message, "error");
}

// ─────────────────────────────────────────────
// DELIVERIES
// ─────────────────────────────────────────────
let _allItemsForDelivery = [];

async function loadAllItemsForDelivery() {
  const { data, error } = await client
    .from("items")
    .select("*, schools(name)")
    .order("name");
  if (error) return;
  _allItemsForDelivery = data;
}

// Filters items by the selected school AND category
function filterItemsByCategory() {
  const schoolId = document.getElementById("deliverySchool")?.value;
  const category = document.getElementById("deliveryCategory")?.value;
  const itemSel  = document.getElementById("deliveryItem");
  if (!itemSel) return;

  itemSel.innerHTML = "<option value=''>— Select item —</option>";

  let filtered = _allItemsForDelivery;
  if (schoolId) filtered = filtered.filter(i => i.school_id === schoolId);
  if (category) filtered = filtered.filter(i => i.category === category);

  filtered.forEach(item => {
    const opt = document.createElement("option");
    opt.value = item.id;
    opt.textContent = item.name;
    itemSel.appendChild(opt);
  });

  // Reset item preview
  const prev = document.getElementById("itemPreview");
  if (prev) prev.classList.remove("visible");
}

async function addDelivery() {
  const schoolId = document.getElementById("deliverySchool")?.value;
  const itemId   = document.getElementById("deliveryItem")?.value;
  const quantity = Number(document.getElementById("quantity")?.value);
  const unit     = typeof getSelectedUnit === "function" ? getSelectedUnit() : "pcs";

  if (!schoolId || !itemId || !quantity) {
    return showToast("Fill all fields", "error");
  }

  // Look up the price for this school + item
  const { data: priceData, error: pErr } = await client
    .from("school_prices")
    .select("price")
    .eq("school_id", schoolId)
    .eq("item_id", itemId)
    .single();

  if (pErr || !priceData) {
    return showToast("Price not set for this item at this school. Set it in Pricing first.", "error");
  }

  const total = quantity * priceData.price;

  const { error } = await client.from("deliveries").insert([{
    school_id: schoolId,
    item_id:   itemId,
    quantity,
    unit,
    total
  }]);

  if (error) return showToast("Error saving delivery: " + error.message, "error");

  document.getElementById("quantity").value = "";
  const prev = document.getElementById("itemPreview");
  if (prev) prev.classList.remove("visible");

  showToast("Delivery recorded");
  loadDeliveries();
}

async function loadDeliveries() {
  const { data, error } = await client
    .from("deliveries")
    .select("*, schools(name), items(name, category)")
    .order("created_at", { ascending: false });

  if (error) return showToast("Error loading deliveries", "error");

  const rows = data.map(d => ({
    id:          d.id,
    school_name: d.schools?.name || "—",
    item_name:   d.items?.name   || "—",
    category:    d.items?.category || "Others",
    quantity:    d.quantity,
    unit:        d.unit || "pcs",
    price:       d.total / (d.quantity || 1),
    created_at:  d.created_at
  }));

  if (typeof renderDeliveries === "function") renderDeliveries(rows);
}

async function deleteDelivery(id) {
  softDelete("Delivery", async () => {
    const { error } = await client.from("deliveries").delete().eq("id", id);
    if (error) showToast("Error deleting delivery", "error");
  }, loadDeliveries);
}

// ─────────────────────────────────────────────
// INVOICES
// ─────────────────────────────────────────────
async function generateInvoice() {
  const schoolId  = document.getElementById("invoiceSchool")?.value;
  const startDate = document.getElementById("startDate")?.value;
  const endDate   = document.getElementById("endDate")?.value;

  if (!schoolId || !startDate || !endDate) {
    return showToast("Select school and date range", "error");
  }

  // Fetch deliveries in range — no join to school_prices needed,
  // unit_price is derived from total/quantity already stored on each row
  const { data: deliveries, error } = await client
    .from("deliveries")
    .select("*, items(name, category)")
    .eq("school_id", schoolId)
    .gte("created_at", startDate + "T00:00:00")
    .lte("created_at", endDate   + "T23:59:59");

  if (error) return showToast("Error fetching deliveries: " + error.message, "error");
  if (!deliveries || !deliveries.length) return showToast("No deliveries found for this period", "error");

  // Get school name
  const { data: school } = await client
    .from("schools").select("name").eq("id", schoolId).single();

  // Group by item, accumulating quantity and total amount
  const grouped = {};
  deliveries.forEach(d => {
    if (!grouped[d.item_id]) {
      grouped[d.item_id] = {
        name:       d.items?.name     || "—",
        category:   d.items?.category || "Others",
        quantity:   0,
        unit_price: Number(d.total) / (Number(d.quantity) || 1),
        unit:       d.unit || "pcs",
        amount:     0
      };
    }
    grouped[d.item_id].quantity += Number(d.quantity);
    grouped[d.item_id].amount  += Number(d.total);
    // Recalculate unit_price from accumulated totals
    grouped[d.item_id].unit_price =
      grouped[d.item_id].amount / grouped[d.item_id].quantity;
  });

  const items = Object.values(grouped);
  const grandTotal = items.reduce((s, i) => s + i.amount, 0);

  // Render preview
  if (typeof renderInvoicePreview === "function") {
    renderInvoicePreview({
      school:    school?.name || "—",
      startDate,
      endDate,
      items
    });
  }

  // Save invoice
  const { data: invoice, error: invErr } = await client
    .from("invoices")
    .insert([{ school_id: schoolId, start_date: startDate, end_date: endDate, total: grandTotal, status: "Generated" }])
    .select().single();

  if (invErr) return showToast("Error saving invoice", "error");

  // Save invoice line items
  const lineItems = Object.entries(grouped).map(([itemId, item]) => ({
    invoice_id: invoice.id,
    item_id:    itemId,
    quantity:   item.quantity,
    price:      item.unit_price,
    total:      item.amount
  }));

  await client.from("invoice_items").insert(lineItems);

  showToast("Invoice generated and saved");
  loadInvoices();
}

async function loadInvoices() {
  const { data, error } = await client
    .from("invoices")
    .select("*, schools(name)")
    .order("created_at", { ascending: false });

  if (error) return;

  const rows = data.map(inv => ({
    id:             inv.id,
    invoice_number: "INV-" + inv.id.slice(0, 6).toUpperCase(),
    school_name:    inv.schools?.name || "—",
    total:          inv.total,
    status:         inv.status,
    created_at:     inv.created_at
  }));

  if (typeof renderSavedInvoices === "function") renderSavedInvoices(rows);
}

async function deleteInvoice(id) {
  softDelete("Invoice", async () => {
    await client.from("invoice_items").delete().eq("invoice_id", id);
    const { error } = await client.from("invoices").delete().eq("id", id);
    if (error) showToast("Error deleting invoice", "error");
  }, loadInvoices);
}

// ─────────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────────
async function loadInvoicesForSchool(schoolIdOrEvent) {
  // Accept either a school ID string or a change event
  const schoolId = typeof schoolIdOrEvent === "string"
    ? schoolIdOrEvent
    : document.getElementById("paymentSchool")?.value;

  if (!schoolId) return;

  const { data, error } = await client
    .from("invoices")
    .select("*")
    .eq("school_id", schoolId)
    .order("created_at", { ascending: false });

  if (error) return showToast("Error loading invoices", "error");

  const sel = document.getElementById("paymentInvoice");
  if (!sel) return;

  sel.innerHTML = "<option value=''>— Select invoice —</option>";
  data.forEach(inv => {
    const opt = document.createElement("option");
    opt.value = inv.id;
    opt.textContent = "INV-" + inv.id.slice(0,6).toUpperCase() + " — KES " + Number(inv.total).toLocaleString() + " (" + (inv.status || "Unpaid") + ")";
    opt.dataset.balance = inv.total - (inv.paid_amount || 0);
    opt.dataset.total   = inv.total;
    sel.appendChild(opt);
  });

  // Reset balance chip
  const chip = document.getElementById("balanceChip");
  if (chip) chip.classList.remove("visible");
}

async function addPayment() {
  const schoolId  = document.getElementById("paymentSchool")?.value;
  const invoiceId = document.getElementById("paymentInvoice")?.value;
  const reference = document.getElementById("chequeNumber")?.value.trim();
  const amount    = Number(document.getElementById("paymentAmount")?.value);
  const method    = typeof getPaymentMethod === "function" ? getPaymentMethod() : "Cheque";

  if (!schoolId || !invoiceId || !amount) {
    return showToast("Fill all required fields", "error");
  }

  const { error } = await client.from("payments").insert([{
    school_id:    schoolId,
    invoice_id:   invoiceId,
    cheque_number: reference,
    method,
    amount
  }]);

  if (error) return showToast("Error recording payment: " + error.message, "error");

  // Recalculate invoice status
  const { data: allPmts } = await client
    .from("payments").select("amount").eq("invoice_id", invoiceId);
  const { data: invoice } = await client
    .from("invoices").select("total").eq("id", invoiceId).single();

  const totalPaid = allPmts.reduce((s, p) => s + Number(p.amount), 0);
  const status = totalPaid >= invoice.total ? "Paid" : totalPaid > 0 ? "Partial" : "Unpaid";

  await client.from("invoices").update({ status, paid_amount: totalPaid }).eq("id", invoiceId);

  document.getElementById("paymentAmount").value = "";
  document.getElementById("chequeNumber").value  = "";

  showToast("Payment recorded");
  loadPayments();
}

async function loadPayments() {
  const { data, error } = await client
    .from("payments")
    .select("*, schools(name), invoices(id)")
    .order("created_at", { ascending: false });

  if (error) return showToast("Error loading payments", "error");

  const rows = data.map(p => ({
    id:             p.id,
    school_name:    p.schools?.name || "—",
    invoice_number: p.invoices ? "INV-" + p.invoices.id.slice(0,6).toUpperCase() : "—",
    method:         p.method || "Cheque",
    reference:      p.cheque_number || "",
    amount:         p.amount,
    created_at:     p.created_at
  }));

  if (typeof renderPayments === "function") renderPayments(rows);
}

async function deletePayment(id) {
  softDelete("Payment", async () => {
    const { error } = await client.from("payments").delete().eq("id", id);
    if (error) showToast("Error deleting payment", "error");
  }, loadPayments);
}

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
async function loadDashboard() {
  const today = new Date().toISOString().split("T")[0];

  const [
    { data: schools },
    { data: allDeliveries },
    { data: todayDeliveries },
    { data: invoices },
    { data: payments },
    { data: unpaidInvoices }
  ] = await Promise.all([
    client.from("schools").select("id"),
    client.from("deliveries").select("total"),
    client.from("deliveries").select("total").gte("created_at", today + "T00:00:00"),
    client.from("invoices").select("total, status"),
    client.from("payments").select("amount"),
    client.from("invoices").select("id, schools(name), total, paid_amount, created_at")
      .neq("status", "Paid")
  ]);

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const fmtKES = n => "KES " + Number(n).toLocaleString("en-KE", { minimumFractionDigits: 0 });

  // Stat cards
  set("statSchools",    schools?.length || 0);
  set("statDeliveries", todayDeliveries?.length || 0);
  set("statDeliveriesLabel", "Today's Deliveries");

  const totalPaid   = payments?.reduce((s,p) => s + Number(p.amount), 0) || 0;
  const totalInv    = invoices?.reduce((s,i) => s + Number(i.total), 0) || 0;
  const outstanding = Math.max(0, totalInv - totalPaid);

  set("statInvoices",  (invoices?.filter(i => i.status !== "Paid").length) || 0);
  set("statPayments",  fmtKES(totalPaid));

  // Outstanding alert
  const alertEl = document.getElementById("outstandingAlert");
  if (alertEl) {
    if (outstanding > 0) {
      const overdueList = (unpaidInvoices || [])
        .filter(i => {
          const days = (Date.now() - new Date(i.created_at)) / 86400000;
          return days > 30;
        });

      alertEl.style.display = "";
      const amtEl  = document.getElementById("alertAmount");
      const cntEl  = document.getElementById("alertSchools");
      const ovrEl  = document.getElementById("alertOverdue");
      if (amtEl)  amtEl.textContent  = fmtKES(outstanding);
      if (cntEl)  cntEl.textContent  = (unpaidInvoices?.length || 0) + " invoice" + (unpaidInvoices?.length !== 1 ? "s" : "");
      if (ovrEl)  ovrEl.textContent  = overdueList.length > 0
        ? overdueList.length + " overdue (>30 days)"
        : "All within 30 days";
    } else {
      alertEl.style.display = "none";
    }
  }
}

// ─────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────
async function runReport() {
  const schoolId  = document.getElementById("reportSchool")?.value;
  const startDate = document.getElementById("reportStart")?.value;
  const endDate   = document.getElementById("reportEnd")?.value;

  if (!startDate || !endDate) return;

  // Deliveries
  let dQuery = client.from("deliveries").select("*, schools(name), items(name,category)")
    .gte("created_at", startDate + "T00:00:00")
    .lte("created_at", endDate   + "T23:59:59");
  if (schoolId) dQuery = dQuery.eq("school_id", schoolId);
  const { data: deliveries } = await dQuery;

  // Invoices
  let iQuery = client.from("invoices").select("*, schools(name)");
  if (schoolId) iQuery = iQuery.eq("school_id", schoolId);
  const { data: invoices } = await iQuery;

  // Payments
  let pQuery = client.from("payments").select("*, schools(name)")
    .gte("created_at", startDate + "T00:00:00")
    .lte("created_at", endDate   + "T23:59:59");
  if (schoolId) pQuery = pQuery.eq("school_id", schoolId);
  const { data: payments } = await pQuery;

  // KPIs
  const revenue     = deliveries?.reduce((s,d)=>s+Number(d.total),0) || 0;
  const totalPaid   = payments?.reduce((s,p)=>s+Number(p.amount),0) || 0;
  const totalInv    = invoices?.reduce((s,i)=>s+Number(i.total),0) || 0;
  const outstanding = totalInv - totalPaid;

  // Deliveries by school
  const bySchool = {};
  deliveries?.forEach(d => {
    const n = d.schools?.name || "—";
    bySchool[n] = (bySchool[n] || 0) + Number(d.total);
  });
  const deliveriesBySchool = Object.entries(bySchool)
    .map(([name,total]) => ({name,total}))
    .sort((a,b) => b.total - a.total);

  // Deliveries by category
  const byCat = {};
  deliveries?.forEach(d => {
    const c = d.items?.category || "Others";
    byCat[c] = (byCat[c] || 0) + Number(d.total);
  });
  const deliveriesByCategory = Object.entries(byCat)
    .map(([cat,total]) => ({cat,total}))
    .sort((a,b) => b.total - a.total);

  // Invoice table (per school)
  const invBySchool = {};
  invoices?.forEach(i => {
    const n = i.schools?.name || "—";
    if (!invBySchool[n]) invBySchool[n] = {school:n, invoiced:0, paid:0};
    invBySchool[n].invoiced += Number(i.total);
    invBySchool[n].paid     += Number(i.paid_amount || 0);
  });
  const invoiceTable = Object.values(invBySchool).map(r => ({
    ...r,
    outstanding: Math.max(0, r.invoiced - r.paid)
  }));

  // Payment table (per school)
  const payBySchool = {};
  payments?.forEach(p => {
    const n = p.schools?.name || "—";
    if (!payBySchool[n]) payBySchool[n] = {school:n, count:0, total:0};
    payBySchool[n].count++;
    payBySchool[n].total += Number(p.amount);
  });
  const paymentTable = Object.values(payBySchool);

  // Recent deliveries
  const recentDeliveries = (deliveries || []).slice(0,20).map(d => ({
    item:   d.items?.name || "—",
    school: d.schools?.name || "—",
    qty:    d.quantity,
    unit:   d.unit || "pcs",
    amount: d.total,
    date:   d.created_at
  }));

  if (typeof renderReport === "function") {
    renderReport({
      kpis: { revenue, deliveries: deliveries?.length||0, invoices: invoices?.length||0, payments: totalPaid, outstanding },
      deliveriesBySchool,
      deliveriesByCategory,
      invoiceTable,
      paymentTable,
      recentDeliveries
    });
  }
}


// ─────────────────────────────────────────────
// DELIVERY RECEIPT
// ─────────────────────────────────────────────
function printDeliveryReceipt(delivery) {
  // delivery: { school_name, item_name, category, quantity, unit, price, created_at }
  const date = delivery.created_at
    ? new Date(delivery.created_at).toLocaleDateString("en-KE", { year:"numeric", month:"long", day:"numeric" })
    : new Date().toLocaleDateString("en-KE", { year:"numeric", month:"long", day:"numeric" });
  const time = delivery.created_at
    ? new Date(delivery.created_at).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })
    : "";
  const unitPrice = delivery.price || 0;
  const total = unitPrice * delivery.quantity;

  const win = window.open("", "_blank", "width=600,height=700");
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8">
  <title>Delivery Receipt</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{font-family:'Segoe UI',sans-serif;padding:36px;color:#111;max-width:520px;margin:0 auto}
    .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:18px;border-bottom:2px solid #111}
    .brand{font-size:20px;font-weight:800;letter-spacing:-.5px}
    .brand-sub{font-size:11px;color:#666;margin-top:2px}
    .receipt-no{text-align:right;font-size:12px;color:#666}
    .receipt-no strong{display:block;font-size:16px;color:#111;font-weight:800}
    .school-block{background:#f8fafc;border-radius:10px;padding:14px 16px;margin-bottom:22px}
    .school-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#888;margin-bottom:4px}
    .school-name{font-size:17px;font-weight:700}
    table{width:100%;border-collapse:collapse;margin-bottom:20px}
    th{text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#888;padding:7px 10px;border-bottom:2px solid #eee}
    td{padding:10px 10px;border-bottom:1px solid #f0f0f0;font-size:14px}
    .total-row{font-weight:800;font-size:15px}
    .total-row td{border-top:2px solid #111;border-bottom:none;padding-top:12px}
    .sig-block{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:24px}
    .sig-line{border-top:1px solid #ccc;padding-top:8px;font-size:11px;color:#888;text-align:center}
    .footer{margin-top:32px;text-align:center;font-size:11px;color:#aaa}
    @media print{body{padding:20px}}
  </style>
  </head><body>
  <div class="hdr">
    <div><div class="brand">📊 System</div><div class="brand-sub">Delivery Receipt</div></div>
    <div class="receipt-no">
      <strong>RCP-${String(Date.now()).slice(-6)}</strong>
      ${date}${time ? " · " + time : ""}
    </div>
  </div>
  <div class="school-block">
    <div class="school-label">Delivered To</div>
    <div class="school-name">🏫 ${delivery.school_name || "—"}</div>
  </div>
  <table>
    <thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
    <tbody>
      <tr>
        <td><strong>${delivery.item_name || "—"}</strong></td>
        <td>${delivery.category || "—"}</td>
        <td>${delivery.quantity} ${delivery.unit || "pcs"}</td>
        <td>KES ${Number(unitPrice).toLocaleString("en-KE",{minimumFractionDigits:2})}</td>
        <td>KES ${Number(total).toLocaleString("en-KE",{minimumFractionDigits:2})}</td>
      </tr>
    </tbody>
    <tfoot>
      <tr class="total-row">
        <td colspan="4">Total</td>
        <td>KES ${Number(total).toLocaleString("en-KE",{minimumFractionDigits:2})}</td>
      </tr>
    </tfoot>
  </table>
  <div class="sig-block">
    <div class="sig-line">Delivered by (Signature)</div>
    <div class="sig-line">Received by (Signature)</div>
  </div>
  <div class="footer">Generated by System · ${new Date().toLocaleString()}</div>
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}


// ─────────────────────────────────────────────
// INVOICE STATUS UPDATE
// ─────────────────────────────────────────────
async function updateInvoiceStatus(id, status) {
  const { error } = await client.from("invoices").update({ status }).eq("id", id);
  if (error) return showToast("Error updating status", "error");
  showToast("Invoice marked as " + status);
  loadInvoices();
}


// ─────────────────────────────────────────────
// CSV EXPORT
// ─────────────────────────────────────────────
function exportToCSV(rows, filename) {
  if (!rows || !rows.length) {
    showToast("No data to export", "error");
    return;
  }
  const headers = Object.keys(rows[0]);
  const lines   = [headers.join(",")];
  rows.forEach(row => {
    const vals = headers.map(h => {
      const v = row[h] == null ? "" : String(row[h]);
      // Wrap in quotes if contains comma, quote or newline
      return v.includes(",") || v.includes('"') || v.includes("\n")
        ? '"' + v.replace(/"/g, '""') + '"'
        : v;
    });
    lines.push(vals.join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = filename + "_" + new Date().toISOString().split("T")[0] + ".csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast("CSV exported");
}

// Convenience wrappers called from report buttons
async function exportDeliveriesCSV() {
  const { data } = await client.from("deliveries")
    .select("*, schools(name), items(name, category)")
    .order("created_at", { ascending: false });
  if (!data) return;
  const rows = data.map(d => ({
    Date:        d.created_at ? new Date(d.created_at).toLocaleDateString() : "—",
    School:      d.schools?.name    || "—",
    Item:        d.items?.name      || "—",
    Category:    d.items?.category  || "—",
    Quantity:    d.quantity,
    Unit:        d.unit || "pcs",
    Total_KES:   d.total
  }));
  exportToCSV(rows, "deliveries");
}

async function exportInvoicesCSV() {
  const { data } = await client.from("invoices")
    .select("*, schools(name)")
    .order("created_at", { ascending: false });
  if (!data) return;
  const rows = data.map(i => ({
    Date:        i.created_at ? new Date(i.created_at).toLocaleDateString() : "—",
    Invoice_No:  "INV-" + i.id.slice(0,6).toUpperCase(),
    School:      i.schools?.name || "—",
    Total_KES:   i.total,
    Paid_KES:    i.paid_amount || 0,
    Outstanding: Math.max(0, i.total - (i.paid_amount || 0)),
    Status:      i.status || "—"
  }));
  exportToCSV(rows, "invoices");
}

async function exportPaymentsCSV() {
  const { data } = await client.from("payments")
    .select("*, schools(name)")
    .order("created_at", { ascending: false });
  if (!data) return;
  const rows = data.map(p => ({
    Date:        p.created_at ? new Date(p.created_at).toLocaleDateString() : "—",
    School:      p.schools?.name || "—",
    Method:      p.method || "—",
    Reference:   p.cheque_number || "—",
    Amount_KES:  p.amount
  }));
  exportToCSV(rows, "payments");
}


// ─────────────────────────────────────────────
// PERSIST DELIVERY DATE FILTER
// ─────────────────────────────────────────────
function saveDeliveryRange(range) {
  try { localStorage.setItem("deliveryRange", range); } catch(e) {}
}

function getSavedDeliveryRange() {
  try { return localStorage.getItem("deliveryRange") || "today"; } catch(e) { return "today"; }
}

// ─────────────────────────────────────────────
// PRINT INVOICE
// ─────────────────────────────────────────────
function printInvoice() {
  window.print();
}

// ─────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────
function logout() {
  if (confirm("Log out?")) {
    client.auth.signOut();
    window.location.href = "index.html";
  }
}

// ─────────────────────────────────────────────
// TOAST (fallback if page doesn't define it)
// ─────────────────────────────────────────────
if (typeof showToast === "undefined") {
  window.showToast = function(msg, type = "success") {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = (type === "success" ? "✅ " : "❌ ") + msg;
    t.className = "toast " + type + " show";
    setTimeout(() => t.classList.remove("show"), 3000);
  };
}