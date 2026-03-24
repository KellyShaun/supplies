const SUPABASE_URL = "https://zlzmggylxgxhnldyrqiw.supabase.co";
const SUPABASE_KEY = "sb_publishable_NtfGopi1_Oi0zqSCACxZWA_JV5mP_2T";
const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const onPage = id => !!document.getElementById(id);

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
window.onload = async () => {
  if (onPage("statSchools"))    loadDashboard();
  if (onPage("schoolList"))     loadSchools();
  if (onPage("companyList"))    loadCompanies();
  if (onPage("itemList")) {
    await loadSchoolsIntoDropdown("itemSchool");
    loadItems();
  }
  if (onPage("schoolSelect"))   loadSchoolsIntoDropdown("schoolSelect", onSchoolChange);
  if (onPage("deliverySchool")) {
    await Promise.all([
      loadSchoolsIntoDropdown("deliverySchool"),
      loadCompaniesIntoDropdown("deliveryCompany")
    ]);
    loadDeliveries();
  }
  if (onPage("invoiceSchool")) {
    await Promise.all([
      loadSchoolsIntoDropdown("invoiceSchool"),
      loadCompaniesIntoDropdown("invoiceCompany")
    ]);
    loadInvoices();
  }
  if (onPage("paymentSchool")) {
    await loadSchoolsIntoDropdown("paymentSchool", loadInvoicesForSchool);
    loadPayments();
  }
  if (onPage("reportSchool")) {
    await Promise.all([
      loadSchoolsIntoDropdown("reportSchool", runReport),
      loadCompaniesIntoDropdown("reportCompany")
    ]);
  }
};

// ─────────────────────────────────────────────
// UNDO-DELETE
// ─────────────────────────────────────────────
const _pendingDeletes = {};
function softDelete(label, deleteFn, refreshFn) {
  const key = "del_" + Date.now();
  let cancelled = false;
  const t = document.getElementById("toast");
  if (t) {
    t.innerHTML = "<span>" + label + " deleted</span>" +
      "<button onclick="undoDelete('" + key + "')" style="margin-left:12px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);border-radius:6px;padding:3px 10px;color:#fff;cursor:pointer;font-family:Syne,sans-serif;font-size:12px;font-weight:700">Undo</button>";
    t.className = "toast success show";
  }
  _pendingDeletes[key] = setTimeout(async () => {
    if (!cancelled) { await deleteFn(); refreshFn(); }
    if (t) t.classList.remove("show");
    delete _pendingDeletes[key];
  }, 5000);
  _pendingDeletes[key + "_cancel"] = () => { cancelled = true; };
}
function undoDelete(key) {
  if (_pendingDeletes[key]) {
    clearTimeout(_pendingDeletes[key]);
    if (_pendingDeletes[key + "_cancel"]) _pendingDeletes[key + "_cancel"]();
    delete _pendingDeletes[key];
    const t = document.getElementById("toast");
    if (t) { t.textContent = "↩️ Deletion cancelled"; t.className = "toast success show"; setTimeout(() => t.classList.remove("show"), 2000); }
  }
}

// ─────────────────────────────────────────────
// SHARED DROPDOWN LOADERS
// ─────────────────────────────────────────────
async function loadSchoolsIntoDropdown(selectId, onChangeCb) {
  const { data } = await client.from("schools").select("*").order("name");
  const sel = document.getElementById(selectId);
  if (!sel || !data) return;
  sel.innerHTML = "<option value=''>— Select school —</option>" +
    data.map(s => "<option value='" + s.id + "'>" + s.name + "</option>").join("");
  if (typeof onChangeCb === "function") sel.addEventListener("change", onChangeCb);
}

