import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

const firebaseConfig = {
  apiKey: "AIzaSyAX4uXOMMTj1jtv0nK-ZLeblQHdOxh6LGw",
  authDomain: "c24club-lovable.firebaseapp.com",
  projectId: "c24club-lovable",
  storageBucket: "c24club-lovable.firebasestorage.app",
  messagingSenderId: "212900711433",
  appId: "1:212900711433:web:02e477f9ec38c39dbf7cd8",
  measurementId: "G-DV9P66BFHV",
};

const app = initializeApp(firebaseConfig);

let messaging: ReturnType<typeof getMessaging> | null = null;

// Only initialize messaging in browsers that support it
if (typeof window !== "undefined" && "serviceWorker" in navigator) {
  try {
    messaging = getMessaging(app);
  } catch (err) {
    console.warn("Firebase Messaging not supported:", err);
  }
}

export { app, messaging, getToken, onMessage };
