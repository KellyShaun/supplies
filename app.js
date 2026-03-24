const SUPABASE_URL = "https://zlzmggylxgxhnldyrqiw.supabase.co";
const SUPABASE_KEY = "sb_publishable_NtfGopi1_Oi0zqSCACxZWA_JV5mP_2T";

const client = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const onPage = id => !!document.getElementById(id);

// ─────────────────────────────────────────────
// UNDO-DELETE SYSTEM
// ─────────────────────────────────────────────
const _pendingDeletes = {};

function softDelete(label, deleteFn, refreshFn) {
  const key = 'del_' + Date.now();
  let cancelled = false;
  const t = document.getElementById('toast');
  if (t) {
    t.innerHTML = '<span>' + label + ' deleted</span>' +
      '<button onclick="undoDelete(\'' + key + '\')" style="margin-left:12px;background:rgba(255,255,255,0.12);border:1px solid rgba(255,255,255,0.2);border-radius:6px;padding:3px 10px;color:#fff;cursor:pointer;font-family:Syne,sans-serif;font-size:12px;font-weight:700">Undo</button>';
    t.className = 'toast success show';
  }
  _pendingDeletes[key] = setTimeout(async () => {
    if (!cancelled) { await deleteFn(); refreshFn(); }
    if (t) t.classList.remove('show');
    delete _pendingDeletes[key];
  }, 5000);
  _pendingDeletes[key + '_cancel'] = () => { cancelled = true; };
}

function undoDelete(key) {
  if (_pendingDeletes[key]) {
    clearTimeout(_pendingDeletes[key]);
    if (_pendingDeletes[key + '_cancel']) _pendingDeletes[key + '_cancel']();
    delete _pendingDeletes[key];
    const t = document.getElementById('toast');
    if (t) {
      t.textContent = '\u21a9\ufe0f Deletion cancelled';
      t.className = 'toast success show';
      setTimeout(() => t.classList.remove('show'), 2000);
    }
  }
}

