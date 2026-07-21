// ============================================
// SERVICE WORKER — Firebase Cloud Messaging
// Esse arquivo roda em segundo plano no navegador do cliente,
// é o que permite a notificação chegar mesmo com a aba fechada.
// ============================================

importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// IMPORTANTE: cole aqui os MESMOS valores que você colocou em firebase-config.js
// (Service workers não conseguem importar outros arquivos .js normalmente, por isso repete aqui)
firebase.initializeApp({
  apiKey: "AIzaSyB5Y2BMqHIBDAhZoHFwDzdG-UuvPR1-FcQ",
  authDomain: "gestor-22b13.firebaseapp.com",
  databaseURL: "https://gestor-22b13-default-rtdb.firebaseio.com", // ex: https://iptv-cobranca-default-rtdb.firebaseio.com
  projectId: "gestor-22b13",
  storageBucket: "gestor-22b13.firebasestorage.app",
  messagingSenderId: "124521158946",
  appId: "1:124521158946:web:06ea51762e01c571512d7b"
});

const messaging = firebase.messaging();

// Notificação recebida com o app/aba fechada
messaging.onBackgroundMessage((payload) => {
  const titulo = payload.notification?.title || 'Aviso do seu plano IPTV';
  const opcoes = {
    body: payload.notification?.body || '',
    icon: '/icon-192.png', // opcional: adicione um ícone se quiser
    data: { click_action: payload.data?.click_action || '/' }
  };
  self.registration.showNotification(titulo, opcoes);
});

// Quando o cliente clica na notificação
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.click_action || '/';
  event.waitUntil(clients.openWindow(url));
});
