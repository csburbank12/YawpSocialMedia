import { initializeApp, getApps } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: "AIzaSyAVjZiW2V6ejXRLeNJ7s0qG-tuOWMA-HYQ",
  authDomain: "yawpsocial-372ed.firebaseapp.com",
  databaseURL: "https://yawpsocial-372ed-default-rtdb.firebaseio.com",
  projectId: "yawpsocial-372ed",
  storageBucket: "yawpsocial-372ed.firebasestorage.app",
  messagingSenderId: "338138975898",
  appId: "1:338138975898:web:8fc30cbb7a83413c671923",
  measurementId: "G-9Y4YYGZBTN"
}

// Prevent duplicate initialization in Next.js
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]

export const auth = getAuth(app)
export const db = getFirestore(app)
export default app
