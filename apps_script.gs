/* Google Apps Script backend for QR Coupon, Points Redemption, Dealer Validation & Admin Management System
   Sheets required (single spreadsheet):
   Users:         UserID | Name | Email | Password | WalletPoints
   Coupons:       CouponCode | Value | Used | UsedBy
   Dealers:       DealerID | DealerName | Email | Password
   Transactions:  Date | UserID | DealerID | Type | Amount | OrderID | OldBalance | NewBalance
   Admin:         AdminID | Username | Password
*/

const CONFIG = {
  SPREADSHEET_ID: 'PUT_YOUR_SPREADSHEET_ID_HERE', // set after copying template
  TOKEN_TTL_MS: 1000*60*60*24, // 24h
};

function doGet(e){
  return ContentService.createTextOutput('OK');
}

function doPost(e){
  try{
    const req = JSON.parse(e.postData.contents||'{}');
    const { action, payload } = req;
    const result = router(action, payload||{});
    return json({ ok:true, data: result });
  }catch(err){
    return json({ ok:false, message: String(err) });
  }
}

function json(obj){
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function ss(){
  return SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
}

function sh(name){
  const s = ss().getSheetByName(name); if(!s) throw new Error('Missing sheet '+name); return s;
}

function readTable(name){
  const sheet = sh(name);
  const range = sheet.getDataRange();
  const values = range.getValues();
  const headers = values.shift();
  return values.filter(r=>r.join('').length).map(row=>{
    const obj={}; headers.forEach((h,i)=>obj[String(h)] = row[i]); return obj;
  });
}

function writeTable(name, rows){
  const sheet = sh(name);
  sheet.clearContents();
  if(!rows.length){ return; }
  const headers = Object.keys(rows[0]);
  sheet.getRange(1,1,1,headers.length).setValues([headers]);
  const data = rows.map(r=>headers.map(h=>r[h]));
  sheet.getRange(2,1,data.length,headers.length).setValues(data);
}

// simplistic token store in memory cache - for production consider PropertiesService
function makeToken(prefix, id){
  const t = prefix+"_"+id+"_"+Utilities.getUuid();
  CacheService.getScriptCache().put(t, String(Date.now()+CONFIG.TOKEN_TTL_MS), CONFIG.TOKEN_TTL_MS/1000);
  return t;
}
function checkToken(token){
  const exp = CacheService.getScriptCache().get(token);
  if(!exp) return false; if(Number(exp) < Date.now()) return false; return true;
}

function router(action, p){
  switch(action){
    // User
    case 'user_register': return userRegister(p);
    case 'user_login': return userLogin(p);
    case 'user_dashboard': return userDashboard(p);
    case 'coupon_redeem': return couponRedeem(p);

    // Dealer
    case 'dealer_login': return dealerLogin(p);
    case 'dealer_fetch_wallet': return dealerFetchWallet(p);
    case 'dealer_deduct': return dealerDeduct(p);

    // Admin auth + reads
    case 'admin_login': return adminLogin(p);
    case 'admin_get_users': return adminGetUsers(p);
    case 'admin_get_dealers': return adminGetDealers(p);
    case 'admin_get_coupons': return adminGetCoupons(p);
    case 'admin_get_transactions': return adminGetTransactions(p);

    // Admin coupon mgmt
    case 'admin_add_coupon': return adminAddCoupon(p);
    case 'admin_bulk_coupons': return adminBulkCoupons(p);
    case 'admin_delete_coupon': return adminDeleteCoupon(p);

    // Admin user mgmt
    case 'admin_add_user': return adminAddUser(p);
    case 'admin_update_user': return adminUpdateUser(p);
    case 'admin_delete_user': return adminDeleteUser(p);

    // Admin dealer mgmt
    case 'admin_add_dealer': return adminAddDealer(p);
    case 'admin_update_dealer': return adminUpdateDealer(p);
    case 'admin_delete_dealer': return adminDeleteDealer(p);

    // Admin settings
    case 'admin_change_password': return adminChangePassword(p);
    case 'admin_reset': return adminReset(p);

    default: throw new Error('Unknown action');
  }
}

// Helpers
function nextId(prefix, existing, field){
  const nums = existing.map(r=>String(r[field]||'').replace(/\D/g,'')).map(x=>Number(x||0));
  const max = Math.max(0, ...nums);
  return prefix + String(max+1).padStart(3,'0');
}

// User flows
function userRegister(p){
  const { name, email, password } = p;
  if(!name||!email||!password) throw new Error('Missing fields');
  const users = readTable('Users');
  if(users.some(u=>String(u.Email).toLowerCase()===String(email).toLowerCase())) throw new Error('Email exists');
  const id = nextId('U', users, 'UserID');
  users.push({ UserID:id, Name:name, Email:email, Password:password, WalletPoints:0 });
  writeTable('Users', users);
  return { UserID:id };
}

function userLogin(p){
  const { email, password } = p;
  const users = readTable('Users');
  const u = users.find(x=>String(x.Email).toLowerCase()===String(email).toLowerCase() && String(x.Password)===String(password));
  if(!u) throw new Error('Invalid credentials');
  const token = makeToken('USER', u.UserID);
  return { token, profile: { UserID:u.UserID, Name:u.Name, Email:u.Email } };
}

function requireUser(token){ if(!checkToken(token)) throw new Error('Unauthorized'); }

function userDashboard(p){
  const { token } = p; requireUser(token);
  const users = readTable('Users');
  const tx = readTable('Transactions');
  const userId = token.split('_')[1];
  const u = users.find(r=>r.UserID===userId); if(!u) throw new Error('User missing');
  const transactions = tx.filter(t=>String(t.UserID)===String(userId)).sort((a,b)=> new Date(b.Date)-new Date(a.Date));
  return { walletPoints: Number(u.WalletPoints||0), transactions };
}

function couponRedeem(p){
  const { token, coupon } = p; requireUser(token);
  const userId = token.split('_')[1];
  const coupons = readTable('Coupons');
  const users = readTable('Users');
  const c = coupons.find(x=>String(x.CouponCode)===String(coupon));
  if(!c) throw new Error('Invalid coupon');
  if(String(c.Used).toLowerCase()==='yes') throw new Error('Already used');
  const value = Number(c.Value||0);
  const u = users.find(r=>r.UserID===userId); if(!u) throw new Error('User missing');
  const oldBal = Number(u.WalletPoints||0);
  const newBal = oldBal + value;
  // mark coupon used and update user balance
  c.Used = 'Yes'; c.UsedBy = userId;
  u.WalletPoints = newBal;
  writeTable('Coupons', coupons);
  writeTable('Users', users);
  // log transaction
  const tx = readTable('Transactions');
  tx.push({ Date: new Date(), UserID:userId, DealerID:'', Type:'CREDIT', Amount:value, OrderID:'', OldBalance:oldBal, NewBalance:newBal });
  writeTable('Transactions', tx);
  return { value, newBalance:newBal };
}

// Dealer flows
function dealerLogin(p){
  const { email, password } = p;
  const dealers = readTable('Dealers');
  const d = dealers.find(x=>String(x.Email).toLowerCase()===String(email).toLowerCase() && String(x.Password)===String(password));
  if(!d) throw new Error('Invalid credentials');
  const token = makeToken('DEALER', d.DealerID);
  return { token, profile: { DealerID:d.DealerID, DealerName:d.DealerName, Email:d.Email } };
}
function requireDealer(token){ if(!checkToken(token)) throw new Error('Unauthorized'); }

function dealerFetchWallet(p){
  const { token, userId } = p; requireDealer(token);
  const users = readTable('Users');
  const u = users.find(r=>r.UserID===userId); if(!u) throw new Error('User not found');
  return { walletPoints:Number(u.WalletPoints||0) };
}

function dealerDeduct(p){
  const { token, userId, amount, orderId } = p; requireDealer(token);
  const dealerId = token.split('_')[1];
  const users = readTable('Users');
  const u = users.find(r=>r.UserID===userId); if(!u) throw new Error('User not found');
  const amt = Number(amount||0); if(!(amt>0)) throw new Error('Amount must be positive');
  const oldBal = Number(u.WalletPoints||0);
  if(oldBal < amt) throw new Error('Insufficient balance');
  const newBal = oldBal - amt; u.WalletPoints = newBal; writeTable('Users', users);
  const tx = readTable('Transactions');
  tx.push({ Date:new Date(), UserID:userId, DealerID:dealerId, Type:'DEBIT', Amount:amt, OrderID:orderId||'', OldBalance:oldBal, NewBalance:newBal });
  writeTable('Transactions', tx);
  return { oldBalance:oldBal, newBalance:newBal };
}

// Admin flows
function adminLogin(p){
  const { username, password } = p;
  const admin = readTable('Admin');
  const a = admin.find(x=>String(x.Username)===String(username) && String(x.Password)===String(password));
  if(!a) throw new Error('Invalid admin credentials');
  const token = makeToken('ADMIN', a.AdminID);
  return { token, profile:{ AdminID:a.AdminID, Username:a.Username } };
}
function requireAdmin(token){ if(!checkToken(token)) throw new Error('Unauthorized'); }

// basic reads
function adminGetUsers(p){ requireAdmin(p.token); return readTable('Users'); }
function adminGetDealers(p){ requireAdmin(p.token); return readTable('Dealers'); }
function adminGetCoupons(p){ requireAdmin(p.token); return readTable('Coupons'); }
function adminGetTransactions(p){ requireAdmin(p.token); return readTable('Transactions'); }

// coupon mgmt
function adminAddCoupon(p){
  const { token, coupon } = p; requireAdmin(token);
  const coupons = readTable('Coupons');
  if(coupons.some(c=>String(c.CouponCode)===String(coupon.CouponCode))) throw new Error('Duplicate coupon');
  coupons.push({ CouponCode:coupon.CouponCode, Value:Number(coupon.Value||0), Used:'No', UsedBy:'' });
  writeTable('Coupons', coupons);
  return { ok:true };
}
function adminBulkCoupons(p){
  const { token, codes, value } = p; requireAdmin(token);
  const coupons = readTable('Coupons');
  const existing = new Set(coupons.map(c=>String(c.CouponCode)));
  codes.forEach(code=>{ if(!existing.has(String(code))) coupons.push({ CouponCode:String(code), Value:Number(value||0), Used:'No', UsedBy:'' }) });
  writeTable('Coupons', coupons); return { count: codes.length };
}
function adminDeleteCoupon(p){
  const { token, code } = p; requireAdmin(token);
  let coupons = readTable('Coupons');
  const before = coupons.length;
  coupons = coupons.filter(c=>String(c.CouponCode)!==String(code));
  if(coupons.length===before) throw new Error('Coupon not found');
  writeTable('Coupons', coupons); return { ok:true };
}

// user mgmt
function adminAddUser(p){
  const { token, user } = p; requireAdmin(token);
  const users = readTable('Users');
  if(users.some(u=>String(u.Email).toLowerCase()===String(user.Email).toLowerCase())) throw new Error('Email exists');
  const id = nextId('U', users, 'UserID');
  users.push({ UserID:id, Name:user.Name||'', Email:user.Email||'', Password:user.Password||'', WalletPoints:Number(user.WalletPoints||0) });
  writeTable('Users', users); return { UserID:id };
}
function adminUpdateUser(p){
  const { token, user } = p; requireAdmin(token);
  const users = readTable('Users');
  const idx = users.findIndex(u=>String(u.UserID)===String(user.UserID)); if(idx<0) throw new Error('User not found');
  // check email uniqueness if changed
  if(user.Email && users.some((u,i)=>i!==idx && String(u.Email).toLowerCase()===String(user.Email).toLowerCase())) throw new Error('Email exists');
  users[idx].Name = user.Name ?? users[idx].Name;
  users[idx].Email = user.Email ?? users[idx].Email;
  users[idx].Password = user.Password ?? users[idx].Password;
  if(user.WalletPoints!==undefined){ const wp = Number(user.WalletPoints); if(wp<0) throw new Error('Negative balance not allowed'); users[idx].WalletPoints = wp; }
  writeTable('Users', users); return { ok:true };
}
function adminDeleteUser(p){
  const { token, userId } = p; requireAdmin(token);
  let users = readTable('Users');
  const before = users.length; users = users.filter(u=>String(u.UserID)!==String(userId));
  if(users.length===before) throw new Error('User not found');
  writeTable('Users', users); return { ok:true };
}

// dealer mgmt
function adminAddDealer(p){
  const { token, dealer } = p; requireAdmin(token);
  const dealers = readTable('Dealers');
  if(dealers.some(d=>String(d.Email).toLowerCase()===String(dealer.Email).toLowerCase())) throw new Error('Email exists');
  const id = nextId('D', dealers, 'DealerID');
  dealers.push({ DealerID:id, DealerName:dealer.DealerName||'', Email:dealer.Email||'', Password:dealer.Password||'' });
  writeTable('Dealers', dealers); return { DealerID:id };
}
function adminUpdateDealer(p){
  const { token, dealer } = p; requireAdmin(token);
  const dealers = readTable('Dealers');
  const idx = dealers.findIndex(d=>String(d.DealerID)===String(dealer.DealerID)); if(idx<0) throw new Error('Dealer not found');
  if(dealer.Email && dealers.some((d,i)=>i!==idx && String(d.Email).toLowerCase()===String(dealer.Email).toLowerCase())) throw new Error('Email exists');
  dealers[idx].DealerName = dealer.DealerName ?? dealers[idx].DealerName;
  dealers[idx].Email = dealer.Email ?? dealers[idx].Email;
  dealers[idx].Password = dealer.Password ?? dealers[idx].Password;
  writeTable('Dealers', dealers); return { ok:true };
}
function adminDeleteDealer(p){
  const { token, dealerId } = p; requireAdmin(token);
  let dealers = readTable('Dealers');
  const before = dealers.length; dealers = dealers.filter(d=>String(d.DealerID)!==String(dealerId));
  if(dealers.length===before) throw new Error('Dealer not found');
  writeTable('Dealers', dealers); return { ok:true };
}

// admin settings
function adminChangePassword(p){
  const { token, newPassword } = p; requireAdmin(token);
  if(!newPassword) throw new Error('Missing new password');
  const admin = readTable('Admin');
  const adminId = token.split('_')[1];
  const idx = admin.findIndex(a=>String(a.AdminID)===String(adminId)); if(idx<0) throw new Error('Admin not found');
  admin[idx].Password = newPassword;
  writeTable('Admin', admin); return { ok:true };
}

function adminReset(p){
  const { token } = p; requireAdmin(token);
  const tx = [];
  writeTable('Transactions', tx);
  return { ok:true };
}