function fmtNum(n) { return Number(n).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2}); }
function esc(s='') { return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

// ─────────────────────────────────────────────
// INIT
// ─────────────────────────────────────────────
window.onload = async () => {
  if (onPage("companyList"))    loadCompanies();
  if (onPage("statSchools"))    loadDashboard();
  if (onPage("schoolList"))     loadSchools();

  if (onPage("itemList")) {
    await loadSchoolsIntoItemForm();
    await loadCompaniesIntoItemForm();
    loadItems();
  }

  if (onPage("schoolSelect"))   loadSchoolsIntoDropdown("schoolSelect", onSchoolChange);

  if (onPage("deliverySchool")) {
    await loadSchoolsIntoDropdown("deliverySchool", onDeliverySchoolChange);
    loadDeliveries();
  }

  if (onPage("invoiceSchool")) {
    await loadSchoolsIntoDropdown("invoiceSchool");
    await loadCompaniesIntoDropdown("invoiceCompany");
    loadInvoices();
  }

  if (onPage("paymentSchool")) {
    await loadSchoolsIntoDropdown("paymentSchool", onPaymentSchoolChange);
    await loadCompaniesIntoDropdown("paymentCompany", onPaymentCompanyChange);
    loadPayments();
    loadBalanceSummary();
  }

  if (onPage("reportSchool")) {
    await loadSchoolsIntoDropdown("reportSchool", runReport);
  }
};

// ─────────────────────────────────────────────
// SHARED HELPERS
// ─────────────────────────────────────────────
async function loadSchoolsIntoDropdown(selectId, onChangeCb) {
  const { data, error } = await client.from("schools").select("*").order("name");
  if (error) return;
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = "<option value=''>— Select school —</option>";
  (data||[]).forEach(s => { const o=document.createElement("option"); o.value=s.id; o.textContent=s.name; sel.appendChild(o); });
  if (typeof onChangeCb === "function") sel.addEventListener("change", onChangeCb);
}

async function loadCompaniesIntoDropdown(selectId, onChangeCb) {
  const { data, error } = await client.from("companies").select("*").order("name");
  if (error) return;
  const sel = document.getElementById(selectId);
  if (!sel) return;
  sel.innerHTML = "<option value=''>— Select company —</option>";
  (data||[]).forEach(c => { const o=document.createElement("option"); o.value=c.id; o.textContent=c.name; sel.appendChild(o); });
  if (typeof onChangeCb === "function") sel.addEventListener("change", onChangeCb);
}

// ─────────────────────────────────────────────
// SCHOOLS
// ─────────────────────────────────────────────
async function addSchool() {
  const nameEl = document.getElementById("schoolName");
  const name = nameEl.value.trim();
  if (!name) return showToast("Enter a school name","error");
  const { error } = await client.from("schools").insert([{name}]);
  if (error) return showToast("Error: "+error.message,"error");
  nameEl.value=""; showToast("School added"); loadSchools();
}
async function loadSchools() {
  const {data,error} = await client.from("schools").select("*").order("name");
  if (error) return showToast("Error loading schools","error");
  if (typeof renderSchools==="function") renderSchools(data);
}
async function deleteSchool(id) {
  softDelete("School", async()=>{ const {error}=await client.from("schools").delete().eq("id",id); if(error) showToast("Error deleting school","error"); }, loadSchools);
}

// ─────────────────────────────────────────────
// COMPANIES  (name only)
// ─────────────────────────────────────────────
async function addCompany() {
  const nameEl = document.getElementById("companyName");
  const name   = nameEl?.value.trim();
  if (!name) return showToast("Enter a company name","error");
  const {error} = await client.from("companies").insert([{name}]);
  if (error) return showToast("Error: "+error.message,"error");
  if (nameEl) nameEl.value="";
  showToast("Company added"); loadCompanies();
}
async function loadCompanies() {
  const {data,error} = await client.from("companies").select("*").order("name");
  if (error) return showToast("Error loading companies","error");
  if (typeof renderCompanies==="function") renderCompanies(data);
}
async function deleteCompany(id) {
  softDelete("Company", async()=>{ const {error}=await client.from("companies").delete().eq("id",id); if(error) showToast("Error deleting company","error"); }, loadCompanies);
}

// ─────────────────────────────────────────────
// ITEMS  (school-scoped + company-scoped)
// Each item: one school, one company, one category
// Same company can handle different categories at different schools
// ─────────────────────────────────────────────
async function loadSchoolsIntoItemForm() {
  const {data,error} = await client.from("schools").select("*").order("name");
  if (error) return;
  if (typeof renderSchoolOptions==="function") renderSchoolOptions(data);
}
async function loadCompaniesIntoItemForm() {
  const {data,error} = await client.from("companies").select("*").order("name");
  if (error) return;
  if (typeof renderCompanyOptions==="function") renderCompanyOptions(data);
}

async function addItem() {
  const schoolId  = document.getElementById("itemSchool").value;
  const companyId = document.getElementById("itemCompany")?.value||null;
  const name      = document.getElementById("itemName").value.trim();
  const category  = document.getElementById("category").value;
  if (!schoolId)  return showToast("Select a school","error");
  if (!companyId) return showToast("Select a company","error");
  if (!name)      return showToast("Enter an item name","error");
  const {error} = await client.from("items").insert([{school_id:schoolId,company_id:companyId,name,category}]);
  if (error) return showToast("Error: "+error.message,"error");
  document.getElementById("itemName").value="";
  showToast("Item added"); loadItems();
}

async function loadItems() {
  const {data,error} = await client.from("items").select("*, schools(name), companies(name)").order("name");
  if (error) return showToast("Error loading items","error");
  const rows = data.map(i=>({...i, school_name:i.schools?.name||"—", company_name:i.companies?.name||"—"}));
  rows.sort((a,b)=>{
    const sc=(a.school_name||"").localeCompare(b.school_name||""); if(sc!==0) return sc;
    const cc=(a.company_name||"").localeCompare(b.company_name||""); if(cc!==0) return cc;
    return (a.name||"").localeCompare(b.name||"");
  });
  if (typeof renderItems==="function") renderItems(rows);
}

async function deleteItem(id) {
  softDelete("Item", async()=>{ const {error}=await client.from("items").delete().eq("id",id); if(error) showToast("Error deleting item","error"); }, loadItems);
}

// ─────────────────────────────────────────────
// PRICING
// ─────────────────────────────────────────────
async function onSchoolChange() {
  const schoolId = document.getElementById("schoolSelect")?.value;
  if (!schoolId) return;
  loadPricingForSchool(schoolId);
}
async function loadPricingForSchool(schoolId) {
  if (!schoolId) return;
  const {data:items,error:iErr} = await client.from("items").select("*, companies(name)").eq("school_id",schoolId).order("name");
  if (iErr) { showToast("Error loading items","error"); return; }
  if (!items||!items.length) { if(typeof renderPricing==="function") renderPricing([]); showToast("No items for this school yet","error"); return; }
  const {data:prices,error:pErr} = await client.from("school_prices").select("*").eq("school_id",schoolId);
  if (pErr) { showToast("Error loading prices","error"); return; }
  const rows = items.map(item=>{
    const ex=(prices||[]).find(p=>p.item_id===item.id);
    return {id:item.id,name:item.name,category:item.category,company_name:item.companies?.name||"—",price:ex?Number(ex.price):0};
  });
  if (typeof renderPricing==="function") renderPricing(rows);
}
async function updatePrice(itemId,price) {
  const schoolId = document.getElementById("schoolSelect")?.value;
  if (!schoolId) return;
  const {error} = await client.from("school_prices").upsert({school_id:schoolId,item_id:itemId,price:Number(price)},{onConflict:"school_id,item_id"});
  if (error) showToast("Error saving price","error");
}

// ─────────────────────────────────────────────
// DELIVERIES
// Items are strictly scoped to the selected school.
// History grouped: school → company within that school — NEVER mixed across schools.
// New fields: delivery_number (required), lpo_number, delivery_date (required)
// ─────────────────────────────────────────────
let _schoolItemsForDelivery = [];

async function onDeliverySchoolChange() {
  const schoolId = document.getElementById("deliverySchool")?.value;
  _schoolItemsForDelivery = [];
  if (!schoolId) { resetDeliveryItemDropdown(); return; }
  // Only items belonging to THIS school
  const {data,error} = await client.from("items").select("*, companies(name)").eq("school_id",schoolId).order("name");
  if (error) return;
  _schoolItemsForDelivery = data||[];
  // Reset category & item selectors
  const catSel = document.getElementById("deliveryCategory");
  if (catSel) catSel.value="";
  filterDeliveryItemsByCategory();
}

function resetDeliveryItemDropdown() {
  const itemSel=document.getElementById("deliveryItem");
  if (itemSel) itemSel.innerHTML="<option value=''>— Select item —</option>";
  const prev=document.getElementById("itemPreview");
  if (prev) prev.classList.remove("visible");
}

function filterDeliveryItemsByCategory() {
  const category = document.getElementById("deliveryCategory")?.value;
  const itemSel  = document.getElementById("deliveryItem");
  if (!itemSel) return;
  itemSel.innerHTML="<option value=''>— Select item —</option>";
  let filtered = _schoolItemsForDelivery;
  if (category) filtered = filtered.filter(i=>i.category===category);
  filtered.forEach(item=>{
    const o=document.createElement("option");
    o.value=item.id;
    o.textContent=item.name+(item.companies?.name?" ("+item.companies.name+")":"");
    o.dataset.companyId=item.company_id||"";
    o.dataset.companyName=item.companies?.name||"";
    itemSel.appendChild(o);
  });
  const prev=document.getElementById("itemPreview");
  if (prev) prev.classList.remove("visible");
}

// Alias so existing HTML onchange="filterItemsByCategory()" still works
function filterItemsByCategory() { filterDeliveryItemsByCategory(); }

async function addDelivery() {
  const schoolId     = document.getElementById("deliverySchool")?.value;
  const itemId       = document.getElementById("deliveryItem")?.value;
  const quantity     = Number(document.getElementById("quantity")?.value);
  const unit         = typeof getSelectedUnit==="function"?getSelectedUnit():"pcs";
  const deliveryNum  = document.getElementById("deliveryNumber")?.value.trim()||null;
  const lpoNum       = document.getElementById("lpoNumber")?.value.trim()||null;
  const deliveryDate = document.getElementById("deliveryDate")?.value||new Date().toISOString().split("T")[0];

  // Derive company from selected item option
  const itemSel = document.getElementById("deliveryItem");
  const selOpt  = itemSel?.options[itemSel.selectedIndex];
  const companyId = selOpt?.dataset?.companyId||null;

  if (!schoolId)    return showToast("Select a school","error");
  if (!itemId)      return showToast("Select an item","error");
  if (!quantity)    return showToast("Enter quantity","error");
  if (!deliveryNum) return showToast("Enter a delivery number","error");
  if (!deliveryDate)return showToast("Enter delivery date","error");

  const {data:priceData,error:pErr} = await client.from("school_prices").select("price")
    .eq("school_id",schoolId).eq("item_id",itemId).single();
  if (pErr||!priceData) return showToast("Price not set for this item. Go to Pricing first.","error");

  const total = quantity * priceData.price;
  const {error} = await client.from("deliveries").insert([{
    school_id:schoolId, item_id:itemId, company_id:companyId||null,
    quantity, unit, total, delivery_number:deliveryNum, lpo_number:lpoNum, delivery_date:deliveryDate
  }]);
  if (error) return showToast("Error saving delivery: "+error.message,"error");

  ["quantity","deliveryNumber","lpoNumber"].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=""; });
  const prev=document.getElementById("itemPreview"); if(prev) prev.classList.remove("visible");
  showToast("Delivery recorded"); loadDeliveries();
}

