import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const googleProvider = new GoogleAuthProvider();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  humanReadable: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const rawError = error instanceof Error ? error.message : String(error);
  let humanReadable = "An unexpected database error occurred.";

  if (rawError.toLowerCase().includes("permission")) {
    humanReadable = `Access Denied: You don't have permission to ${operationType} data at "${path}". Please ensure you are logged in and authorized.`;
  } else if (rawError.toLowerCase().includes("offline")) {
    humanReadable = "Network Error: You appear to be offline. Connection to database failed.";
  } else if (rawError.toLowerCase().includes("quota")) {
    humanReadable = "Quota Exceeded: The database free tier limit has been reached.";
  } else if (rawError.toLowerCase().includes("not-found")) {
    humanReadable = `Data Not Found: The document at "${path}" does not exist.`;
  }

  const errInfo: FirestoreErrorInfo = {
    error: rawError,
    humanReadable,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  
  console.group('🔥 Firestore Error Details');
  console.error('Message:', humanReadable);
  console.error('Operation:', operationType);
  console.error('Path:', path);
  console.error('Raw Error:', rawError);
  console.error('Auth Context:', errInfo.authInfo);
  console.groupEnd();

  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}

export const login = async () => {
  try {
    return await signInWithPopup(auth, googleProvider);
  } catch (error: any) {
    if (error.code === 'auth/cancelled-popup-request' || error.code === 'auth/popup-closed-by-user') {
      return null;
    }
    throw error;
  }
};
export const logout = () => signOut(auth);
