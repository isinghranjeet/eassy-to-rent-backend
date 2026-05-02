# Email Setup Guide - PG Finder Backend

## Gmail Configuration (Recommended)

### 1. Enable 2-Factor Authentication
- Go to [Google Account](https://myaccount.google.com/security)
- Enable 2-Step Verification

### 2. Generate App Password
```
1. https://myaccount.google.com/apppasswords
2. Select "Mail" → "Other" 
3. Name: "PG Finder Backend"
4. Copy 16-character password 
```

### 3. .env Configuration
```env
SMTP_EMAIL=your-verified-gmail@gmail.com
SMTP_PASSWORD=abcd efgh ijkl mnop  # 16-char app password
NODE_ENV=development
```

### 4. Test Connection
```bash
cd pg-finder-backend
npm run dev
```
✅ Look for: `SMTP Connected Successfully`

### 5. Test OTP Flow
```bash
curl -X POST http://localhost:5000/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{
    "email": "test@example.com", 
    "password": "TestPass123!"
  }'
```

**Troubleshooting:**
```
❌ "SMTP Connection Error: 535-5.7.8" → Wrong app password
❌ "ECONNREFUSED" → Check internet/firewall  
❌ No logs → Check .env loaded (console.log(process.env.SMTP_EMAIL))
```

**Production:** Use SendGrid/SES for scale (see @sendgrid/mail dependency)
