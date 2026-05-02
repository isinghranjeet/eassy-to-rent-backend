# Email Fix - Auth OTP Flow

## Steps (4/8) ✅

- [x] 1. Update sendEmail.js: detailed error logs + Gmail docs
- [x] 2. Update authController.js: try/catch + dev OTP fallback  
- [x] 3. Switched to sendOtpEmail() in login ✅ Better template
- [x] 4. Disabled legacy auth.js routes
- [ ] 5. Test SMTP: npm run dev → \"✅ SMTP Connected\" 
- [ ] 6. Test POST /login → OTP in email/console
- [ ] 7. Test POST /verify-login-otp → full login success
- [ ] 8. Prod checks (rate limits, queueing)

**Next: Add SMTP_EMAIL/SMTP_PASSWORD to .env then `npm run dev` in pg-finder-backend/**

## Setup Guide
```
SMTP_EMAIL=yourgmail@gmail.com
SMTP_PASSWORD=your-app-password (16 chars)
```
1. Enable 2FA on Gmail
2. Generate app password: myaccount.google.com/apppasswords  
3. Add to .env
4. `npm run dev` → \"✅ SMTP Connected\"

## Test
```bash
cd pg-finder-backend &amp;&amp; npm run dev
curl -X POST localhost:5000/api/auth/login -H "Content-Type: application/json" -d '{\"email\":\"test@ex.com\",\"password\":\"Test123!"}'
```

**Current progress: Starting step 1**