async function loadCompaniesIntoDropdown(selectId, onChangeCb) {
  const { data } = await client.from("companies").select("*").order("name");
  const sel = document.getElementById(selectId);
  if (!sel || !data) return;
  sel.innerHTML = "<option value=''>— Select company —</option>" +
    data.map(c => "<option value='" + c.id + "'>" + c.name + "</option>").join("");
  if (typeof onChangeCb === "function") sel.addEventListener("change", onChangeCb);
}

// ─────────────────────────────────────────────
// COMPANIES
// ─────────────────────────────────────────────
async function addCompany() {
  const el = document.getElementById("companyName");
  const name = el ? el.value.trim() : "";
  if (!name) return showToast("Enter a company name", "error");
  const { error } = await client.from("companies").insert([{ name }]);
  if (error) return showToast("Error: " + error.message, "error");
  el.value = "";
  showToast("Company added");
  loadCompanies();
}
async function loadCompanies() {
  const { data, error } = await client.from("companies").select("*").order("name");
  if (error) return showToast("Error loading companies", "error");
  if (typeof renderCompanies === "function") renderCompanies(data || []);
}
async function deleteCompany(id) {
  softDelete("Company", async () => {
    await client.from("companies").delete().eq("id", id);
  }, loadCompanies);
}

// ─────────────────────────────────────────────
// SCHOOLS
// ─────────────────────────────────────────────
async function addSchool() {
  const el = document.getElementById("schoolName");
  const name = el ? el.value.trim() : "";
  if (!name) return showToast("Enter a school name", "error");
  const { error } = await client.from("schools").insert([{ name }]);
  if (error) return showToast("Error: " + error.message, "error");
  el.value = "";
  showToast("School added");
  loadSchools();
}
async function loadSchools() {
  const { data, error } = await client.from("schools").select("*").order("name");
  if (error) return showToast("Error loading schools", "error");
  if (typeof renderSchools === "function") renderSchools(data || []);
}
async function deleteSchool(id) {
  softDelete("School", async () => {
    await client.from("schools").delete().eq("id", id);
  }, loadSchools);
}

// ─────────────────────────────────────────────
// ITEMS  (school-scoped)
// ─────────────────────────────────────────────
async function loadSchoolsIntoItemForm() {
  const { data } = await client.from("schools").select("*").order("name");
  if (typeof renderSchoolOptions === "function") renderSchoolOptions(data || []);
}
async function addItem() {
  const schoolId = document.getElementById("itemSchool") ?.value;
  const name     = document.getElementById("itemName")   ?.value.trim();
  const category = document.getElementById("category")   ?.value;
  if (!schoolId) return showToast("Select a school", "error");
  if (!name)     return showToast("Enter an item name", "error");
  const { error } = await client.from("items").insert([{ school_id: schoolId, name, category }]);
  if (error) return showToast("Error: " + error.message, "error");
  document.getElementById("itemName").value = "";
  showToast("Item added");
  loadItems();
}
async function loadItems() {
  const { data, error } = await client.from("items").select("*, schools(name)").order("name");
  if (error) return showToast("Error loading items", "error");
  const rows = (data || []).map(i => ({ ...i, school_name: i.schools?.name || "—" }));
  rows.sort((a, b) => (a.school_name || "").localeCompare(b.school_name || "") || (a.name || "").localeCompare(b.name || ""));
  if (typeof renderItems === "function") renderItems(rows);
}
async function deleteItem(id) {
  softDelete("Item", async () => {
    await client.from("items").delete().eq("id", id);
  }, loadItems);
}

