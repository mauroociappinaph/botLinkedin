# LinkedIn Job Bot Troubleshooting Guide

## Common Issues and Solutions

### 1. Login Failed Error

**Symptoms:**
- "Login failed for unknown reason"
- "Search input not found on LinkedIn jobs page"

**Causes:**
- LinkedIn CAPTCHA challenges
- Two-factor authentication required
- Account security checks
- LinkedIn detecting automation

**Solutions:**

#### Option A: Manual Login (Recommended)
1. Run the bot with `npm start`
2. When login fails, the browser will stay open
3. Manually log in to LinkedIn in the browser window
4. Complete any CAPTCHA or 2FA challenges
5. The bot will detect successful login and continue

#### Option B: Use Debug Script
```bash
node debug-linkedin.js
```
This will help identify specific issues with selectors or login flow.

#### Option C: Clear Session and Retry
```bash
rm cookies.json
npm start
```

### 2. Search Input Not Found

**Symptoms:**
- "Search input not found on LinkedIn jobs page"
- Navigation errors

**Causes:**
- Not logged in to LinkedIn
- LinkedIn changed their page structure
- Page loading issues

**Solutions:**

1. **Ensure Login First:**
   - Make sure you're logged in to LinkedIn
   - Check if you're redirected to login page

2. **Update Selectors:**
   - LinkedIn frequently changes their HTML structure
   - The bot includes fallback selectors, but they may need updates

3. **Check Network Issues:**
   - Ensure stable internet connection
   - Try increasing timeout values in config.json

### 3. CAPTCHA Challenges

**Symptoms:**
- Login process stops
- Browser shows CAPTCHA challenge

**Solutions:**
1. The bot will automatically detect CAPTCHA
2. Solve the CAPTCHA manually in the browser
3. Press Enter in the terminal to continue
4. The bot will proceed after CAPTCHA is solved

### 4. Two-Factor Authentication

**Symptoms:**
- 2FA prompt appears during login

**Solutions:**
1. Complete 2FA in the browser window
2. Use your authenticator app or SMS code
3. Press Enter in terminal when done
4. Bot will continue automatically

### 5. Rate Limiting / Account Restrictions

**Symptoms:**
- Frequent login failures
- Account temporarily restricted messages

**Solutions:**
1. **Reduce Bot Activity:**
   - Increase delays in config.json
   - Reduce number of applications per session

2. **Use Different Approach:**
   - Run bot less frequently
   - Use manual login more often
   - Consider using different LinkedIn account for testing

### 6. Browser Issues

**Symptoms:**
- Browser crashes
- Page loading errors

**Solutions:**
1. **Update Dependencies:**
   ```bash
   npm update
   ```

2. **Clear Browser Data:**
   ```bash
   rm cookies.json
   rm -rf .cache
   ```

3. **Run in Non-Headless Mode:**
   - Set `"headless": false` in config.json
   - This helps with debugging

## Configuration Tips

### Recommended Settings for Stability

```json
{
  "browser": {
    "headless": false,
    "slowMo": 200,
    "timeout": 60000
  },
  "delays": {
    "minPageLoad": 3000,
    "maxPageLoad": 6000,
    "minTyping": 100,
    "maxTyping": 200
  }
}
```

### Environment Variables

Make sure your `.env` file has correct credentials:
```
LINKEDIN_EMAIL=your-email@example.com
LINKEDIN_PASSWORD=your-password
DATABASE_URL="file:./jobs.db"
```

## Debug Commands

### 1. Test Login Only
```bash
node debug-linkedin.js
```

### 2. Test Full Flow
```bash
node test-login-fix.js
```

### 3. Check Database
```bash
npx prisma studio
```

### 4. View Logs
```bash
tail -f logs/linkedin-bot.log
```

## Getting Help

If issues persist:

1. **Check Logs:** Look in the `logs/` directory for detailed error information
2. **Take Screenshots:** The debug script saves screenshots for analysis
3. **Update Selectors:** LinkedIn changes their HTML frequently
4. **Consider Manual Approach:** Sometimes manual login is the most reliable option

## Prevention Tips

1. **Regular Updates:** Keep the bot updated with latest LinkedIn changes
2. **Gentle Usage:** Don't run the bot too frequently
3. **Monitor Logs:** Check logs regularly for early warning signs
4. **Backup Sessions:** Keep successful login sessions saved
5. **Test Environment:** Use a test LinkedIn account when possible

## LinkedIn Policy Compliance

Remember to:
- Respect LinkedIn's Terms of Service
- Use reasonable delays between actions
- Don't spam applications
- Monitor your account for any restrictions
- Consider LinkedIn's official API for production use