async function loadDeliveries() {
  const {data,error} = await client.from("deliveries")
    .select("*, schools(name), items(name,category), companies(name), invoices(invoice_number)")
    .order("delivery_date",{ascending:false});
  if (error) return showToast("Error loading deliveries","error");

  const rows = data.map(d=>({
    id:             d.id,
    school_id:      d.school_id,
    school_name:    d.schools?.name||"—",
    item_name:      d.items?.name||"—",
    category:       d.items?.category||"Others",
    quantity:       d.quantity,
    unit:           d.unit||"pcs",
    price:          d.total/(d.quantity||1),
    total:          d.total,
    company_id:     d.company_id||null,
    company_name:   d.companies?.name||null,
    delivery_number:d.delivery_number||"—",
    lpo_number:     d.lpo_number||null,
    delivery_date:  d.delivery_date||d.created_at,
    invoice_number: d.invoices?.invoice_number||null,
    created_at:     d.created_at
  }));
  if (typeof renderDeliveries==="function") renderDeliveries(rows);
}

async function deleteDelivery(id) {
  softDelete("Delivery", async()=>{ const {error}=await client.from("deliveries").delete().eq("id",id); if(error) showToast("Error deleting delivery","error"); }, loadDeliveries);
}

// ─────────────────────────────────────────────
// INVOICES
// Manual: invoice_number, invoice_date, company, school, amount
// One invoice links to multiple deliveries
// ─────────────────────────────────────────────
async function saveInvoice() {
  const invoiceNumber = document.getElementById("invoiceNumber")?.value.trim();
  const invoiceDate   = document.getElementById("invoiceDate")?.value;
  const companyId     = document.getElementById("invoiceCompany")?.value;
  const schoolId      = document.getElementById("invoiceSchool")?.value;
  const amount        = parseFloat(document.getElementById("invoiceAmount")?.value);

  if (!invoiceNumber) return showToast("Enter an invoice number","error");
  if (!invoiceDate)   return showToast("Select an invoice date","error");
  if (!companyId)     return showToast("Select a company","error");
  if (!schoolId)      return showToast("Select a school","error");
  if (!amount||isNaN(amount)) return showToast("Enter a valid amount","error");

  const checkedBoxes = document.querySelectorAll("#deliveriesPicker input[type=checkbox]:checked");
  const linkedIds    = [...checkedBoxes].map(cb=>cb.value);

  const {data:invoice,error:invErr} = await client.from("invoices").insert([{
    invoice_number:invoiceNumber, invoice_date:invoiceDate,
    company_id:companyId, school_id:schoolId, total:amount, paid_amount:0, status:"Unpaid"
  }]).select().single();
  if (invErr) return showToast("Error saving invoice: "+invErr.message,"error");

  if (linkedIds.length>0)
    await client.from("deliveries").update({invoice_id:invoice.id}).in("id",linkedIds);

  ["invoiceNumber","invoiceDate","invoiceAmount"].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=""; });
  const picker=document.getElementById("deliveriesPicker");
  if (picker) picker.innerHTML='<div class="dp-empty">Select company and school to see deliveries</div>';

  showToast("Invoice saved"); loadInvoices();
  viewInvoice(invoice.id);
}

