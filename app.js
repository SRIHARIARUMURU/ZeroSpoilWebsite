/*******************
 * KEYS & SESSIONS *
 *******************/
const USERS_KEY = 'zs_users';
const SESSION_KEY = 'zs_session';
const BOARD_KEY  = 'zs_board'; // array of posts

function getSession(){
  return JSON.parse(sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || 'null');
}

(function guard(){
  const s = getSession();
  if(!s){ window.location.href = 'auth.html'; }
  else { document.getElementById('navUser').textContent = `Hi, ${s.username}`; }
})();

function logout(){
  sessionStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(SESSION_KEY);
  window.location.href = 'auth.html';
}

function storageKey(){
  const s = getSession(); 
  const uname = s?.username || 'guest';
  return `zerospoil_${uname}`;
}

/*******************
 * DATE UTILITIES  *
 * (Keep parseDMYToISO for legacy data only)
 *******************/
function parseDMYToISO(dmy){
  if(!dmy) return null;
  const m = dmy.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if(!m) return null;
  const dd = parseInt(m[1],10), mm = parseInt(m[2],10), yyyy = parseInt(m[3],10);
  if(mm < 1 || mm > 12) return null;
  if(dd < 1 || dd > 31) return null;
  const jsDate = new Date(yyyy, mm - 1, dd);
  if (jsDate.getFullYear() !== yyyy || (jsDate.getMonth()+1) !== mm || jsDate.getDate() !== dd) return null;
  return `${yyyy}-${String(mm).padStart(2,'0')}-${String(dd).padStart(2,'0')}`;
}
function formatISOtoDMY(iso){
  if(!iso) return "";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if(!m) return iso;
  const [_, y, mm, dd] = m;
  return `${dd}/${mm}/${y}`;
}
function isoTimestamp(isoDate){ return new Date(isoDate + "T23:59:59").getTime(); }
function daysLeftISO(isoDate){ return Math.ceil((isoTimestamp(isoDate) - Date.now()) / (1000*60*60*24)); }

/*******************
 * USERS & NOTIFS  *
 *******************/
function getUsers(){
  try { return JSON.parse(localStorage.getItem(USERS_KEY) || '[]'); }
  catch { return []; }
}
function notifKey(username){ return `zs_notifications_${username}`; }
function getNotifs(username){
  try { return JSON.parse(localStorage.getItem(notifKey(username)) || '[]'); }
  catch { return []; }
}
function setNotifs(username, arr){
  localStorage.setItem(notifKey(username), JSON.stringify(arr));
}
function pushNotif(username, message, payload={}){
  const arr = getNotifs(username);
  arr.unshift({ 
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()), 
    message, payload, read:false, createdAt:new Date().toISOString() 
  });
  setNotifs(username, arr);
}

/*******************
 * BOARD SHARED    *
 *******************/
function getBoard(){
  try { return JSON.parse(localStorage.getItem(BOARD_KEY) || '[]'); }
  catch { return []; }
}
function setBoard(arr){
  localStorage.setItem(BOARD_KEY, JSON.stringify(arr));
}

/*******************
 * STATE           *
 *******************/
let inventory = [];
let sortState = { key:"", dir:1 };
let editIndex = null;

/*******************
 * INIT            *
 *******************/
(function init(){
  // Load inventory for current user and normalize legacy data
  try{
    const raw = JSON.parse(localStorage.getItem(storageKey()) || '[]');
    inventory = raw.map(it => {
      let expiryISO = it.expiryISO;

      // Legacy support:
      //  - if 'expiry' is ISO -> use it
      //  - if 'expiry' is dd/mm/yyyy -> convert
      if(!expiryISO && typeof it.expiry === "string"){
        expiryISO = /^\d{4}-\d{2}-\d{2}$/.test(it.expiry) ? it.expiry : parseDMYToISO(it.expiry);
      }

      return {
        id: it.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random())),
        ...it,
        expiryISO: expiryISO || "",
        redistribute: it.redistribute || false // flag if posted to board
      };
    });
  }catch{ inventory = []; }

  render();
  renderBoard();
  renderNotifications();

  // Reflect changes from other tabs (same browser profile)
  window.addEventListener('storage', (e) => {
    if([BOARD_KEY, storageKey(), USERS_KEY].includes(e.key)){
      renderBoard();
      renderNotifications();
      refreshMyInventory(); // re-normalize after external changes
    }
  });
})();

