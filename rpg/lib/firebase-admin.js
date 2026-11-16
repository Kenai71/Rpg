import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

function getServiceAccountConfig() {
  const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (rawJson) {
    try {
      const parsed = JSON.parse(rawJson);
      if (parsed.private_key) {
        parsed.private_key = parsed.private_key.replace(/\\n/g, '\n');
      }
      return parsed;
    } catch (err) {
      console.error('FIREBASE_SERVICE_ACCOUNT_KEY inválido:', err.message);
      return null;
    }
  }

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    return { projectId, clientEmail, privateKey };
  }

  return null;
}

export function getFirebaseAdmin() {
  const serviceAccount = getServiceAccountConfig();
  if (!serviceAccount) return null;

  const existing = getApps().find((a) => a.name === 'admin-server');
  const adminApp =
    existing ||
    initializeApp(
      {
        credential: cert(serviceAccount),
      },
      'admin-server'
    );

  return {
    adminDb: getFirestore(adminApp),
    adminAuth: getAuth(adminApp),
  };
}