async function loadDeliveriesForInvoiceForm() {
  const companyId = document.getElementById("invoiceCompany")?.value;
  const schoolId  = document.getElementById("invoiceSchool")?.value;
  const picker    = document.getElementById("deliveriesPicker");
  if (!picker) return;
  if (!companyId||!schoolId) { picker.innerHTML='<div class="dp-empty">Select company and school to see unlinked deliveries</div>'; return; }
  picker.innerHTML='<div class="dp-empty">Loading\u2026</div>';
  const {data,error} = await client.from("deliveries").select("*, items(name)")
    .eq("company_id",companyId).eq("school_id",schoolId).is("invoice_id",null).order("delivery_date",{ascending:false});
  if (error||!data?.length) { picker.innerHTML='<div class="dp-empty">No unlinked deliveries for this company + school</div>'; return; }
  picker.innerHTML = data.map(d=>{
    const date=d.delivery_date?new Date(d.delivery_date).toLocaleDateString("en-KE"):"—";
    const lpo=d.lpo_number?" \u00b7 LPO: "+d.lpo_number:"";
    return `<label class="dp-row"><input type="checkbox" value="${esc(d.id)}" onchange="autoSumDeliveries()">
      <div class="dp-row-info"><div class="dp-row-num">${esc(d.delivery_number||d.id.slice(0,8))}${esc(lpo)}</div>
      <div class="dp-row-meta">${esc(d.items?.name||"—")} &nbsp;&middot;&nbsp; ${date}</div></div>
      <div class="dp-row-amt">KES ${fmtNum(d.total||0)}</div></label>`;
  }).join("");
}

function autoSumDeliveries() {
  const checked=[...document.querySelectorAll("#deliveriesPicker input[type=checkbox]:checked")];
  if (!checked.length) return;
  let total=0;
  checked.forEach(cb=>{ const amt=cb.closest(".dp-row")?.querySelector(".dp-row-amt")?.textContent||"0"; total+=parseFloat(amt.replace(/[^0-9.]/g,""))||0; });
  const amtEl=document.getElementById("invoiceAmount"); if(amtEl) amtEl.value=total.toFixed(2);
}

async function loadInvoices() {
  const {data,error} = await client.from("invoices").select("*, schools(name), companies(name)").order("invoice_date",{ascending:false});
  if (error) return;
  const rows = data.map(inv=>({
    id:             inv.id,
    invoice_number: inv.invoice_number||"—",
    invoice_date:   inv.invoice_date||inv.created_at,
    school_name:    inv.schools?.name||"—",
    company_name:   inv.companies?.name||"—",
    total:          inv.total,
    paid_amount:    inv.paid_amount||0,
    balance:        Math.max(0,(inv.total||0)-(inv.paid_amount||0)),
    status:         inv.status||"Unpaid",
    created_at:     inv.created_at
  }));
  if (typeof renderSavedInvoices==="function") renderSavedInvoices(rows);
}

async function viewInvoice(id) {
  const {data:inv} = await client.from("invoices").select("*, schools(name), companies(name)").eq("id",id).single();
  if (!inv) return;
  const {data:dels} = await client.from("deliveries").select("*, items(name,category)")
    .eq("invoice_id",id).order("delivery_date",{ascending:true});
  const row={...inv, school_name:inv.schools?.name||"—", company_name:inv.companies?.name||"—",
    paid_amount:inv.paid_amount||0, balance:Math.max(0,(inv.total||0)-(inv.paid_amount||0))};
  if (typeof renderInvoiceDoc==="function") renderInvoiceDoc(row, dels||[]);
}

async function deleteInvoice(id) {
  softDelete("Invoice", async()=>{
    await client.from("deliveries").update({invoice_id:null}).eq("invoice_id",id);
    const {error}=await client.from("invoices").delete().eq("id",id);
    if (error) showToast("Error deleting invoice","error");
  }, loadInvoices);
}
async function updateInvoiceStatus(id,status) {
  const {error}=await client.from("invoices").update({status}).eq("id",id);
  if (error) return showToast("Error updating status","error");
  showToast("Invoice marked as "+status); loadInvoices();
}

