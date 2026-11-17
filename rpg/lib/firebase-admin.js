let adminInstance = null;

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
      console.warn('FIREBASE_SERVICE_ACCOUNT_KEY inválido:', err.message);
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

export async function getFirebaseAdmin() {
  if (adminInstance) return adminInstance;

  const serviceAccount = getServiceAccountConfig();
  if (!serviceAccount) return null;

  try {
    const { initializeApp, getApps, cert } = await import('firebase-admin/app');
    const { getFirestore } = await import('firebase-admin/firestore');
    const { getAuth } = await import('firebase-admin/auth');

    const existing = getApps().find((a) => a.name === 'admin-server');
    const adminApp =
      existing ||
      initializeApp(
        {
          credential: cert(serviceAccount),
        },
        'admin-server'
      );

    adminInstance = {
      adminDb: getFirestore(adminApp),
      adminAuth: getAuth(adminApp),
    };
    return adminInstance;
  } catch (err) {
    console.warn('Firebase Admin não pôde ser inicializado (modo fallback ativo):', err?.message);
    return null;
  }
}
