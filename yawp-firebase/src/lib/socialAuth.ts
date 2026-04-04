import { signInWithPopup, AuthProvider } from 'firebase/auth'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { auth, db } from '@/lib/firebase'

/**
 * Sign in with a social provider (Google, GitHub, etc.).
 * Returns { isNewUser: true } when the user has no Firestore profile yet
 * so the caller can redirect to the complete-profile page.
 */
export async function signInWithSocial(provider: AuthProvider): Promise<{ isNewUser: boolean }> {
  const result = await signInWithPopup(auth, provider)
  const profileSnap = await getDoc(doc(db, 'profiles', result.user.uid))
  return { isNewUser: !profileSnap.exists() }
}

/**
 * Create a Firestore profile for a social-login user who just picked a username.
 */
export async function createSocialProfile(uid: string, username: string, displayName: string, avatarUrl: string | null) {
  await setDoc(doc(db, 'profiles', uid), {
    username: username.toLowerCase(),
    displayName: displayName || username,
    bio: '',
    avatarUrl,
    isPlus: false,
    createdAt: Date.now(),
  })
}
