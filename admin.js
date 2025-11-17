/* Admin module JS */
async function handleAdminLogin(e){
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  const { data } = await api('admin_login', payload);
  setSession('admin', data.token, data.profile);
  location.href='admin-dashboard.html';
}

async function ensureAdmin(){
  const sess = getSession('admin');
  if(!sess.token){ location.href='admin-login.html'; return null; }
  return sess;
}

async function loadAdminDashboard(){
  const sess = await ensureAdmin(); if(!sess) return;
  const [users, dealers, coupons, txs] = await Promise.all([
    api('admin_get_users', { token: sess.token }).then(r=>r.data),
    api('admin_get_dealers', { token: sess.token }).then(r=>r.data),
    api('admin_get_coupons', { token: sess.token }).then(r=>r.data),
    api('admin_get_transactions', { token: sess.token }).then(r=>r.data),
  ]);
  renderTable('#usersTbl', users, ['UserID','Name','Email','WalletPoints'], (row)=>`<button class="btn secondary small" onclick='editUser("${row.UserID}")'>Edit</button> <button class="btn secondary small" onclick='deleteUser("${row.UserID}")'>Delete</button>`);
  renderTable('#dealersTbl', dealers, ['DealerID','DealerName','Email'], (row)=>`<button class="btn secondary small" onclick='editDealer("${row.DealerID}")'>Edit</button> <button class="btn secondary small" onclick='deleteDealer("${row.DealerID}")'>Delete</button>`);
  renderTable('#couponsTbl', coupons, ['CouponCode','Value','Used','UsedBy'], (row)=>`<button class="btn secondary small" onclick='deleteCoupon("${row.CouponCode}")'>Delete</button>`);
  renderTable('#txTbl', txs, ['Date','UserID','DealerID','Type','Amount','OrderID','OldBalance','NewBalance']);

  document.getElementById('kpiUsers').textContent = users.length;
  document.getElementById('kpiDealers').textContent = dealers.length;
  document.getElementById('kpiCoupons').textContent = coupons.filter(c=>String(c.Used).toLowerCase()!=='yes').length;

  qs('#exportAll').onclick = ()=>{
    const rows = [
      ['Users'], ...users.map(u=>[u.UserID,u.Name,u.Email,u.WalletPoints]), [''],
      ['Dealers'], ...dealers.map(d=>[d.DealerID,d.DealerName,d.Email]), [''],
      ['Coupons'], ...coupons.map(c=>[c.CouponCode,c.Value,c.Used,c.UsedBy]), [''],
      ['Transactions'], ...txs.map(t=>[t.Date,t.UserID,t.DealerID,t.Type,t.Amount,t.OrderID,t.OldBalance,t.NewBalance])
    ];
    exportCSV('export.csv', rows);
  };
}

function renderTable(sel, rows, cols, actionTpl){
  const tbody = qs(sel+' tbody');
  tbody.innerHTML='';
  rows.forEach(r=>{
    const tr = document.createElement('tr');
    const tds = cols.map(c=>`<td>${r[c]??''}</td>`).join('');
    const actions = actionTpl? `<td>${actionTpl(r)}</td>`:'';
    tr.innerHTML = tds + actions;
    tbody.appendChild(tr);
  });
}

async function addCouponSingle(e){
  e.preventDefault();
  const sess = await ensureAdmin(); if(!sess) return;
  const code = qs('#newCouponCode').value.trim();
  const value = Number(qs('#newCouponValue').value);
  await api('admin_add_coupon', { token: sess.token, coupon:{ CouponCode:code, Value:value } });
  alert('Coupon added'); location.reload();
}

async function bulkUploadCoupons(e){
  e.preventDefault();
  const sess = await ensureAdmin(); if(!sess) return;
  const codes = qs('#bulkCodes').value.split(/\s|,|\n/).map(x=>x.trim()).filter(Boolean);
  const value = Number(qs('#bulkValue').value);
  await api('admin_bulk_coupons', { token: sess.token, codes, value });
  alert('Bulk coupons added'); location.reload();
}

async function deleteCoupon(code){
  const sess = await ensureAdmin(); if(!sess) return;
  if(!confirm('Delete coupon '+code+'?')) return;
  await api('admin_delete_coupon', { token: sess.token, code });
  alert('Deleted'); location.reload();
}

async function addDealerQuick(){
  const sess = await ensureAdmin(); if(!sess) return;
  const DealerName = qs('#ad_name').value.trim();
  const Email = qs('#ad_email').value.trim();
  const Password = qs('#ad_pass').value.trim();
  if(!DealerName||!Email||!Password){ alert('Fill all'); return; }
  await api('admin_add_dealer', { token: sess.token, dealer:{ DealerName, Email, Password } });
  alert('Dealer added'); location.reload();
}

async function editDealer(id){
  const sess = await ensureAdmin(); if(!sess) return;
  const DealerName = prompt('New name (leave blank to keep)') || undefined;
  const Email = prompt('New email (leave blank to keep)') || undefined;
  const Password = prompt('New password (leave blank to keep)') || undefined;
  await api('admin_update_dealer', { token: sess.token, dealer:{ DealerID:id, DealerName, Email, Password } });
  alert('Updated'); location.reload();
}
async function deleteDealer(id){
  const sess = await ensureAdmin(); if(!sess) return;
  if(!confirm('Delete dealer '+id+'?')) return;
  await api('admin_delete_dealer', { token:sess.token, dealerId:id });
  alert('Deleted'); location.reload();
}

async function editUser(id){
  const sess = await ensureAdmin(); if(!sess) return;
  const Name = prompt('New name (blank = keep)') || undefined;
  const Email = prompt('New email (blank = keep)') || undefined;
  const Password = prompt('New password (blank = keep)') || undefined;
  const WalletPoints = prompt('New wallet points (blank = keep)');
  const payload = { UserID:id, Name, Email, Password };
  if(WalletPoints!==null && WalletPoints!=='') payload.WalletPoints = Number(WalletPoints);
  await api('admin_update_user', { token: sess.token, user: payload });
  alert('Updated'); location.reload();
}
async function deleteUser(id){
  const sess = await ensureAdmin(); if(!sess) return;
  if(!confirm('Delete user '+id+'?')) return;
  await api('admin_delete_user', { token:sess.token, userId:id });
  alert('Deleted'); location.reload();
}

function adminLogout(){ clearSession('admin'); location.href='admin-login.html'; }
