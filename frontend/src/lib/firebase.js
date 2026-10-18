/**
 * Firebase is loaded on demand: the Web SDK is ~100 KB gzipped and is only
 * needed when someone actually signs in, signs out, or finishes a checkout.
 */
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = () =>
  Boolean(firebaseConfig.apiKey && firebaseConfig.projectId);

let appPromise = null;

function loadApp() {
  if (!appPromise) {
    appPromise = import("firebase/app").then(({ initializeApp, getApps }) =>
      getApps().length ? getApps()[0] : initializeApp(firebaseConfig),
    );
  }
  return appPromise;
}

export async function getFirebaseAuth() {
  const [{ getAuth }, app] = await Promise.all([import("firebase/auth"), loadApp()]);
  return getAuth(app);
}

export async function getGoogleProvider() {
  const { GoogleAuthProvider } = await import("firebase/auth");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return provider;
}