// ─────────────────────────────────────────────
// PAYMENTS  (Cheques)
// cheque_number, amount, company (paid TO), school (paid BY), payment_date
// Balance = total invoiced - total paid, shown per school+company
// ─────────────────────────────────────────────
async function onPaymentSchoolChange()   { await refreshPaymentInvoices(); }
async function onPaymentCompanyChange()  { await refreshPaymentInvoices(); }

async function refreshPaymentInvoices() {
  const schoolId  = document.getElementById("paymentSchool")?.value;
  const companyId = document.getElementById("paymentCompany")?.value;
  const chip = document.getElementById("balanceChip");
  if (chip) chip.classList.remove("visible");
  if (!schoolId||!companyId) return;
  await loadInvoicesForPayment(schoolId, companyId);
  await updatePaymentBalanceChip(schoolId, companyId);
}

async function loadInvoicesForPayment(schoolId, companyId) {
  let q = client.from("invoices").select("*, companies(name)")
    .eq("school_id",schoolId).eq("company_id",companyId)
    .neq("status","Paid").order("invoice_date",{ascending:false});
  const {data} = await q;
  const sel = document.getElementById("paymentInvoice");
  if (!sel) return;
  sel.innerHTML="<option value=''>— Select invoice —</option>";
  (data||[]).forEach(inv=>{
    const balance=(inv.total||0)-(inv.paid_amount||0);
    const o=document.createElement("option"); o.value=inv.id;
    o.textContent=(inv.invoice_number||"INV")+" — KES "+fmtNum(Math.max(0,balance))+" remaining ("+inv.status+")";
    o.dataset.balance=Math.max(0,balance); o.dataset.total=inv.total;
    sel.appendChild(o);
  });
}

async function updatePaymentBalanceChip(schoolId, companyId) {
  // Total invoiced vs total paid for this school+company combination
  const [{data:invData},{data:pmtData}] = await Promise.all([
    client.from("invoices").select("total,paid_amount").eq("school_id",schoolId).eq("company_id",companyId),
    client.from("payments").select("amount").eq("school_id",schoolId).eq("company_id",companyId)
  ]);
  const totalInvoiced = (invData||[]).reduce((s,i)=>s+Number(i.total||0),0);
  const totalPaid     = (pmtData||[]).reduce((s,p)=>s+Number(p.amount||0),0);
  const balance       = Math.max(0, totalInvoiced-totalPaid);

  const chip     = document.getElementById("balanceChip");
  const totalEl  = document.getElementById("chipTotalInvoiced");
  const paidEl   = document.getElementById("chipTotalPaid");
  const balEl    = document.getElementById("chipBalance");
  if (!chip) return;
  if (totalEl) totalEl.textContent = "KES "+fmtNum(totalInvoiced);
  if (paidEl)  paidEl.textContent  = "KES "+fmtNum(totalPaid);
  if (balEl)   balEl.textContent   = "KES "+fmtNum(balance);
  if (balEl)   balEl.className = "chip-balance-val "+(balance<=0?"clear":totalPaid>0?"partial":"owing");
  chip.classList.add("visible");
}

function onInvoiceChange() {
  const sel = document.getElementById("paymentInvoice");
  const opt = sel?.options[sel.selectedIndex];
  const bal = parseFloat(opt?.dataset?.balance||0);
  if (opt&&opt.value&&!isNaN(bal)) {
    const amtEl = document.getElementById("paymentAmount");
    if (amtEl&&bal>0) amtEl.value=bal.toFixed(2);
  }
}

async function addPayment() {
  const schoolId    = document.getElementById("paymentSchool")?.value;
  const companyId   = document.getElementById("paymentCompany")?.value;
  const invoiceId   = document.getElementById("paymentInvoice")?.value;
  const chequeNum   = document.getElementById("chequeNumber")?.value.trim();
  const amount      = parseFloat(document.getElementById("paymentAmount")?.value);
  const paymentDate = document.getElementById("paymentDate")?.value||new Date().toISOString().split("T")[0];
  const method      = typeof getPaymentMethod==="function"?getPaymentMethod():"Cheque";

  if (!schoolId)            return showToast("Select a school","error");
  if (!companyId)           return showToast("Select a company (who is being paid)","error");
  if (!invoiceId)           return showToast("Select an invoice","error");
  if (!chequeNum)           return showToast("Enter cheque / reference number","error");
  if (!amount||isNaN(amount)) return showToast("Enter a valid amount","error");

  const {error} = await client.from("payments").insert([{
    school_id:schoolId, company_id:companyId, invoice_id:invoiceId,
    cheque_number:chequeNum, method, amount, payment_date:paymentDate
  }]);
  if (error) return showToast("Error recording payment: "+error.message,"error");

  // Recalculate invoice
  const {data:allPmts} = await client.from("payments").select("amount").eq("invoice_id",invoiceId);
  const {data:invoice} = await client.from("invoices").select("total").eq("id",invoiceId).single();
  const totalPaid=(allPmts||[]).reduce((s,p)=>s+Number(p.amount),0);
  const status=totalPaid>=invoice.total?"Paid":totalPaid>0?"Partial":"Unpaid";
  await client.from("invoices").update({status,paid_amount:totalPaid}).eq("id",invoiceId);

  ["chequeNumber","paymentAmount"].forEach(id=>{ const el=document.getElementById(id); if(el) el.value=""; });
  showToast("Payment recorded");
  loadPayments(); loadBalanceSummary();
  await loadInvoicesForPayment(schoolId, companyId);
  await updatePaymentBalanceChip(schoolId, companyId);
}