// ─────────────────────────────────────────────
// PRICING
// ─────────────────────────────────────────────
async function onSchoolChange() {
  const id = document.getElementById("schoolSelect")?.value;
  if (id && typeof loadPricingForSchool === "function") loadPricingForSchool(id);
}
async function loadPricingForSchool(schoolId) {
  if (!schoolId) return;
  const { data: items, error: iErr } = await client.from("items").select("*").eq("school_id", schoolId).order("name");
  if (iErr) return showToast("Error loading items: " + iErr.message, "error");
  if (!items || !items.length) {
    if (typeof renderPricing === "function") renderPricing([]);
    showToast("No items for this school — add in Items page first", "error");
    return;
  }
  const { data: prices } = await client.from("school_prices").select("*").eq("school_id", schoolId);
  const rows = items.map(item => {
    const ex = (prices || []).find(p => p.item_id === item.id);
    return { id: item.id, name: item.name, category: item.category, price: ex ? Number(ex.price) : 0 };
  });
  if (typeof renderPricing === "function") renderPricing(rows);
}
async function updatePrice(itemId, price) {
  const schoolId = document.getElementById("schoolSelect")?.value;
  if (!schoolId) return;
  const { error } = await client.from("school_prices").upsert(
    { school_id: schoolId, item_id: itemId, price: Number(price) },
    { onConflict: "school_id,item_id" }
  );
  if (error) showToast("Error saving price: " + error.message, "error");
}

// ─────────────────────────────────────────────
// DELIVERIES — multi-item batch
// ─────────────────────────────────────────────
async function loadItemsForDelivery(schoolId, companyId) {
  // company_id is on the delivery row — items are school-scoped
  const { data: items, error: iErr } = await client
    .from("items").select("*").eq("school_id", schoolId).order("name");
  if (iErr) { showToast("Error loading items", "error"); return; }

  const { data: prices } = await client
    .from("school_prices").select("*").eq("school_id", schoolId);

  const rows = (items || []).map(item => {
    const ex = (prices || []).find(p => p.item_id === item.id);
    return { id: item.id, name: item.name, category: item.category, price: ex ? Number(ex.price) : 0 };
  });

  if (typeof renderDeliveryItems === "function") renderDeliveryItems(rows);
}

// ── Batch save — called from deliveries.html ──────────────────
async function saveDeliveriesBatch(deliveries) {
  if (!deliveries || !deliveries.length) return;
  const { error } = await client.from("deliveries").insert(deliveries);
  if (error) { showToast("Error saving: " + error.message, "error"); return; }

  // Clear qty inputs
  document.querySelectorAll(".item-qty-row").forEach(row => {
    const inp = row.querySelector(".iqr-qty input");
    if (inp) inp.value = "";
    row.classList.remove("has-qty");
  });
  if (typeof updateBatchSummary === "function") updateBatchSummary();

  const n = deliveries.length;
  showToast(n + " deliver" + (n !== 1 ? "ies" : "y") + " saved ✅");
  loadDeliveries();
}

// saveAllDeliveries — now handled in deliveries.html via saveDeliveriesBatch()

async function loadDeliveries() {
  const { data, error } = await client
    .from("deliveries")
    .select("*, schools(name), companies(name), items(name, category)")
    .order("created_at", { ascending: false });
  if (error) return showToast("Error loading deliveries", "error");
  const rows = (data || []).map(d => ({
    id:           d.id,
    school_name:  d.schools?.name   || "—",
    company_name: d.companies?.name || "—",
    item_name:    d.items?.name     || "—",
    category:     d.items?.category || "Others",
    quantity:     d.quantity,
    unit:         d.unit || "pcs",
    price:        d.total / (d.quantity || 1),
    created_at:   d.created_at
  }));
  if (typeof renderDeliveries === "function") renderDeliveries(rows);
}
async function deleteDelivery(id) {
  softDelete("Delivery", async () => {
    await client.from("deliveries").delete().eq("id", id);
  }, loadDeliveries);
}