function save(){
  localStorage.setItem(storageKey(), JSON.stringify(inventory));
  render();
}

/*******************
 * STATUS & VALID  *
 *******************/
function computeStatus(item){
  if(item.redistribute) return "Redistributing";
  const d = daysLeftISO(item.expiryISO);
  return d <= 2 ? "Near Expiry" : "Fresh";
}
function validateItem(item){
  const required = ["storeId","storeName","storeAddress","product","qty","expiryISO"];
  for(const k of required){ if(!item[k] && item[k] !== 0) return `Field "${k}" is required.`; }
  if(Number(item.qty) <= 0) return "Quantity must be greater than 0.";
  if(!/^\d{4}-\d{2}-\d{2}$/.test(item.expiryISO)) return "Invalid expiry date format.";
  return "";
}

/*******************
 * ADD / EDIT      *
 *******************/
function addProduct(){
  // <input type="date"> returns ISO (yyyy-mm-dd)
  const iso = document.getElementById("expiry").value;
  if(!iso){ alert("Please select a valid date."); return; }

  const item = {
    id: crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(),
    storeId: document.getElementById("storeId").value.trim(),
    storeName: document.getElementById("storeName").value.trim(),
    storeAddress: document.getElementById("storeAddress").value.trim(),
    product: document.getElementById("product").value.trim(),
    qty: parseFloat(document.getElementById("qty").value),
    expiryISO: iso,
    createdAt: new Date().toISOString(),
    category: document.getElementById("category").value || "Other",
    redistribute: false
  };
  const err = validateItem(item); if(err){ alert(err); return; }

  inventory.push(item);
  ["storeId","storeName","storeAddress","product","qty","expiry","category"].forEach(id=>{
    const el = document.getElementById(id);
    if(!el) return;
    if(el.tagName === "SELECT") el.selectedIndex = 0; else el.value = "";
  });
  save();
}

function getIndexById(id){ return inventory.findIndex(x => x.id === id); }

function openEditById(id){
  const idx = getIndexById(id); if(idx < 0) return;
  editIndex = idx;
  const i = inventory[idx];
  document.getElementById("edit_storeId").value      = i.storeId;
  document.getElementById("edit_storeName").value    = i.storeName;
  document.getElementById("edit_storeAddress").value = i.storeAddress;
  document.getElementById("edit_product").value      = i.product;
  document.getElementById("edit_qty").value          = i.qty;

  // For <input type="date">, set ISO directly
  document.getElementById("edit_expiry").value       = (i.expiryISO || "");
  document.getElementById("edit_category").value     = i.category || "Other";

  const modal = document.getElementById("editModal");
  modal.style.display = "flex";
  modal.setAttribute("aria-hidden", "false");
}
function closeEdit(){
  const modal = document.getElementById("editModal");
  modal.style.display = "none";
  modal.setAttribute("aria-hidden", "true");
  editIndex = null;
}
function saveEdit(){
  if(editIndex === null) return;
  const iso = document.getElementById("edit_expiry").value; // ISO
  if(!iso){ alert("Please select a valid date."); return; }

  const updated = {
    ...inventory[editIndex],
    storeId: document.getElementById("edit_storeId").value.trim(),
    storeName: document.getElementById("edit_storeName").value.trim(),
    storeAddress: document.getElementById("edit_storeAddress").value.trim(),
    product: document.getElementById("edit_product").value.trim(),
    qty: parseFloat(document.getElementById("edit_qty").value),
    expiryISO: iso,
    category: document.getElementById("edit_category").value
  };
  const err = validateItem(updated); if(err){ alert(err); return; }
  inventory[editIndex] = updated;
  save();
  closeEdit();
}