async function loadPayments() {
  const {data,error} = await client.from("payments")
    .select("*, schools(name), companies(name), invoices(invoice_number,total,paid_amount)")
    .order("payment_date",{ascending:false});
  if (error) return showToast("Error loading payments","error");
  const rows=data.map(p=>({
    id:             p.id,
    school_name:    p.schools?.name||"—",
    company_name:   p.companies?.name||"—",
    invoice_number: p.invoices?.invoice_number||"—",
    invoice_total:  p.invoices?.total||0,
    method:         p.method||"Cheque",
    cheque_number:  p.cheque_number||"",
    amount:         p.amount,
    payment_date:   p.payment_date||p.created_at,
    created_at:     p.created_at
  }));
  if (typeof renderPayments==="function") renderPayments(rows);
}

async function loadBalanceSummary() {
  const [{data:invoices},{data:payments}] = await Promise.all([
    client.from("invoices").select("school_id,company_id,total,paid_amount,schools(name),companies(name)"),
    client.from("payments").select("school_id,company_id,amount,schools(name),companies(name)")
  ]);
  const key=(s,c)=>`${s}::${c}`; const map={};
  (invoices||[]).forEach(inv=>{
    const k=key(inv.school_id,inv.company_id);
    if(!map[k]) map[k]={school:inv.schools?.name||"—",company:inv.companies?.name||"—",invoiced:0,paid:0};
    map[k].invoiced+=Number(inv.total||0);
  });
  (payments||[]).forEach(p=>{
    const k=key(p.school_id,p.company_id);
    if(!map[k]) map[k]={school:p.schools?.name||"—",company:p.companies?.name||"—",invoiced:0,paid:0};
    map[k].paid+=Number(p.amount||0);
  });
  const rows=Object.values(map).map(r=>({...r,balance:Math.max(0,r.invoiced-r.paid)}))
    .sort((a,b)=>a.school.localeCompare(b.school)||a.company.localeCompare(b.company));
  if (typeof renderBalanceSummary==="function") renderBalanceSummary(rows);
}

async function deletePayment(id) {
  softDelete("Payment", async()=>{
    const {data:pmt} = await client.from("payments").select("invoice_id,amount").eq("id",id).single();
    const {error}=await client.from("payments").delete().eq("id",id);
    if(error){showToast("Error deleting payment","error");return;}
    if(pmt?.invoice_id){
      const {data:allPmts}=await client.from("payments").select("amount").eq("invoice_id",pmt.invoice_id);
      const {data:inv}=await client.from("invoices").select("total").eq("id",pmt.invoice_id).single();
      if(inv){
        const tp=(allPmts||[]).reduce((s,p)=>s+Number(p.amount),0);
        const st=tp>=inv.total?"Paid":tp>0?"Partial":"Unpaid";
        await client.from("invoices").update({status:st,paid_amount:tp}).eq("id",pmt.invoice_id);
      }
    }
  }, loadPayments);
}

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────
async function loadDashboard() {
  const today=new Date().toISOString().split("T")[0];
  const [{data:schools},{data:todayDeliveries},{data:invoices},{data:payments},{data:unpaidInvoices}]=await Promise.all([
    client.from("schools").select("id"),
    client.from("deliveries").select("total").gte("delivery_date",today),
    client.from("invoices").select("total,status"),
    client.from("payments").select("amount"),
    client.from("invoices").select("id,schools(name),total,paid_amount,invoice_date").neq("status","Paid")
  ]);
  const set=(id,val)=>{const el=document.getElementById(id);if(el)el.textContent=val;};
  const fmtKES=n=>"KES "+Number(n).toLocaleString("en-KE",{minimumFractionDigits:0});
  set("statSchools",schools?.length||0);
  set("statDeliveries",todayDeliveries?.length||0);
  set("statDeliveriesLabel","Today's Deliveries");
  const totalPaid=payments?.reduce((s,p)=>s+Number(p.amount),0)||0;
  const totalInv=invoices?.reduce((s,i)=>s+Number(i.total),0)||0;
  const outstanding=Math.max(0,totalInv-totalPaid);
  set("statInvoices",invoices?.filter(i=>i.status!=="Paid").length||0);
  set("statPayments",fmtKES(totalPaid));
  const alertEl=document.getElementById("outstandingAlert");
  if(alertEl){
    if(outstanding>0){
      const overdueList=(unpaidInvoices||[]).filter(i=>(Date.now()-new Date(i.invoice_date||i.created_at))/86400000>30);
      alertEl.style.display="";
      const amtEl=document.getElementById("alertAmount"); if(amtEl) amtEl.textContent=fmtKES(outstanding);
      const cntEl=document.getElementById("alertSchools"); if(cntEl) cntEl.textContent=(unpaidInvoices?.length||0)+" invoice"+(unpaidInvoices?.length!==1?"s":"");
      const ovrEl=document.getElementById("alertOverdue"); if(ovrEl) ovrEl.textContent=overdueList.length>0?overdueList.length+" overdue (>30 days)":"All within 30 days";
    } else alertEl.style.display="none";
  }
}

