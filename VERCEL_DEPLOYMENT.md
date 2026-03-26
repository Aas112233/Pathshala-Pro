# Vercel Deployment Guide - Pathshala Pro

## Quick Deploy (15 minutes)

### Step 1: Push to GitHub
Make sure your code is pushed to GitHub:
```bash
git add .
git commit -m "Prepare for Vercel deployment"
git push origin main
```

### Step 2: Connect to Vercel

1. Go to [vercel.com](https://vercel.com)
2. Sign in with GitHub
3. Click **"New Project"**
4. Import your GitHub repository
5. Click **"Import"**

### Step 3: Configure Environment Variables

In the Vercel dashboard, add these environment variables:

| Variable | Value |
|----------|-------|
| `DATABASE_URL` | Your MongoDB Atlas connection string |
| `NEXTAUTH_URL` | Your production URL (e.g., `https://your-app.vercel.app`) |
| `NEXTAUTH_SECRET` | Generate with: `openssl rand -base64 32` |
| `R2_ACCOUNT_ID` | Your Cloudflare R2 Account ID |
| `R2_ACCESS_KEY_ID` | Your R2 Access Key ID |
| `R2_SECRET_ACCESS_KEY` | Your R2 Secret Access Key |
| `R2_BUCKET_NAME` | Your R2 Bucket Name |
| `R2_PUBLIC_DOMAIN` | Your R2 Public Domain |

### Step 4: Deploy
Click **"Deploy"** - Vercel will build and deploy your app automatically!

---

## Environment Variable Setup

### Generate NEXTAUTH_SECRET
Run this command locally:
```bash
openssl rand -base64 32
```
Copy the output and use it as `NEXTAUTH_SECRET`.

### MongoDB Connection String
Your `DATABASE_URL` should look like:
```
mongodb+srv://username:password@cluster.mongodb.net/database?retryWrites=true&w=majority
```

### NEXTAUTH_URL
- **Development**: `http://localhost:3000`
- **Production**: `https://your-app.vercel.app`

---

## Post-Deployment

### 1. Update NEXTAUTH_URL
After first deployment, update `NEXTAUTH_URL` with your Vercel URL.

### 2. Configure MongoDB Atlas
1. Go to [MongoDB Atlas](https://cloud.mongodb.com)
2. Network Access → Add IP Address
3. Add `0.0.0.0/0` (allow all) OR Vercel's IPs
4. Save changes

### 3. Test Your App
- Visit your Vercel URL
- Try logging in
- Verify database connections

---

## Custom Domain (Optional)

1. Go to Vercel Project → Settings → Domains
2. Add your custom domain
3. Update DNS records as instructed
4. Update `NEXTAUTH_URL` with your custom domain

---

## Troubleshooting

### Build Fails
- Check Vercel build logs
- Ensure all dependencies are in `package.json`
- Run `npm run build` locally first

### Runtime Errors
- Check Vercel Function logs
- Verify environment variables
- Check MongoDB Atlas network access

### Authentication Issues
- Ensure `NEXTAUTH_SECRET` is set
- Verify `NEXTAUTH_URL` matches your domain
- Check MongoDB connection

---

## Vercel CLI (Optional)

For local testing and advanced deployments:

```bash
# Install Vercel CLI
npm i -g vercel

# Login
vercel login

# Link project
vercel link

# Deploy preview
vercel

# Deploy production
vercel --prod
```

---

## Pricing

- **Hobby**: Free (perfect for development)
- **Pro**: $20/month (for production features)
- **Enterprise**: Custom

See [vercel.com/pricing](https://vercel.com/pricing) for details.

---

## Resources

- [Vercel Next.js Docs](https://vercel.com/docs/frameworks/nextjs)
- [Environment Variables](https://vercel.com/docs/concepts/projects/environment-variables)
- [MongoDB Atlas](https://www.mongodb.com/docs/atlas/)
- [NextAuth.js](https://next-auth.js.org/)