/*******************
 * DELETE          *
 *******************/
function removeById(id){
  const idx = getIndexById(id); if(idx < 0) return;
  const i = inventory[idx];
  if(i.redistribute){
    alert("This item is currently posted for redistribution. It can be removed only after all quantity is claimed.");
    return;
  }
  const ok = confirm(`Delete "${i.product}" from ${i.storeName}? This cannot be undone.`);
  if(!ok) return;
  inventory.splice(idx, 1);
  save();
}

/*******************
 * REDISTRIBUTE    *
 *******************/
function redistributeById(id){
  const idx = getIndexById(id); if(idx < 0) return;
  const item = inventory[idx];

  if(item.redistribute){
    alert("Already posted to the Redistribution Board.");
    return;
  }
  const ok = confirm(`Post "${item.product}" (${item.qty} kg) for redistribution to all shops?`);
  if(!ok) return;

  // Create a board post
  const s = getSession();
  const post = {
    postId: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random()),
    owner: s.username,
    itemId: item.id,
    storeId: item.storeId,
    storeName: item.storeName,
    storeAddress: item.storeAddress,
    product: item.product,
    expiryISO: item.expiryISO,
    category: item.category || "Other",
    qtyTotal: Number(item.qty) || 0,
    qtyRemaining: Number(item.qty) || 0,
    takers: [],
    createdAt: new Date().toISOString()
  };
  const board = getBoard();
  board.unshift(post);
  setBoard(board);

  // Mark item as redistributing (kept in inventory)
  item.redistribute = true;
  save();

  // Notify all users except owner
  const users = getUsers();
  const msg = `New redistribution: ${item.product} (${item.qty} kg) from ${item.storeName}`;
  users.filter(u => u.username !== s.username).forEach(u => pushNotif(u.username, msg, { postId: post.postId }));

  alert("Posted to Redistribution Board and alerts sent to all shops (on this device).");
  renderBoard();
  renderNotifications();
}

// Claim from board
function claimFromBoard(postId){
  const s = getSession();
  const qtyStr = prompt("Enter quantity (kg) to claim:");
  if(qtyStr === null) return; // cancelled
  const qty = parseFloat(qtyStr);
  if(isNaN(qty) || qty <= 0){ alert("Enter a valid positive number."); return; }

  // Load board
  const board = getBoard();
  const postIdx = board.findIndex(p => p.postId === postId);
  if(postIdx < 0){ alert("This post is no longer available."); return; }
  const post = board[postIdx];

  if(post.owner === s.username){
    alert("You cannot claim your own post.");
    return;
  }
  if(qty > post.qtyRemaining){
    alert(`Only ${post.qtyRemaining} kg left to claim.`);
    return;
  }

  // Update post
  post.qtyRemaining = +(post.qtyRemaining - qty).toFixed(2);
  post.takers.push({ username:s.username, qty, at:new Date().toISOString() });
  board[postIdx] = post;
  setBoard(board);

  // Reduce quantity in OWNER's inventory
  const ownerKey = `zerospoil_${post.owner}`;
  try{
    const arr = JSON.parse(localStorage.getItem(ownerKey) || '[]');
    const invIdx = arr.findIndex(x => x.id === post.itemId);
    if(invIdx >= 0){
      arr[invIdx].qty = +(Number(arr[invIdx].qty || 0) - qty).toFixed(2);
      if(arr[invIdx].qty <= 0){
        // Remove from inventory and close post
        arr.splice(invIdx, 1);
        // Remove post from board
        const b2 = getBoard().filter(p => p.postId !== postId);
        setBoard(b2);
      }
      localStorage.setItem(ownerKey, JSON.stringify(arr));
    }
  }catch(e){ console.error("Owner inventory update failed:", e); }

  // Notify owner
  pushNotif(post.owner, `${s.username} claimed ${qty} kg of ${post.product} from ${post.storeName}`, { postId });

  alert("Claim successful!");
  renderBoard();
  renderNotifications();
  // If the current user is the owner (shouldn't happen as we block), also rerender inventory
  const me = getSession();
  if(me.username === post.owner){ refreshMyInventory(); }
}

