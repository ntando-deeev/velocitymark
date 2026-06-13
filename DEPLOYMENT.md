# VelocityMark Deployment Guide

Complete step-by-step guide to deploy **VelocityMark** on Render (free or paid tiers).

## 🎯 Deployment Options

### Option 1: Deploy from GitHub (Recommended)
Perfect for continuous deployment with auto-updates.

### Option 2: Deploy from Git Repo
Works with GitHub, GitLab, or any Git provider.

### Option 3: Local Deployment
For testing before going live.

---

## 📋 Prerequisites

- [ ] GitHub account (or GitLab/Gitea)
- [ ] Render account (free at [render.com](https://render.com))
- [ ] Node.js 18+ installed locally (for testing)
- [ ] VelocityMark source code

---

## 🚀 Quick Deploy (5 Minutes)

### Step 1: Push to GitHub

```bash
# Initialize git repo (if not already)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: VelocityMark platform"

# Create repo on GitHub and push
git remote add origin https://github.com/yourusername/velocitymark.git
git branch -M main
git push -u origin main
```

### Step 2: Connect to Render

1. Go to [render.com](https://render.com)
2. Sign in with GitHub
3. Click "New +" → "Web Service"
4. Select your `velocitymark` repository
5. Fill in the form:
   - **Name**: `velocitymark` (or your preference)
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: `Free` (or Pro for better performance)

6. Click "Create Web Service"

**That's it!** Render will:
- Build your app (1-2 minutes)
- Deploy it (30 seconds)
- Give you a public URL

### Step 3: Get Your Live URL

```
https://velocitymark-xxxxx.onrender.com
```

You'll receive this in your Render dashboard.

---

## 🔧 Advanced Configuration

### Set Environment Variables

In Render Dashboard:

1. Go to your service
2. Click "Environment"
3. Add variables:

```
NODE_ENV=production
PORT=3000
ALLOWED_ORIGINS=*
```

### Enable Auto-Deploy from GitHub

1. In your Render service, go to "Settings"
2. Under "Deploy Hooks", enable "Auto-Deploy on Push"
3. Now every push to `main` automatically deploys

### Custom Domain Setup

1. In Render Dashboard → Your Service → "Settings"
2. Under "Custom Domains", add your domain
3. Follow DNS instructions for your domain provider

Example DNS record:
```
CNAME: velocitymark.yourdomain.com → velocitymark-xxxxx.onrender.com
```

---

## 🔐 Production Checklist

Before going live, verify:

- [ ] Environment set to `production`
- [ ] All secrets configured (if any)
- [ ] Error logging enabled
- [ ] Performance settings optimized
- [ ] Security headers enabled (already in place)
- [ ] CORS configured for your domain
- [ ] Backups configured (if using database)

---

## 📊 Performance Optimization

### For Free Tier

```
- 512 MB RAM
- 0.5 CPU
- ~500 requests/minute recommended
- Auto-sleeps after 15 minutes of inactivity
```

### Upgrade to Pro for:
- Always-on instances
- Higher memory/CPU
- Priority support
- Custom domains included

### Optimization Tips

1. **Enable Compression** (✅ Already enabled)
2. **Cache Static Assets**:
   ```javascript
   app.use(express.static('public', {
     maxAge: '1h'
   }));
   ```

3. **Add CDN**: Use Cloudflare free tier
4. **Minify CSS/JS**: For production builds
5. **Database Optimization**: If using database

---

## 🐛 Troubleshooting

### App Fails to Start

**Error**: `Cannot find module 'express'`

**Solution**:
```bash
# Verify build logs in Render dashboard
# Re-run build
git push origin main

# Or manually trigger:
# In Render dashboard → Service → "Manual Deploy"
```

### Port Issues

**Error**: `Port already in use` or `EADDRINUSE`

**Solution**: Render sets PORT automatically. Don't hardcode it:
```javascript
// ✅ Correct
const PORT = process.env.PORT || 3000;

// ❌ Wrong
const PORT = 3000;
```

### Slow Loading

**Solutions**:
1. Upgrade to Render Pro
2. Add CloudFlare CDN (free)
3. Enable compression (✅ Done)
4. Optimize images

### Custom Domain Not Working

**Steps**:
1. Verify DNS records are correct
2. Wait 24-48 hours for DNS propagation
3. Check domain provider settings
4. Test with: `dig yourdomain.com`

### Environment Variables Not Working

**Fix**:
1. Verify variable names match code
2. Restart service after adding variables
3. Check for typos (case-sensitive)
4. Verify format: `KEY=value` (no quotes in Render UI)

---

## 🚀 Deployment Scenarios

### Scenario 1: Simple Update

```bash
git add .
git commit -m "Update services"
git push origin main
# Auto-deploys to Render in ~2 minutes
```

### Scenario 2: Multiple Environments

**Production** (main branch):
```
https://velocitymark.onrender.com
```

**Staging** (staging branch):
```
Create second web service with staging branch
https://velocitymark-staging.onrender.com
```

### Scenario 3: Custom Domain

**Setup**:
1. Buy domain on Namecheap, GoDaddy, etc.
2. Add to Render dashboard
3. Point DNS CNAME to Render
4. Done! HTTPS automatic

---

## 📈 Monitoring & Logs

### View Logs

1. Render Dashboard → Your Service → "Logs"
2. Real-time logs appear automatically
3. Filter by type: Error, Info, Warning

### Common Log Messages

```
✓ Build succeeded
✓ Successfully deployed
✓ Server running on port 3000
📧 Received lead from john@example.com
```

---

## 🔄 CI/CD Pipeline

GitHub Actions automatically:

1. **Tests** your code on every push
2. **Checks** for vulnerabilities
3. **Deploys** to Render on merge to main

View workflow status:
- GitHub Repo → "Actions" tab
- See build/deploy history

---

## 💾 Backups & Data

### Current Setup (Stateless)

VelocityMark is stateless - no persistent data. Perfect for:
- Scalability
- Reliability
- Easy deployment

### To Add Database:

1. Create MongoDB Atlas (free tier)
2. Add connection string to Render environment
3. Update `server.js` to connect
4. Deploy

---

## 🎓 Learning Resources

### Render Docs
- [Render Deployment Guide](https://render.com/docs)
- [Environment Variables](https://render.com/docs/environment-variables)
- [Custom Domains](https://render.com/docs/custom-domains)

### Node.js/Express
- [Express.js Docs](https://expressjs.com/)
- [Node.js Best Practices](https://nodejs.org/en/docs/)

### DevOps/Deployment
- [GitHub Actions](https://github.com/features/actions)
- [Docker (Advanced)](https://www.docker.com/)

---

## ✅ Post-Deployment Checklist

- [ ] Site loads without errors
- [ ] All pages responsive on mobile
- [ ] Contact form works
- [ ] Newsletter subscription works
- [ ] APIs respond correctly
- [ ] Performance acceptable (<2s load)
- [ ] HTTPS working
- [ ] Custom domain configured
- [ ] Monitoring/logs working
- [ ] Backup plan in place

---

## 📞 Support

- **Render Issues**: Check [Status](https://status.render.com/)
- **Code Issues**: Review `DEPLOYMENT.md` and `README.md`
- **Questions**: Refer to Render documentation

---

## 🎉 You're Live!

Your VelocityMark platform is now live and serving global customers.

**Next Steps**:
1. Share your URL with clients
2. Monitor performance
3. Gather feedback
4. Iterate and improve
5. Scale as needed

---

**VelocityMark** - Deployed with ❤️ on Render

Created by Mr Ntando Ofc | Global Marketing Platform
