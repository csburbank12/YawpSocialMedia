# Yawp — Firebase Edition

## Setup — 3 Steps

### Step 1: Enable Firebase services

Go to console.firebase.google.com → your yawpsocial project:

**Firestore:**
1. Click "Firestore Database" in the left sidebar
2. Click "Create database"
3. Choose "Start in test mode"
4. Pick region "us-east1"
5. Click "Enable"

**Authentication:**
1. Click "Authentication" in the left sidebar
2. Click "Get started"
3. Click "Email/Password"
4. Toggle it ON → Save

### Step 2: Set Firestore security rules

In Firebase → Firestore → Rules tab, paste this and click Publish:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /profiles/{userId} {
      allow read: if true;
      allow write: if request.auth.uid == userId;
    }
    match /posts/{postId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth.uid == resource.data.userId;
      match /hearts/{userId} {
        allow read: if true;
        allow write: if request.auth.uid == userId;
      }
      match /replies/{replyId} {
        allow read: if true;
        allow create: if request.auth != null;
        allow delete: if request.auth.uid == resource.data.userId;
        match /hearts/{userId} {
          allow read: if true;
          allow write: if request.auth.uid == userId;
        }
      }
    }
    match /circles/{circleId} {
      allow read: if true;
      allow create: if request.auth != null;
      match /messages/{messageId} {
        allow read, create: if request.auth != null;
      }
    }
    match /conversations/{convId} {
      allow read, create: if request.auth != null &&
        request.auth.uid in resource.data.participants;
      allow update: if request.auth != null;
      match /messages/{messageId} {
        allow read, create: if request.auth != null;
      }
    }
    match /{document=**} {
      allow read, write: if request.auth != null;
    }
  }
}
```

### Step 3: Deploy to Vercel

1. Push this folder to a new GitHub repo
2. Import at vercel.com — no environment variables needed
   (Firebase keys are already in the code)
3. Click Deploy

That's it. No SQL, no schema, no migrations.

## How Firebase works vs Supabase

- No SQL to run — Firestore creates collections automatically when first written to
- Auth works immediately after enabling Email/Password
- Rules replace Row Level Security — already configured above
- Real-time updates built in via onSnapshot()

## File structure

```
src/
  app/
    page.tsx              ← Landing page
    layout.tsx            ← Root layout with AuthProvider
    (auth)/
      login/page.tsx      ← Sign in
      signup/page.tsx     ← Create account
    (main)/
      layout.tsx          ← Nav bar + auth guard
      feed/page.tsx       ← Chronological feed
      circles/page.tsx    ← Community rooms
      discover/page.tsx   ← Find people + trending
      messages/page.tsx   ← Direct messages
      post/[id]/page.tsx  ← Thread view + replies
      profile/page.tsx    ← Your profile
  lib/
    firebase.ts           ← Firebase config + clients
    AuthContext.tsx       ← Auth state provider
  types/index.ts          ← TypeScript types
  components/ui/Avatar    ← Shared avatar component
```
