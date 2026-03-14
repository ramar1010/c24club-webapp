/* eslint-disable no-restricted-globals */
// Firebase Messaging Service Worker
// This runs in the background to receive push notifications

importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js");
importScripts("https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js");

firebase.initializeApp({
  apiKey: "AIzaSyAX4uXOMMTj1jtv0nK-ZLeblQHdOxh6LGw",
  authDomain: "c24club-lovable.firebaseapp.com",
  projectId: "c24club-lovable",
  storageBucket: "c24club-lovable.firebasestorage.app",
  messagingSenderId: "212900711433",
  appId: "1:212900711433:web:02e477f9ec38c39dbf7cd8",
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] Background message received:", payload);

  const title = payload.notification?.title || "C24 Club";
  const options = {
    body: payload.notification?.body || "Someone is waiting for you!",
    icon: "/favicon-96x96.png",
    badge: "/favicon-32x32.png",
    data: { url: payload.data?.url || "/videocall" },
  };

  self.registration.showNotification(title, options);
});

// Handle notification click — open the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/videocall";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // If app is already open, focus it
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url);
    })
  );
});
