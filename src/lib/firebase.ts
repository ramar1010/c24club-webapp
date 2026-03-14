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
let messagingInitError: string | null = null;

// Lazy-init messaging to avoid IndexedDB errors at import time
const getMessagingInstance = () => {
  if (messaging) return messaging;
  if (messagingInitError) return null;

  try {
    messaging = getMessaging(app);
    return messaging;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn("Firebase Messaging not supported:", msg);

    if (msg.includes("indexedDB") || msg.includes("IndexedDB") || msg.includes("backing store")) {
      messagingInitError = "Your browser is blocking storage required for push notifications. Try disabling private/incognito mode, or check your browser privacy settings.";
    } else {
      messagingInitError = msg || "Push notifications are not supported on this device.";
    }
    return null;
  }
};

export { app, messaging, getMessagingInstance, messagingInitError, getToken, onMessage };

export { app, messaging, getToken, onMessage };
