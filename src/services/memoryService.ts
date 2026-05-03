import { 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  orderBy, 
  limit, 
  addDoc, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../lib/firebase';

export interface UserMemory {
  id?: string;
  fact: string;
  category?: string;
  createdAt: any;
}

export interface ChatHistory {
  role: 'user' | 'model';
  content: string;
  timestamp: any;
}

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
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
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const MemoryService = {
  async savePreference(pref: any) {
    const user = auth.currentUser;
    if (!user) return;
    const path = `users/${user.uid}/preferences/main`;
    try {
      const ref = doc(db, 'users', user.uid, 'preferences', 'main');
      await setDoc(ref, { 
        ...pref, 
        lastActive: serverTimestamp() 
      }, { merge: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  async getPreferences() {
    const user = auth.currentUser;
    if (!user) return null;
    const path = `users/${user.uid}/preferences/main`;
    try {
      const ref = doc(db, 'users', user.uid, 'preferences', 'main');
      const snap = await getDoc(ref);
      return snap.exists() ? snap.data() : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  async addMemory(fact: string, category: string = 'general') {
    const user = auth.currentUser;
    if (!user) return;
    const path = `users/${user.uid}/memories`;
    try {
      const ref = collection(db, 'users', user.uid, 'memories');
      await addDoc(ref, {
        fact,
        category,
        createdAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async getAllMemories(): Promise<UserMemory[]> {
    const user = auth.currentUser;
    if (!user) return [];
    const path = `users/${user.uid}/memories`;
    try {
      const ref = collection(db, 'users', user.uid, 'memories');
      const snap = await getDocs(query(ref, orderBy('createdAt', 'desc')));
      return snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserMemory));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  },

  async addMessage(role: 'user' | 'model', content: string) {
    const user = auth.currentUser;
    if (!user) return;
    const path = `users/${user.uid}/messages`;
    try {
      const ref = collection(db, 'users', user.uid, 'messages');
      await addDoc(ref, {
        role,
        content,
        timestamp: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  },

  async getRecentMessages(limitCount: number = 10): Promise<ChatHistory[]> {
    const user = auth.currentUser;
    if (!user) return [];
    const path = `users/${user.uid}/messages`;
    try {
      const ref = collection(db, 'users', user.uid, 'messages');
      const snap = await getDocs(query(ref, orderBy('timestamp', 'desc'), limit(limitCount)));
      return snap.docs.map(doc => doc.data() as ChatHistory).reverse();
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, path);
    }
  }
};