// ─────────────────────────────────────────────
// INVOICES — per school per company
// ─────────────────────────────────────────────
async function generateInvoice() {
  const schoolId   = document.getElementById("invoiceSchool")  ?.value;
  const companyId  = document.getElementById("invoiceCompany") ?.value;
  const startDate  = document.getElementById("startDate")      ?.value;
  const endDate    = document.getElementById("endDate")        ?.value;

  if (!schoolId)  return showToast("Select a school",  "error");
  if (!companyId) return showToast("Select a company", "error");
  if (!startDate || !endDate) return showToast("Select a date range", "error");

  const { data: deliveries, error } = await client
    .from("deliveries")
    .select("*, items(name, category)")
    .eq("school_id",  schoolId)
    .eq("company_id", companyId)
    .gte("created_at", startDate + "T00:00:00")
    .lte("created_at", endDate   + "T23:59:59");

  if (error) return showToast("Error fetching deliveries: " + error.message, "error");
  if (!deliveries || !deliveries.length) return showToast("No deliveries found for this school + company + period", "error");

  const [{ data: school }, { data: company }] = await Promise.all([
    client.from("schools").select("name").eq("id", schoolId).single(),
    client.from("companies").select("name").eq("id", companyId).single()
  ]);

  // Group by item
  const grouped = {};
  deliveries.forEach(d => {
    if (!grouped[d.item_id]) {
      grouped[d.item_id] = {
        name: d.items?.name || "—", category: d.items?.category || "Others",
        quantity: 0, unit: d.unit || "pcs",
        unit_price: Number(d.total) / (Number(d.quantity) || 1), amount: 0
      };
    }
    grouped[d.item_id].quantity  += Number(d.quantity);
    grouped[d.item_id].amount    += Number(d.total);
    grouped[d.item_id].unit_price = grouped[d.item_id].amount / grouped[d.item_id].quantity;
  });

  const items      = Object.values(grouped);
  const grandTotal = items.reduce((s, i) => s + i.amount, 0);

  if (typeof renderInvoicePreview === "function") {
    renderInvoicePreview({ school: school?.name || "—", company: company?.name || "—", startDate, endDate, items });
  }

  // Save
  const { data: invoice, error: invErr } = await client
    .from("invoices")
    .insert([{ school_id: schoolId, company_id: companyId, start_date: startDate, end_date: endDate, total: grandTotal, status: "Generated" }])
    .select().single();
  if (invErr) return showToast("Error saving invoice", "error");

  const lineItems = Object.entries(grouped).map(([itemId, item]) => ({
    invoice_id: invoice.id, item_id: itemId, quantity: item.quantity, price: item.unit_price, total: item.amount
  }));
  await client.from("invoice_items").insert(lineItems);

  showToast("Invoice generated and saved");
  loadInvoices();
}

async function loadInvoices() {
  const { data, error } = await client
    .from("invoices").select("*, schools(name), companies(name)")
    .order("created_at", { ascending: false });
  if (error) return;
  const rows = (data || []).map(inv => ({
    id:             inv.id,
    invoice_number: "INV-" + inv.id.slice(0,6).toUpperCase(),
    school_name:    inv.schools?.name   || "—",
    company_name:   inv.companies?.name || "—",
    total:          inv.total,
    paid_amount:    inv.paid_amount || 0,
    status:         inv.status,
    created_at:     inv.created_at
  }));
  if (typeof renderSavedInvoices === "function") renderSavedInvoices(rows);
}

async function updateInvoiceStatus(id, status) {
  const { error } = await client.from("invoices").update({ status }).eq("id", id);
  if (error) return showToast("Error updating status", "error");
  showToast("Invoice marked as " + status);
  loadInvoices();
}

async function deleteInvoice(id) {
  softDelete("Invoice", async () => {
    await client.from("invoice_items").delete().eq("invoice_id", id);
    await client.from("invoices").delete().eq("id", id);
  }, loadInvoices);
}

