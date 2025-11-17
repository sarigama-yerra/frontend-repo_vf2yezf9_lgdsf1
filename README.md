QR Coupon, Points Redemption, Dealer Validation & Admin Management (Serverless)

Overview
- Fully static frontend (HTML/CSS/JS). No Node/PHP backend required.
- Google Sheets + Google Apps Script provide the database and secure logic.
- Modules: User, Dealer, Admin.

Setup Steps (summary)
1) Make a Google Sheet with sheets:
   - Users: UserID | Name | Email | Password | WalletPoints
   - Coupons: CouponCode | Value | Used | UsedBy
   - Dealers: DealerID | DealerName | Email | Password
   - Transactions: Date | UserID | DealerID | Type | Amount | OrderID | OldBalance | NewBalance
   - Admin: AdminID | Username | Password
2) Open Apps Script, paste apps_script.gs, set SPREADSHEET_ID.
3) Deploy as Web App (execute as Me, accessible to Anyone with link). Copy the /exec URL.
4) Open the site and click "Set Backend URL" floating button to save your /exec link.
5) Use the app: register users, login, redeem coupons, dealer deductions, admin management.

Security Notes
- Uses Apps Script cache tokens to simulate sessions. Tokens expire after 24h (configurable).
- All admin/dealer actions validate tokens server-side.
- Prevents negative balances and coupon reuse.

QR Link Format
- https://yourdomain.com/redeem.html?coupon=ABC123

Hosting
- Any static hosting: GitHub Pages, Netlify, Vercel static, Google Drive web hosting.