// Normalize and refresh current user's inventory
function refreshMyInventory(){
  try{
    const raw = JSON.parse(localStorage.getItem(storageKey()) || '[]');
    inventory = raw.map(it => {
      let expiryISO = it.expiryISO;
      if(!expiryISO && typeof it.expiry === "string"){
        expiryISO = /^\d{4}-\d{2}-\d{2}$/.test(it.expiry) ? it.expiry : parseDMYToISO(it.expiry);
      }
      return {
        id: it.id || (crypto.randomUUID ? crypto.randomUUID() : String(Date.now()+Math.random())),
        ...it,
        expiryISO: expiryISO || "",
        redistribute: !!it.redistribute
      };
    });
  }catch{ /* noop */ }
  render();
}

/*******************
 * CLEAR ALL       *
 *******************/
function clearAll(){
  if(!inventory.length){ alert("Nothing to clear."); return; }
  const ok = confirm("Clear all items from local storage for this user?");
  if(!ok) return;
  inventory = [];
  save();
}

/*******************
 * FILTERS / SORT  *
 *******************/
function applyFilters(){ render(); }
function sortBy(key){
  if(sortState.key === key) sortState.dir *= -1;
  else { sortState.key = key; sortState.dir = 1; }
  render();
}
function getFilteredSortedData(){
  const q = document.getElementById("search").value.trim().toLowerCase();
  const s = document.getElementById("statusFilter").value;
  const c = document.getElementById("categoryFilter").value;

  let data = inventory.map(item => ({ ...item, status: computeStatus(item) }));

  if(q){
    data = data.filter(i =>
      (i.product && i.product.toLowerCase().includes(q)) ||
      (i.storeName && i.storeName.toLowerCase().includes(q)) ||
      (i.storeId && i.storeId.toLowerCase().includes(q))
    );
  }
  if(s) data = data.filter(i => i.status === s);
  if(c) data = data.filter(i => (i.category || "Other") === c);

  if(sortState.key){
    const k = sortState.key, dir = sortState.dir;
    data.sort((a,b)=>{
      let va = a[k], vb = b[k];
      if(k === "qty"){ va = Number(va) || 0; vb = Number(vb) || 0; }
      if(k === "expiryISO"){ va = isoTimestamp(a.expiryISO); vb = isoTimestamp(b.expiryISO); }
      if(typeof va === "string") va = va.toLowerCase();
      if(typeof vb === "string") vb = vb.toLowerCase();
      if(va < vb) return -1 * dir;
      if(va > vb) return  1 * dir;
      return 0;
    });
  }
  return data;
}

/*******************
 * RENDER: INV     *
 *******************/