// ─────────────────────────────────────────────
// REPORTS
// ─────────────────────────────────────────────
async function runReport() {
  const schoolId=document.getElementById("reportSchool")?.value;
  const startDate=document.getElementById("reportStart")?.value;
  const endDate=document.getElementById("reportEnd")?.value;
  if(!startDate||!endDate) return;
  let dQ=client.from("deliveries").select("*, schools(name), items(name,category), companies(name)").gte("delivery_date",startDate).lte("delivery_date",endDate);
  if(schoolId) dQ=dQ.eq("school_id",schoolId);
  const {data:deliveries}=await dQ;
  let iQ=client.from("invoices").select("*, schools(name), companies(name)");
  if(schoolId) iQ=iQ.eq("school_id",schoolId);
  const {data:invoices}=await iQ;
  let pQ=client.from("payments").select("*, schools(name), companies(name)").gte("payment_date",startDate).lte("payment_date",endDate);
  if(schoolId) pQ=pQ.eq("school_id",schoolId);
  const {data:payments}=await pQ;
  const revenue=deliveries?.reduce((s,d)=>s+Number(d.total),0)||0;
  const totalPaid=payments?.reduce((s,p)=>s+Number(p.amount),0)||0;
  const totalInv=invoices?.reduce((s,i)=>s+Number(i.total),0)||0;
  const bySchool={};
  deliveries?.forEach(d=>{const n=d.schools?.name||"—";bySchool[n]=(bySchool[n]||0)+Number(d.total);});
  const deliveriesBySchool=Object.entries(bySchool).map(([name,total])=>({name,total})).sort((a,b)=>b.total-a.total);
  const byCat={};
  deliveries?.forEach(d=>{const c=d.items?.category||"Others";byCat[c]=(byCat[c]||0)+Number(d.total);});
  const deliveriesByCategory=Object.entries(byCat).map(([cat,total])=>({cat,total})).sort((a,b)=>b.total-a.total);
  const invBySchool={};
  invoices?.forEach(i=>{const n=i.schools?.name||"—";if(!invBySchool[n])invBySchool[n]={school:n,invoiced:0,paid:0};invBySchool[n].invoiced+=Number(i.total);invBySchool[n].paid+=Number(i.paid_amount||0);});
  const invoiceTable=Object.values(invBySchool).map(r=>({...r,outstanding:Math.max(0,r.invoiced-r.paid)}));
  const payBySchool={};
  payments?.forEach(p=>{const n=p.schools?.name||"—";if(!payBySchool[n])payBySchool[n]={school:n,count:0,total:0};payBySchool[n].count++;payBySchool[n].total+=Number(p.amount);});
  const paymentTable=Object.values(payBySchool);
  const recentDeliveries=(deliveries||[]).slice(0,20).map(d=>({item:d.items?.name||"—",school:d.schools?.name||"—",company:d.companies?.name||"—",qty:d.quantity,unit:d.unit||"pcs",amount:d.total,date:d.delivery_date||d.created_at}));
  if(typeof renderReport==="function") renderReport({kpis:{revenue,deliveries:deliveries?.length||0,invoices:invoices?.length||0,payments:totalPaid,outstanding:totalInv-totalPaid},deliveriesBySchool,deliveriesByCategory,invoiceTable,paymentTable,recentDeliveries});
}

