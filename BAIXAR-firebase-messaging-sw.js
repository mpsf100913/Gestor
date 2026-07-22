importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging.js');

const firebaseConfig = {
  apiKey: "AIzaSyB5Y2BMqHIBDAhZoHFwDzdG-UuvPR1-FcQ",
  authDomain: "gestor-22b13.firebaseapp.com",
  databaseURL: "https://gestor-22b13-default-rtdb.firebaseio.com",
  projectId: "gestor-22b13",
  storageBucket: "gestor-22b13.firebasestorage.app",
  messagingSenderId: "124521158946",
  appId: "1:124521158946:web:06ea51762e01c571512d7b"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('Notificação de fundo:', payload);
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/icon-192.png',
    badge: '/icon-192.png'
  });
});