// ─────────────────────────────────────────────
// PAYMENTS
// ─────────────────────────────────────────────
async function loadInvoicesForSchool(schoolIdOrEvent) {
  const schoolId = typeof schoolIdOrEvent === "string"
    ? schoolIdOrEvent
    : document.getElementById("paymentSchool")?.value;
  if (!schoolId) return;
  const { data } = await client.from("invoices").select("*")
    .eq("school_id", schoolId).order("created_at", { ascending: false });
  const sel = document.getElementById("paymentInvoice");
  if (!sel || !data) return;
  sel.innerHTML = "<option value=''>— Select invoice —</option>" +
    data.map(inv =>
      "<option value='" + inv.id +
      "' data-balance='" + (inv.total - (inv.paid_amount||0)) +
      "' data-total='" + inv.total + "'>" +
      "INV-" + inv.id.slice(0,6).toUpperCase() + " — KES " +
      Number(inv.total).toLocaleString() + " (" + (inv.status||"Unpaid") + ")</option>"
    ).join("");
  const chip = document.getElementById("balanceChip");
  if (chip) chip.classList.remove("visible");
}

async function addPayment() {
  const schoolId  = document.getElementById("paymentSchool")  ?.value;
  const invoiceId = document.getElementById("paymentInvoice") ?.value;
  const reference = document.getElementById("chequeNumber")   ?.value.trim();
  const amount    = Number(document.getElementById("paymentAmount")?.value);
  const method    = typeof getPaymentMethod === "function" ? getPaymentMethod() : "Cheque";
  if (!schoolId || !invoiceId || !amount) return showToast("Fill all required fields", "error");
  const { error } = await client.from("payments").insert([{
    school_id: schoolId, invoice_id: invoiceId, cheque_number: reference, method, amount
  }]);
  if (error) return showToast("Error: " + error.message, "error");
  // Update invoice status
  const { data: allPmts } = await client.from("payments").select("amount").eq("invoice_id", invoiceId);
  const { data: invoice } = await client.from("invoices").select("total").eq("id", invoiceId).single();
  const totalPaid = (allPmts||[]).reduce((s,p) => s + Number(p.amount), 0);
  const status    = totalPaid >= invoice.total ? "Paid" : totalPaid > 0 ? "Partial" : "Unpaid";
  await client.from("invoices").update({ status, paid_amount: totalPaid }).eq("id", invoiceId);
  document.getElementById("paymentAmount").value = "";
  document.getElementById("chequeNumber").value  = "";
  showToast("Payment recorded");
  loadPayments();
}

