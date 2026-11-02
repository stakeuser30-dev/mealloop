import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  getDocFromServer,
  Firestore,
} from 'firebase/firestore';
import rawConfig from '../../firebase-applet-config.json';

const firebaseConfig = rawConfig as any;

// Resilient initialization: Never crash module loading if keys/network/environment are incomplete
let appInstance: any = null;
let firestoreInstance: any = null;
let authInstance: any = null;

try {
  if (firebaseConfig && (firebaseConfig.projectId || firebaseConfig.apiKey)) {
    appInstance = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    if (firebaseConfig.firestoreDatabaseId) {
      firestoreInstance = getFirestore(appInstance, firebaseConfig.firestoreDatabaseId);
    } else {
      firestoreInstance = getFirestore(appInstance);
    }
    authInstance = getAuth(appInstance);
  }
} catch (initErr) {
  console.warn('[MealLoop] Firebase client initialization fallback:', initErr);
}

// Initialize Firebase App instance singleton
export const app = appInstance;
export const db: Firestore = firestoreInstance;
export const auth = authInstance;

// Configure Google Provider
export const googleProvider = new GoogleAuthProvider();
try {
  googleProvider.setCustomParameters({
    prompt: 'select_account',
  });
} catch {
  // Ignore in environments without DOM
}

// Firestore Error Diagnostic Handler
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo:
        auth?.currentUser?.providerData?.map((p: any) => ({
          providerId: p.providerId,
          email: p.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('MealLoop Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Startup connection probe
export async function testFirestoreConnection() {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, '_connection_check', 'ping'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore connection check: Client currently offline or initializing network.');
    }
  }
}

// Google Sign-In with popup + graceful redirect fallback
export async function signInWithGoogle(): Promise<FirebaseUser | null> {
  if (!auth) {
    throw new Error('Firebase Authentication is not configured or available.');
  }
  try {
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
  } catch (error: any) {
    console.warn('Popup login notice:', error.code, error.message);
    if (
      error.code === 'auth/popup-blocked' ||
      error.code === 'auth/popup-closed-by-user' ||
      error.code === 'auth/cancelled-popup-request'
    ) {
      // In embedded iframes or pop-up blockers, attempt redirect fallback
      console.info('Falling back to signInWithRedirect...');
      try {
        await signInWithRedirect(auth, googleProvider);
        return null;
      } catch (redirectError: any) {
        throw new Error(mapAuthErrorMessage(redirectError));
      }
    }
    throw new Error(mapAuthErrorMessage(error));
  }
}

export async function checkRedirectLoginResult(): Promise<FirebaseUser | null> {
  if (!auth) return null;
  try {
    const result = await getRedirectResult(auth);
    if (result && result.user) {
      return result.user;
    }
    return null;
  } catch (error: any) {
    console.error('Redirect sign-in error:', error);
    throw new Error(mapAuthErrorMessage(error));
  }
}

export async function logOut(): Promise<void> {
  if (!auth) return;
  await signOut(auth);
}

export async function getCurrentUserIdToken(): Promise<string | null> {
  if (!auth) return null;
  const user = auth.currentUser;
  if (!user) return null;
  return await user.getIdToken(false);
}

// Friendly error messages covering edge cases
function mapAuthErrorMessage(error: any): string {
  switch (error.code) {
    case 'auth/popup-closed-by-user':
      return 'Google sign-in window was closed before completing.';
    case 'auth/popup-blocked':
      return 'Popup was blocked by your browser. Please allow popups for this campus portal.';
    case 'auth/unauthorized-domain':
      return 'This applet domain is not authorized in Firebase Console > Authentication > Settings > Authorized Domains.';
    case 'auth/operation-not-allowed':
      return 'Google provider is not enabled in Firebase Authentication console.';
    case 'auth/network-request-failed':
      return 'Network connection failed. Please check your internet connectivity.';
    case 'auth/user-disabled':
      return 'This campus account has been disabled.';
    default:
      return error.message || 'An error occurred during Google authentication.';
  }
}
