# LinkedIn OAuth Integration - Setup Guide

This guide will help you set up LinkedIn OAuth authentication for the Beacon Flow backend.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Database Setup](#database-setup)
3. [LinkedIn App Configuration](#linkedin-app-configuration)
4. [Environment Variables](#environment-variables)
5. [API Endpoints](#api-endpoints)
6. [Testing](#testing)
7. [Integration with Mobile App](#integration-with-mobile-app)

---

## Prerequisites

- PostgreSQL database
- LinkedIn Developer Account
- Node.js 18+ and npm

---

## Database Setup

### 1. Run the Base Schema

First, make sure you have the base authentication tables:

```bash
psql -U your_username -d your_database -f tables/table_v1.sql
```

### 2. Run the LinkedIn OAuth Schema

Add the LinkedIn-specific tables:

```bash
psql -U your_username -d your_database -f tables/linkedin_auth.sql
```

This creates:
- `linkedin_auth_sessions` - Temporary OAuth state tracking
- `linkedin_tokens` - Stores user LinkedIn tokens and profile data
- Adds `linkedin_id` column to `m_users` table

---

## LinkedIn App Configuration

### 1. Create a LinkedIn App

1. Go to [LinkedIn Developers](https://www.linkedin.com/developers/apps)
2. Click "Create app"
3. Fill in the required information:
   - **App name**: Beacon Flow
   - **LinkedIn Page**: Select or create a company page
   - **App logo**: Upload your app logo
   - **Legal agreement**: Accept terms

### 2. Configure OAuth 2.0 Settings

1. Go to the "Auth" tab of your app
2. Add **Authorized redirect URLs**:
   - Development: `http://localhost:8080/api/linkedin/auth/callback`
   - Production: `https://your-domain.com/api/linkedin/auth/callback`

3. Request the following **OAuth 2.0 scopes**:
   - `openid` - Access user ID
   - `profile` - Access user name and picture
   - `email` - Access user email
   - `w_member_social` - Post on behalf of user

### 3. Get Your Credentials

1. Go to the "Auth" tab
2. Copy your **Client ID**
3. Copy your **Client Secret** (keep this secure!)

---

## Environment Variables

### 1. Copy the Example Environment File

```bash
cp .env.example .env
```

### 2. Configure LinkedIn Variables

Edit `.env` and add your LinkedIn credentials:

```env
# LinkedIn OAuth Configuration
LINKEDIN_CLIENT_ID=86esqovjs7xjcc
LINKEDIN_CLIENT_SECRET=your_actual_client_secret_here
LINKEDIN_REDIRECT_URI=http://localhost:8080/api/linkedin/auth/callback
```

### 3. Set Other Required Variables

```env
PORT=8080
NODE_ENV=development
DATABASE_URL=postgresql://user:password@localhost:5432/database_name
JWT_SECRET=your_super_secret_jwt_key_minimum_32_characters
FRONTEND_URL=http://localhost:3000
```

---

## API Endpoints

### Authentication Flow

#### 1. Initiate OAuth Flow

**Endpoint**: `POST /api/linkedin/auth/initiate`

**Request**:
```json
{
  "returnUrl": "optional-url-to-return-after-auth"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "authUrl": "https://www.linkedin.com/oauth/v2/authorization?...",
    "state": "uuid-for-csrf-protection"
  }
}
```

**Usage**: Mobile app should open `authUrl` in a web browser.

---

#### 2. OAuth Callback (Handled by Backend)

**Endpoint**: `GET /api/linkedin/auth/callback?code=...&state=...`

This endpoint:
1. Exchanges the authorization code for an access token
2. Fetches the user profile from LinkedIn
3. Creates or updates the user in the database
4. Stores the LinkedIn token
5. Generates a JWT for app authentication
6. Redirects to the mobile app via deep link

**Deep Link Format**:
```
beaconflow://auth-success?jwt={jwt_token}&user={encoded_user_data}
```

---

#### 3. Check Authentication Status

**Endpoint**: `GET /api/linkedin/auth/status`

**Headers**: `Authorization: Bearer {jwt_token}`

**Response**:
```json
{
  "success": true,
  "data": {
    "authenticated": true,
    "profile": {
      "linkedin_id": "sub_value",
      "name": "John Doe",
      "email": "john@example.com",
      "picture": "https://..."
    },
    "expires_at": "2025-11-16T12:00:00Z"
  }
}
```

---

#### 4. Publish LinkedIn Post

**Endpoint**: `POST /api/linkedin/publish`

**Headers**: `Authorization: Bearer {jwt_token}`

**Request**:
```json
{
  "post_text": "Your LinkedIn post content here (max 3000 characters)"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "message": "Post published successfully",
    "postId": "urn:li:ugcPost:..."
  }
}
```

---

#### 5. Disconnect LinkedIn Account

**Endpoint**: `DELETE /api/linkedin/auth/disconnect`

**Headers**: `Authorization: Bearer {jwt_token}`

**Response**:
```json
{
  "success": true,
  "message": "LinkedIn account disconnected successfully"
}
```

---

## Testing

### 1. Start the Backend

```bash
npm install
npm run dev
```

Server should start on `http://localhost:8080`

### 2. Test OAuth Flow with cURL

**Step 1: Initiate OAuth**

```bash
curl -X POST http://localhost:8080/api/linkedin/auth/initiate \
  -H "Content-Type: application/json" \
  -d '{}'
```

Copy the `authUrl` from the response and open it in a browser.

**Step 2: After Authorization**

LinkedIn will redirect to your callback URL. The backend will show a success page and attempt to deep link back to the app.

**Step 3: Check Status** (use JWT from callback)

```bash
curl -X GET http://localhost:8080/api/linkedin/auth/status \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE"
```

**Step 4: Publish a Post**

```bash
curl -X POST http://localhost:8080/api/linkedin/publish \
  -H "Authorization: Bearer YOUR_JWT_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "post_text": "Hello LinkedIn! This is a test post from Beacon Flow."
  }'
```

---

## Integration with Mobile App

### Mobile App Changes Required

#### 1. Update API Client

Create `services/api.ts` in your mobile app:

```typescript
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_URL = 'http://localhost:8080/api'; // Change for production

class ApiClient {
  private client = axios.create({
    baseURL: API_URL,
    headers: { 'Content-Type': 'application/json' },
  });

  constructor() {
    // Add JWT to all requests
    this.client.interceptors.request.use(async (config) => {
      const jwt = await SecureStore.getItemAsync('jwt_token');
      if (jwt) {
        config.headers.Authorization = `Bearer ${jwt}`;
      }
      return config;
    });
  }

  // LinkedIn Auth
  async initiateLinkedInAuth() {
    const { data } = await this.client.post('/linkedin/auth/initiate');
    return data;
  }

  async getLinkedInStatus() {
    const { data } = await this.client.get('/linkedin/auth/status');
    return data;
  }

  async publishLinkedInPost(postText: string) {
    const { data } = await this.client.post('/linkedin/publish', {
      post_text: postText,
    });
    return data;
  }

  async disconnectLinkedIn() {
    const { data } = await this.client.delete('/linkedin/auth/disconnect');
    return data;
  }
}

export const apiClient = new ApiClient();
```

#### 2. Update Settings Screen

Replace the n8n OAuth flow in `app/(tabs)/settings.tsx`:

```typescript
import { apiClient } from '@/services/api';
import * as WebBrowser from 'expo-web-browser';
import * as SecureStore from 'expo-secure-store';

const handleLinkedInAuth = async () => {
  try {
    setLoading(true);

    // Step 1: Get authorization URL
    const { data } = await apiClient.initiateLinkedInAuth();
    const { authUrl } = data;

    // Step 2: Open OAuth flow
    const result = await WebBrowser.openAuthSessionAsync(
      authUrl,
      'beaconflow://auth-success' // Deep link scheme
    );

    if (result.type === 'success') {
      // Step 3: Extract JWT from deep link
      const url = new URL(result.url);
      const jwt = url.searchParams.get('jwt');
      const userData = url.searchParams.get('user');

      if (jwt && userData) {
        // Step 4: Store JWT
        await SecureStore.setItemAsync('jwt_token', jwt);
        await SecureStore.setItemAsync('user_data', userData);

        setIsAuthenticated(true);
        Alert.alert('Success', 'LinkedIn account connected!');
      }
    }
  } catch (error) {
    Alert.alert('Error', error.message);
  } finally {
    setLoading(false);
  }
};
```

#### 3. Configure Deep Link

In `app.json`, ensure deep link is configured:

```json
{
  "expo": {
    "scheme": "beaconflow",
    "ios": {
      "bundleIdentifier": "ssslighthouse"
    },
    "android": {
      "package": "ssslighthouse"
    }
  }
}
```

---

## Security Considerations

### 1. Environment Variables

- **Never commit** `.env` file to version control
- Use different credentials for development and production
- Rotate secrets regularly

### 2. Token Storage

- LinkedIn tokens are stored in the database
- Consider encrypting tokens at rest in production
- Implement token refresh logic (if LinkedIn provides refresh tokens)

### 3. PKCE Flow

This implementation uses **PKCE (Proof Key for Code Exchange)** for enhanced security:
- Generates a random `code_verifier`
- Creates a SHA-256 hash as `code_challenge`
- Prevents authorization code interception attacks

### 4. State Parameter

- Each OAuth flow generates a unique `state` UUID
- Prevents CSRF (Cross-Site Request Forgery) attacks
- Sessions expire after 10 minutes

---

## Troubleshooting

### Error: "Invalid or expired OAuth state"

**Cause**: The OAuth session expired (>10 minutes) or state mismatch.

**Solution**: Initiate a new OAuth flow.

---

### Error: "LinkedIn access token expired or invalid"

**Cause**: Token expired (LinkedIn tokens typically last 60 days).

**Solution**: User needs to re-authenticate via the OAuth flow.

---

### Error: "LinkedIn account not connected"

**Cause**: User hasn't completed OAuth flow or token was deleted.

**Solution**: Complete the OAuth flow in Settings.

---

### Deep Link Not Working

**Cause**: Mobile app not configured for deep links or wrong scheme.

**Solution**:
1. Check `app.json` has `"scheme": "beaconflow"`
2. Rebuild the app after changing app.json
3. Test deep link manually: `npx uri-scheme open beaconflow://auth-success --ios`

---

## Production Deployment

### 1. Update Environment Variables

```env
NODE_ENV=production
LINKEDIN_REDIRECT_URI=https://your-domain.com/api/linkedin/auth/callback
FRONTEND_URL=https://your-app.com
DATABASE_URL=postgresql://...  # Production database
JWT_SECRET=use_a_very_long_random_secret_for_production
```

### 2. Update LinkedIn App Settings

Add production redirect URL in LinkedIn Developer Console:
```
https://your-domain.com/api/linkedin/auth/callback
```

### 3. SSL Certificate

Ensure your production server has a valid SSL certificate (HTTPS required for OAuth).

---

## API Documentation

Full API documentation is available at:
```
http://localhost:8080/api-docs
```

After starting the server with `npm run dev`.

---

## Support

For issues or questions:
- Check the logs: Backend logs errors to console
- Review LinkedIn API documentation: https://docs.microsoft.com/en-us/linkedin/
- Check database tables for stored data

---

## Next Steps

After setting up LinkedIn OAuth, you can:
1. Implement the AI wizard endpoints (Steps 1-5)
2. Add post scheduling functionality
3. Implement media upload for LinkedIn posts
4. Add analytics and post performance tracking

---

**Happy coding!** 🚀