async function loadPayments() {
  const { data, error } = await client.from("payments")
    .select("*, schools(name), invoices(id)").order("created_at", { ascending: false });
  if (error) return showToast("Error loading payments", "error");
  const rows = (data||[]).map(p => ({
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
    await client.from("payments").delete().eq("id", id);
  }, loadPayments);
}

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
async function loadDashboard() {
  const today = new Date().toISOString().split("T")[0];
  const [{ data: schools }, { data: todayDel }, { data: invoices }, { data: payments }, { data: unpaid }] =
    await Promise.all([
      client.from("schools")   .select("id"),
      client.from("deliveries").select("total").gte("created_at", today + "T00:00:00"),
      client.from("invoices")  .select("total, status"),
      client.from("payments")  .select("amount"),
      client.from("invoices")  .select("id, schools(name), total, paid_amount, created_at").neq("status","Paid")
    ]);
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  const fmtKES = n => "KES " + Number(n).toLocaleString("en-KE", { minimumFractionDigits:0 });
  set("statSchools",    schools?.length || 0);
  set("statDeliveries", todayDel?.length || 0);
  set("statInvoices",   (invoices||[]).filter(i => i.status !== "Paid").length);
  const totalPaid = (payments||[]).reduce((s,p) => s+Number(p.amount), 0);
  const totalInv  = (invoices||[]).reduce((s,i) => s+Number(i.total),  0);
  set("statPayments", fmtKES(totalPaid));
  const outstanding = Math.max(0, totalInv - totalPaid);
  const alertEl = document.getElementById("outstandingAlert");
  if (alertEl) {
    if (outstanding > 0) {
      alertEl.style.display = "";
      const overdue = (unpaid||[]).filter(i => (Date.now() - new Date(i.created_at)) / 86400000 > 30);
      const set2 = (id, v) => { const el=document.getElementById(id); if(el) el.textContent=v; };
      set2("alertAmount",  fmtKES(outstanding));
      set2("alertSchools", (unpaid?.length||0) + " invoice" + ((unpaid?.length||0)!==1?"s":""));
      set2("alertOverdue", overdue.length > 0 ? overdue.length + " overdue (>30 days)" : "All within 30 days");
    } else {
      alertEl.style.display = "none";
    }
  }
}

// ─────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────
async function runReport() {
  const schoolId  = document.getElementById("reportSchool") ?.value;
  const companyId = document.getElementById("reportCompany")?.value;
  const startDate = document.getElementById("reportStart")  ?.value;
  const endDate   = document.getElementById("reportEnd")    ?.value;
  if (!startDate || !endDate) return;

  let dQuery = client.from("deliveries").select("*, schools(name), companies(name), items(name,category)")
    .gte("created_at", startDate + "T00:00:00").lte("created_at", endDate + "T23:59:59");
  if (schoolId)  dQuery = dQuery.eq("school_id",  schoolId);
  if (companyId) dQuery = dQuery.eq("company_id", companyId);
  const { data: deliveries } = await dQuery;

  let iQuery = client.from("invoices").select("*, schools(name), companies(name)");
  if (schoolId)  iQuery = iQuery.eq("school_id",  schoolId);
  if (companyId) iQuery = iQuery.eq("company_id", companyId);
  const { data: invoices } = await iQuery;

  let pQuery = client.from("payments").select("*, schools(name)")
    .gte("created_at", startDate + "T00:00:00").lte("created_at", endDate + "T23:59:59");
  if (schoolId) pQuery = pQuery.eq("school_id", schoolId);
  const { data: payments } = await pQuery;

  const revenue   = (deliveries||[]).reduce((s,d) => s+Number(d.total), 0);
  const totalPaid = (payments  ||[]).reduce((s,p) => s+Number(p.amount), 0);
  const totalInv  = (invoices  ||[]).reduce((s,i) => s+Number(i.total),  0);

  const bySchool = {};
  (deliveries||[]).forEach(d => { const n=d.schools?.name||"—"; bySchool[n]=(bySchool[n]||0)+Number(d.total); });
  const deliveriesBySchool = Object.entries(bySchool).map(([name,total])=>({name,total})).sort((a,b)=>b.total-a.total);

  const byCat = {};
  (deliveries||[]).forEach(d => { const c=d.items?.category||"Others"; byCat[c]=(byCat[c]||0)+Number(d.total); });
  const deliveriesByCategory = Object.entries(byCat).map(([cat,total])=>({cat,total})).sort((a,b)=>b.total-a.total);

  const invBySchool = {};
  (invoices||[]).forEach(i => {
    const n = i.schools?.name||"—";
    if (!invBySchool[n]) invBySchool[n] = {school:n, invoiced:0, paid:0};
    invBySchool[n].invoiced += Number(i.total);
    invBySchool[n].paid     += Number(i.paid_amount||0);
  });
  const invoiceTable = Object.values(invBySchool).map(r => ({...r, outstanding:Math.max(0,r.invoiced-r.paid)}));

  const payBySchool = {};
  (payments||[]).forEach(p => {
    const n = p.schools?.name||"—";
    if (!payBySchool[n]) payBySchool[n] = {school:n, count:0, total:0};
    payBySchool[n].count++; payBySchool[n].total += Number(p.amount);
  });

  const recentDeliveries = (deliveries||[]).slice(0,20).map(d => ({
    item:         d.items?.name     || "—",
    school:       d.schools?.name   || "—",
    company:      d.companies?.name || "—",
    qty:          d.quantity,
    unit:         d.unit || "pcs",
    amount:       d.total,
    date:         d.created_at
  }));

  if (typeof renderReport === "function") {
    renderReport({
      kpis: { revenue, deliveries: (deliveries||[]).length, invoices: (invoices||[]).length, payments: totalPaid, outstanding: Math.max(0,totalInv-totalPaid) },
      deliveriesBySchool, deliveriesByCategory,
      invoiceTable, paymentTable: Object.values(payBySchool),
      recentDeliveries
    });
  }
}

// ─────────────────────────────────────────────
// CSV EXPORT
// ─────────────────────────────────────────────
function exportToCSV(rows, filename) {
  if (!rows || !rows.length) { showToast("No data to export", "error"); return; }
  const headers = Object.keys(rows[0]);
  const lines   = [headers.join(",")];
  rows.forEach(row => {
    const vals = headers.map(h => {
      const v = row[h] == null ? "" : String(row[h]);
      return v.includes(",") || v.includes('"') || v.includes("\n") ? '"' + v.replace(/"/g, '""') + '"' : v;
    });
    lines.push(vals.join(","));
  });
  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href = url; a.download = filename + "_" + new Date().toISOString().split("T")[0] + ".csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast("CSV exported");
}

async function exportDeliveriesCSV() {
  const { data } = await client.from("deliveries").select("*, schools(name), companies(name), items(name,category)").order("created_at", { ascending: false });
  exportToCSV((data||[]).map(d => ({ Date: new Date(d.created_at).toLocaleDateString(), School: d.schools?.name||"—", Company: d.companies?.name||"—", Item: d.items?.name||"—", Category: d.items?.category||"—", Quantity: d.quantity, Unit: d.unit||"pcs", Total_KES: d.total })), "deliveries");
}
async function exportInvoicesCSV() {
  const { data } = await client.from("invoices").select("*, schools(name), companies(name)").order("created_at", { ascending: false });
  exportToCSV((data||[]).map(i => ({ Date: new Date(i.created_at).toLocaleDateString(), Invoice: "INV-"+i.id.slice(0,6).toUpperCase(), School: i.schools?.name||"—", Company: i.companies?.name||"—", Total_KES: i.total, Paid_KES: i.paid_amount||0, Outstanding: Math.max(0,i.total-(i.paid_amount||0)), Status: i.status||"—" })), "invoices");
}
async function exportPaymentsCSV() {
  const { data } = await client.from("payments").select("*, schools(name)").order("created_at", { ascending: false });
  exportToCSV((data||[]).map(p => ({ Date: new Date(p.created_at).toLocaleDateString(), School: p.schools?.name||"—", Method: p.method||"—", Reference: p.cheque_number||"—", Amount_KES: p.amount })), "payments");
}

// ─────────────────────────────────────────────
// DELIVERY RECEIPT (batch)
// ─────────────────────────────────────────────
function printDeliveryReceipt(data) {
  // data can be a single delivery object OR a batch {school_name, company_name, items[], date}
  const isBatch = Array.isArray(data.items);
  const school  = data.school_name  || "—";
  const company = data.company_name || "—";
  const date    = data.date || new Date().toLocaleDateString("en-KE", {year:"numeric",month:"long",day:"numeric"});

  let rows = "", grandTotal = 0;
  if (isBatch) {
    data.items.forEach(d => {
      const t = (d.price||0) * (d.quantity||0);
      grandTotal += t;
      rows += "<tr><td><strong>"+(d.item_name||"—")+"</strong></td><td>"+(d.category||"—")+"</td><td>"+(d.quantity||0)+" "+(d.unit||"pcs")+"</td><td>KES "+Number(d.price||0).toLocaleString("en-KE",{minimumFractionDigits:2})+"</td><td>KES "+Number(t).toLocaleString("en-KE",{minimumFractionDigits:2})+"</td></tr>";
    });
  } else {
    const t = (data.price||0) * (data.quantity||0); grandTotal = t;
    rows = "<tr><td><strong>"+(data.item_name||"—")+"</strong></td><td>"+(data.category||"—")+"</td><td>"+(data.quantity||0)+" "+(data.unit||"pcs")+"</td><td>KES "+Number(data.price||0).toLocaleString("en-KE",{minimumFractionDigits:2})+"</td><td>KES "+Number(t).toLocaleString("en-KE",{minimumFractionDigits:2})+"</td></tr>";
  }

  const win = window.open("","_blank","width=600,height=700");
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Delivery Receipt</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',sans-serif;padding:32px;color:#111;max-width:520px;margin:0 auto}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #111}
  .brand{font-size:18px;font-weight:800}.brand-sub{font-size:11px;color:#666;margin-top:2px}
  .rno{text-align:right;font-size:12px;color:#666}.rno strong{display:block;font-size:15px;color:#111;font-weight:800}
  .to-block{background:#f8fafc;border-radius:10px;padding:12px 16px;margin-bottom:20px;display:grid;grid-template-columns:1fr 1fr;gap:12px}
  .to-label{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#888;margin-bottom:3px}
  .to-name{font-size:15px;font-weight:700}
  table{width:100%;border-collapse:collapse;margin-bottom:18px}
  th{text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.6px;color:#888;padding:7px 8px;border-bottom:2px solid #eee}
  td{padding:9px 8px;border-bottom:1px solid #f0f0f0;font-size:13px}
  .total-row{font-weight:800;font-size:14px}.total-row td{border-top:2px solid #111;border-bottom:none;padding-top:10px}
  .sig{margin-top:36px;display:grid;grid-template-columns:1fr 1fr;gap:24px}
  .sig-line{border-top:1px solid #ccc;padding-top:7px;font-size:11px;color:#888;text-align:center}
  .footer{margin-top:28px;text-align:center;font-size:11px;color:#aaa}@media print{body{padding:16px}}</style>
  </head><body>
  <div class="hdr">
    <div><div class="brand">📊 System</div><div class="brand-sub">Delivery Receipt</div></div>
    <div class="rno"><strong>RCP-${String(Date.now()).slice(-6)}</strong>${date}</div>
  </div>
  <div class="to-block">
    <div><div class="to-label">Delivered To</div><div class="to-name">🏫 ${school}</div></div>
    <div><div class="to-label">Company</div><div class="to-name">🏢 ${company}</div></div>
  </div>
  <table>
    <thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody>
    <tfoot><tr class="total-row"><td colspan="4">Total</td><td>KES ${Number(grandTotal).toLocaleString("en-KE",{minimumFractionDigits:2})}</td></tr></tfoot>
  </table>
  <div class="sig">
    <div class="sig-line">Delivered by (Signature)</div>
    <div class="sig-line">Received by (Signature)</div>
  </div>
  <div class="footer">Generated by System · ${new Date().toLocaleString()}</div>
  </body></html>`);
  win.document.close();
  setTimeout(() => win.print(), 400);
}

// ─────────────────────────────────────────────
// PRINT INVOICE
// ─────────────────────────────────────────────
function printInvoice() { window.print(); }

// ─────────────────────────────────────────────
// LOGOUT
// ─────────────────────────────────────────────
function logout() {
  if (confirm("Log out?")) {
    try { client.auth.signOut(); } catch(e) {}
    window.location.href = "index.html";
  }
}

// ─────────────────────────────────────────────
// TOAST fallback
// ─────────────────────────────────────────────
if (typeof showToast === "undefined") {
  window.showToast = function(msg, type) {
    type = type || "success";
    var t = document.getElementById("toast");
    if (!t) return;
    t.textContent = (type === "success" ? "✅ " : "❌ ") + msg;
    t.className = "toast " + type + " show";
    setTimeout(function() { t.classList.remove("show"); }, 3000);
  };
}
