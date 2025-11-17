/* Dealer module JS */
async function handleDealerLogin(e){
  e.preventDefault();
  const fd = new FormData(e.target);
  const payload = Object.fromEntries(fd.entries());
  const { data } = await api('dealer_login', payload);
  setSession('dealer', data.token, data.profile);
  location.href = 'dealer-dashboard.html';
}

async function fetchUserWallet(e){
  e.preventDefault();
  const sess = getSession('dealer');
  if(!sess.token){ location.href='dealer-login.html'; return; }
  const userId = qs('#lookupUserId').value.trim();
  const { data } = await api('dealer_fetch_wallet', { token: sess.token, userId });
  qs('#oldBalance').textContent = data.walletPoints;
  qs('#newBalance').textContent = data.walletPoints; // default before deduction
}

async function dealerDeduct(e){
  e.preventDefault();
  const sess = getSession('dealer');
  if(!sess.token){ location.href='dealer-login.html'; return; }
  const userId = qs('#lookupUserId').value.trim();
  const amount = Number(qs('#deductAmount').value);
  const orderId = qs('#orderId').value.trim();
  const { data } = await api('dealer_deduct', { token: sess.token, userId, amount, orderId });
  qs('#oldBalance').textContent = data.oldBalance;
  qs('#newBalance').textContent = data.newBalance;
  alert('Deduction recorded.');
}

function dealerLogout(){ clearSession('dealer'); location.href='dealer-login.html'; }
