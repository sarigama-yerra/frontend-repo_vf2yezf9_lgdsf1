/* User module JS */
async function handleUserRegister(e){
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  const res = await api('user_register', payload);
  alert('Registered successfully. You can log in now.');
  location.href = 'user-login.html';
}

async function handleUserLogin(e){
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  const { data } = await api('user_login', payload);
  setSession('user', data.token, data.profile);
  location.href = 'user-dashboard.html';
}

async function renderUserDashboard(){
  const sess = getSession('user');
  if(!sess.token){ location.href='user-login.html'; return; }
  const { data } = await api('user_dashboard', { token: sess.token });
  qs('#wallet').textContent = data.walletPoints;
  const tbody = qs('#txBody');
  tbody.innerHTML='';
  data.transactions.slice(0,10).forEach(t=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${fmtDate(t.Date)}</td><td>${t.Type}</td><td>${t.Amount}</td><td>${t.OrderID||'-'}</td><td>${t.OldBalance}</td><td>${t.NewBalance}</td>`;
    tbody.appendChild(tr);
  });
}

async function redeemFromPage(e){
  e.preventDefault();
  const code = qs('#coupon').value.trim();
  const sess = getSession('user');
  if(!sess.token){ alert('Please log in first'); location.href='user-login.html'; return; }
  const { data } = await api('coupon_redeem', { token: sess.token, coupon: code });
  alert(`Redeemed +${data.value} points!`);
  location.href='user-dashboard.html';
}

function autofillCoupon(){
  const c = param('coupon');
  if(c) qs('#coupon').value = c;
}

function userLogout(){ clearSession('user'); location.href='user-login.html'; }