// ─────────────────────────────────────────────
// DELIVERY RECEIPT (print popup)
// ─────────────────────────────────────────────
function printDeliveryReceipt(delivery) {
  const date=delivery.delivery_date?new Date(delivery.delivery_date).toLocaleDateString("en-KE",{year:"numeric",month:"long",day:"numeric"}):new Date().toLocaleDateString("en-KE",{year:"numeric",month:"long",day:"numeric"});
  const unitPrice=delivery.price||0; const total=unitPrice*delivery.quantity;
  const win=window.open("","_blank","width=620,height=760");
  win.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Delivery Receipt</title>
  <style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Segoe UI',sans-serif;padding:36px;color:#111;max-width:520px;margin:0 auto}
  .hdr{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:28px;padding-bottom:18px;border-bottom:2px solid #111}
  .brand{font-size:20px;font-weight:800}.brand-sub{font-size:11px;color:#666;margin-top:2px}
  .receipt-no{text-align:right;font-size:12px;color:#666}.receipt-no strong{display:block;font-size:16px;color:#111;font-weight:800}
  .grid{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:22px}
  .block{background:#f8fafc;border-radius:8px;padding:10px 13px}.block-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.8px;color:#888;margin-bottom:3px}.block-val{font-size:14px;font-weight:700}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}th{text-align:left;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.7px;color:#888;padding:7px 10px;border-bottom:2px solid #eee}td{padding:10px;border-bottom:1px solid #f0f0f0;font-size:14px}
  .tr td{border-top:2px solid #111;border-bottom:none;font-weight:800;font-size:15px;padding-top:12px}
  .sig{margin-top:40px;display:grid;grid-template-columns:1fr 1fr;gap:24px}.sl{border-top:1px solid #ccc;padding-top:8px;font-size:11px;color:#888;text-align:center}
  .footer{margin-top:32px;text-align:center;font-size:11px;color:#aaa}@media print{body{padding:20px}}</style></head><body>
  <div class="hdr"><div><div class="brand">&#128202; System</div><div class="brand-sub">Delivery Receipt</div></div>
  <div class="receipt-no"><strong>${esc(delivery.delivery_number||"DEL")}</strong>${date}</div></div>
  <div class="grid">
    <div class="block"><div class="block-lbl">School</div><div class="block-val">&#127979; ${esc(delivery.school_name||"—")}</div></div>
    <div class="block"><div class="block-lbl">Company</div><div class="block-val">&#127970; ${esc(delivery.company_name||"—")}</div></div>
    ${delivery.lpo_number?`<div class="block"><div class="block-lbl">LPO Number</div><div class="block-val">${esc(delivery.lpo_number)}</div></div>`:""}
    ${delivery.invoice_number?`<div class="block"><div class="block-lbl">Invoice No.</div><div class="block-val">${esc(delivery.invoice_number)}</div></div>`:""}
  </div>
  <table><thead><tr><th>Item</th><th>Category</th><th>Qty</th><th>Unit Price</th><th>Total</th></tr></thead>
  <tbody><tr><td><strong>${esc(delivery.item_name||"—")}</strong></td><td>${esc(delivery.category||"—")}</td>
  <td>${delivery.quantity} ${esc(delivery.unit||"pcs")}</td>
  <td>KES ${Number(unitPrice).toLocaleString("en-KE",{minimumFractionDigits:2})}</td>
  <td>KES ${Number(total).toLocaleString("en-KE",{minimumFractionDigits:2})}</td></tr></tbody>
  <tfoot><tr class="tr"><td colspan="4">Total</td><td>KES ${Number(total).toLocaleString("en-KE",{minimumFractionDigits:2})}</td></tr></tfoot></table>
  <div class="sig"><div class="sl">Delivered by (Signature)</div><div class="sl">Received by (Signature)</div></div>
  <div class="footer">Generated &middot; ${new Date().toLocaleString()}</div></body></html>`);
  win.document.close(); setTimeout(()=>win.print(),400);
}

// ─────────────────────────────────────────────
// CSV EXPORTS
// ─────────────────────────────────────────────
function exportToCSV(rows, filename) {
  if(!rows||!rows.length){showToast("No data to export","error");return;}
  const headers=Object.keys(rows[0]);
  const lines=[headers.join(",")];
  rows.forEach(row=>{const vals=headers.map(h=>{const v=row[h]==null?"":String(row[h]);return v.includes(",")||v.includes('"')||v.includes("\n")?'"'+v.replace(/"/g,'""')+'"':v;});lines.push(vals.join(","));});
  const blob=new Blob([lines.join("\n")],{type:"text/csv;charset=utf-8;"});
  const url=URL.createObjectURL(blob); const a=document.createElement("a");
  a.href=url; a.download=filename+"_"+new Date().toISOString().split("T")[0]+".csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  showToast("CSV exported");
}

async function exportDeliveriesCSV() {
  const {data}=await client.from("deliveries").select("*, schools(name), items(name,category), companies(name)").order("delivery_date",{ascending:false});
  if(!data) return;
  exportToCSV(data.map(d=>({Delivery_No:d.delivery_number||"—",LPO_No:d.lpo_number||"—",Date:d.delivery_date||"—",School:d.schools?.name||"—",Company:d.companies?.name||"—",Item:d.items?.name||"—",Category:d.items?.category||"—",Quantity:d.quantity,Unit:d.unit||"pcs",Total_KES:d.total})),"deliveries");
}

async function exportInvoicesCSV() {
  const {data}=await client.from("invoices").select("*, schools(name), companies(name)").order("invoice_date",{ascending:false});
  if(!data) return;
  exportToCSV(data.map(i=>({Invoice_No:i.invoice_number||"—",Date:i.invoice_date||"—",School:i.schools?.name||"—",Company:i.companies?.name||"—",Total_KES:i.total,Paid_KES:i.paid_amount||0,Balance_KES:Math.max(0,(i.total||0)-(i.paid_amount||0)),Status:i.status||"—"})),"invoices");
}

async function exportPaymentsCSV() {
  const {data}=await client.from("payments").select("*, schools(name), companies(name), invoices(invoice_number)").order("payment_date",{ascending:false});
  if(!data) return;
  exportToCSV(data.map(p=>({Date:p.payment_date||"—",School:p.schools?.name||"—",Company:p.companies?.name||"—",Invoice_No:p.invoices?.invoice_number||"—",Method:p.method||"—",Cheque_No:p.cheque_number||"—",Amount_KES:p.amount})),"payments");
}

// ─────────────────────────────────────────────
// MISC
// ─────────────────────────────────────────────
function saveDeliveryRange(range){try{localStorage.setItem("deliveryRange",range);}catch(e){}}
function getSavedDeliveryRange(){try{return localStorage.getItem("deliveryRange")||"today";}catch(e){return"today";}}
function printInvoice(){window.print();}
function logout(){if(confirm("Log out?")){client.auth.signOut();window.location.href="index.html";}}

if(typeof showToast==="undefined"){
  window.showToast=function(msg,type="success"){
    const t=document.getElementById("toast"); if(!t) return;
    t.textContent=(type==="success"?"✅ ":"❌ ")+msg;
    t.className="toast "+type+" show";
    setTimeout(()=>t.classList.remove("show"),3000);
  };
}