function render(){
  const tbody = document.getElementById("tableBody");
  const empty = document.getElementById("emptyState");
  tbody.innerHTML = "";

  const data = getFilteredSortedData();
  empty.style.display = data.length ? "none" : "block";

  data.forEach(i=>{
    const dLeft = daysLeftISO(i.expiryISO);
    const status = computeStatus(i);
    let badgeClass = "status-fresh";
    if(status === "Near Expiry")      badgeClass = "status-near";
    if(status === "Redistributing")   badgeClass = "status-redis";

    const statusHtml = `<span class="status-badge ${badgeClass}">
      ${status} <span class="chip">${dLeft}d left</span>
    </span>`;

    const tr = document.createElement("tr");
    const cells = [
      { label:"Store ID",     value:i.storeId },
      { label:"Store Name",   value:i.storeName },
      { label:"Store Address",value:i.storeAddress },
      { label:"Product",      value:i.product },
      { label:"Qty (kg)",     value:(Number(i.qty)||0).toFixed(2) },
      { label:"Expiry",       value:formatISOtoDMY(i.expiryISO) },
      { label:"Status",       value:statusHtml, html:true },
      { label:"Category",     value:i.category || "Other" },
      { label:"Action",       html:true, value: `
        <div class="row-actions">
          <button class="btn small"      onclick="openEditById('${i.id}')"      ${i.redistribute ? 'disabled' : ''}>Edit</button>
          <button class="btn small info" onclick="redistributeById('${i.id}')"  ${i.redistribute ? 'disabled' : ''}>Redistribute</button>
          <button class="btn warn small" onclick="removeById('${i.id}')"        ${i.redistribute ? 'disabled' : ''}>Delete</button>
        </div>` }
    ];
    cells.forEach(c=>{
      const td = document.createElement("td");
      td.setAttribute("data-label", c.label);
      if(c.html) td.innerHTML = c.value; else td.textContent = c.value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });

  // Modal UX
  window.onkeydown = (e)=>{ if(e.key === "Escape") closeEdit(); };
  const backdrop = document.getElementById("editModal");
  backdrop.onclick = (e)=>{ if(e.target.id === "editModal") closeEdit(); };
}

/*******************
 * RENDER: BOARD   *
 *******************/
function renderBoard(){
  const tbody = document.getElementById("boardBody");
  const empty = document.getElementById("boardEmpty");
  tbody.innerHTML = "";
  const s = getSession();

  const board = getBoard().filter(p => p.qtyRemaining > 0); // hide completed posts
  empty.style.display = board.length ? "none" : "block";

  board.forEach(p=>{
    const tr = document.createElement("tr");

    const claimAction = (p.owner !== s.username)
      ? `<div class="row-actions">
           <button class="btn small" onclick="claimFromBoard('${p.postId}')">Claim</button>
         </div>`
      : `<span class="muted">Your post</span>`;

    const cells = [
      { label:"Owner",     value:p.owner },
      { label:"Store",     value:`${p.storeName} (${p.storeId})` },
      { label:"Product",   value:p.product },
      { label:"Expiry",    value:formatISOtoDMY(p.expiryISO) },
      { label:"Category",  value:p.category || "Other" },
      { label:"Qty Total", value:(Number(p.qtyTotal)||0).toFixed(2) },
      { label:"Qty Left",  value:(Number(p.qtyRemaining)||0).toFixed(2) },
      { label:"Action",    value:claimAction, html:true }
    ];
    cells.forEach(c=>{
      const td = document.createElement("td");
      td.setAttribute("data-label", c.label);
      if(c.html) td.innerHTML = c.value; else td.textContent = c.value;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

/*******************
 * NOTIFICATIONS   *
 *******************/
function renderNotifications(){
  const s = getSession();
  const btnCount = document.getElementById('notifCount');
  const card     = document.getElementById('notificationsCard');
  const list     = document.getElementById('notifList');

  const arr = getNotifs(s.username);
  const unread = arr.filter(n => !n.read).length;

  if(unread > 0){
    btnCount.style.display = 'inline-block';
    btnCount.textContent = unread;
    card.style.display = 'block';
  }else{
    btnCount.style.display = 'none';
    card.style.display = arr.length ? 'block' : 'none';
  }

  list.innerHTML = '';
  arr.slice(0, 20).forEach(n=>{
    const li = document.createElement('li');
    const when = new Date(n.createdAt).toLocaleString();
    li.innerHTML = `<strong>${n.message}</strong> <span class="muted">(${when})</span>`;
    list.appendChild(li);
  });
}

function toggleNotifications(){
  const card = document.getElementById('notificationsCard');
  card.style.display = (card.style.display === 'none' || card.style.display === '') ? 'block' : 'none';
}

function markAllRead(){
  const s = getSession();
  const arr = getNotifs(s.username).map(n => ({...n, read:true}));
  setNotifs(s.username, arr);
  renderNotifications();
}
