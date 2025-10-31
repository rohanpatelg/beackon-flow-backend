# Supabase OAuth Setup Guide

This guide walks you through setting up Supabase authentication with LinkedIn OAuth for the Beacon Flow application.

## Prerequisites

- Supabase account (https://supabase.com)
- LinkedIn Developer account (https://www.linkedin.com/developers/)
- LinkedIn app created with OAuth credentials

## Part 1: Supabase Configuration

### 1. Get Supabase Credentials

1. Go to your Supabase project dashboard: https://supabase.com/dashboard/project/_/settings/api
2. Copy the following credentials:
   - **Project URL** (e.g., `https://xxxxx.supabase.co`)
   - **Anon (public) key** - for mobile app
   - **Service role key** - for backend (⚠️ Keep this secret!)

### 2. Configure LinkedIn OAuth Provider in Supabase

1. Go to: https://supabase.com/dashboard/project/_/auth/providers
2. Find **LinkedIn (OIDC)** in the providers list
3. Click to expand and configure:

   **Enable LinkedIn (OIDC):** Toggle ON

   **LinkedIn Client ID:** Your LinkedIn app's Client ID

   **LinkedIn Client Secret:** Your LinkedIn app's Client Secret

   **Redirect URL:** Copy the Supabase callback URL shown (format: `https://your-project.supabase.co/auth/v1/callback`)

4. Click **Save**

### 3. Configure LinkedIn App

1. Go to LinkedIn Developer Portal: https://www.linkedin.com/developers/apps
2. Select your app
3. Go to **Auth** tab
4. Add the Supabase redirect URL to **Authorized redirect URLs for your app**:
   ```
   https://your-project.supabase.co/auth/v1/callback
   ```
5. Under **OAuth 2.0 scopes**, ensure these are enabled:
   - `openid` (required)
   - `profile` (required)
   - `email` (required)
   - `w_member_social` (required for posting to LinkedIn)

6. Click **Update**

## Part 2: Backend Configuration

### 1. Update Environment Variables

Edit `beackon-flow-backend/.env`:

```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Database Configuration (if using Supabase PostgreSQL)
DATABASE_URL="postgresql://postgres:password@db.xxxxx.supabase.co:5432/postgres"
```

**⚠️ Important:**
- Replace `your-project.supabase.co` with your actual Supabase project URL
- Replace `your_service_role_key_here` with your actual service role key
- Update the database URL with your Supabase database credentials

### 2. Clean Up Old Tables (Optional)

If you had previously created custom LinkedIn OAuth tables, run the cleanup script:

```bash
# In Supabase SQL Editor, run:
cat tables/cleanup_custom_linkedin_tables.sql
```

This will remove `linkedin_auth_sessions` and `linkedin_tokens` tables, which are no longer needed.

### 3. Install Dependencies & Start Backend

```bash
cd beackon-flow-backend
npm install
npm run dev
```

The backend should start on port 8080.

## Part 3: Mobile App Configuration

### 1. Update Environment Variables

Edit `Syd-n8n/.env`:

```bash
# Backend API URL
EXPO_PUBLIC_API_URL=http://localhost:8080/api

# Supabase Configuration
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

**⚠️ Important:**
- Use the **Anon key** (not the service role key)
- For physical device testing, replace `localhost` with your computer's IP address

### 2. Configure Deep Linking (Expo)

The app uses the URI scheme `beaconflow://` for OAuth callbacks. This is already configured in:
- `app.json` (scheme property)
- `settings.tsx` (redirect URL)

No additional changes needed unless you want to customize the scheme.

### 3. Install Dependencies & Start App

```bash
cd Syd-n8n
npm install
npm start
```

## Part 4: Testing the Integration

### 1. Test LinkedIn Sign-In

1. Open the mobile app
2. Navigate to **Settings** tab
3. Click **Sign in with LinkedIn**
4. You should be redirected to LinkedIn OAuth page
5. Authorize the app
6. You should be redirected back to the app and see your profile info

### 2. Verify Session Storage

The Supabase session is automatically stored in AsyncStorage and will persist across app restarts.

### 3. Test LinkedIn Posting

1. Make sure you're signed in
2. Navigate to a screen where you can create a post
3. Create and publish a post
4. The backend will use your provider token to publish to LinkedIn

### 4. Check Backend Logs

In the backend terminal, you should see:
```
✅ Supabase client initialized
POST /api/linkedin/publish - User authenticated
LinkedIn post published successfully
```

## Part 5: Troubleshooting

### Issue: "Not authenticated" error

**Solution:**
- Check that `EXPO_PUBLIC_SUPABASE_ANON_KEY` is set correctly in mobile app `.env`
- Restart the Expo dev server after changing `.env`
- Try signing out and signing in again

### Issue: "LinkedIn access token not found"

**Solution:**
- LinkedIn provider token is only available after successful OAuth
- Make sure `w_member_social` scope is enabled in LinkedIn app settings
- Try signing out and signing in again to refresh the token

### Issue: "Invalid or expired token" from backend

**Solution:**
- Check that `SUPABASE_SERVICE_ROLE_KEY` is set correctly in backend `.env`
- Verify the backend is using the same Supabase project URL as the mobile app
- Check backend logs for detailed error messages

### Issue: OAuth redirect not working

**Solution:**
- Verify the Supabase callback URL is added to LinkedIn app's authorized redirect URLs
- Make sure the URL format is exactly: `https://your-project.supabase.co/auth/v1/callback`
- Check that the app scheme `beaconflow://` is configured correctly in `app.json`

### Issue: "Provider token not found" when publishing

**Solution:**
- The provider token is only available immediately after OAuth
- Supabase may not persist provider tokens across sessions
- If token is missing, user needs to sign in again
- Consider implementing token refresh logic if needed

## Architecture Overview

### How It Works

1. **Mobile App** initiates LinkedIn OAuth via Supabase client:
   ```typescript
   supabase.auth.signInWithOAuth({ provider: 'linkedin_oidc' })
   ```

2. **Supabase** handles the OAuth flow:
   - Redirects to LinkedIn
   - Receives authorization code
   - Exchanges for access token
   - Creates user session
   - Stores provider token

3. **Mobile App** receives session:
   - Session stored in AsyncStorage
   - Auto-refresh enabled
   - Provider token available in `session.provider_token`

4. **Backend** validates requests:
   - Mobile app sends `Authorization: Bearer <supabase_access_token>`
   - Backend middleware validates with Supabase
   - Extracts user info from token

5. **LinkedIn API calls**:
   - Mobile app sends provider token in request body
   - Backend uses provider token to call LinkedIn API
   - No need for backend to manage OAuth tokens

### Key Files

**Backend:**
- `src/config/supabase.ts` - Supabase admin client
- `src/middlewares/supabaseAuth.ts` - Token validation middleware
- `src/controllers/linkedinController.ts` - LinkedIn publishing logic
- `src/routes/linkedinRoutes.ts` - API routes

**Mobile App:**
- `services/supabase.ts` - Supabase client configuration
- `services/api.ts` - API client with Supabase integration
- `app/(tabs)/settings.tsx` - OAuth sign-in UI
- `.env` - Environment variables

### Benefits of Supabase OAuth

- **No custom OAuth implementation** - Supabase handles the entire flow
- **Automatic token refresh** - Sessions refresh automatically
- **Secure token storage** - Tokens stored in encrypted AsyncStorage
- **Built-in session management** - onAuthStateChange listener
- **Multi-provider support** - Easy to add more OAuth providers later
- **Reduced backend complexity** - No need to manage OAuth state or tokens

## Next Steps

After successful setup:

1. **Test thoroughly** - Try sign in, sign out, and posting
2. **Handle edge cases** - Add error handling for expired tokens
3. **Implement token refresh** - Add logic to refresh provider token if needed
4. **Add more features** - Implement wizard endpoints for content generation
5. **Deploy to production** - Update URLs in environment variables

## Support

For issues or questions:
- Supabase Docs: https://supabase.com/docs/guides/auth
- LinkedIn API Docs: https://learn.microsoft.com/en-us/linkedin/
- Project Issues: Check backend logs and mobile app console
