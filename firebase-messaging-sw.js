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
  apiKey: "COLE_AQUI",
  authDomain: "COLE_AQUI",
  databaseURL: "COLE_AQUI",
  projectId: "COLE_AQUI",
  storageBucket: "COLE_AQUI",
  messagingSenderId: "COLE_AQUI",
  appId: "COLE_AQUI"
});

const messaging = firebase.messaging();

// Notificação recebida com o app/aba fechada
messaging.onBackgroundMessage((payload) => {
  console.log('Notificação recebida em background:', payload);
  
  const titulo = payload.notification?.title || 'Aviso do seu plano IPTV';
  const clickAction = payload.data?.click_action || payload.notification?.click_action || '/';
  
  const opcoes = {
    body: payload.notification?.body || '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'notificacao-iptv', // agrupa notificações
    requireInteraction: false,
    data: { 
      click_action: clickAction
    }
  };

  // Adiciona imagem se disponível
  if (payload.notification?.image) {
    opcoes.image = payload.notification.image;
  }

  console.log('Exibindo notificação com:', opcoes);
  self.registration.showNotification(titulo, opcoes);
});

// Quando o cliente clica na notificação
self.addEventListener('notificationclick', (event) => {
  console.log('Clique na notificação:', event);
  event.notification.close();
  
  // Pega o URL do clique - tenta vários lugares
  const url = event.notification.data?.click_action || 
              event.notification.tag || 
              '/';
  
  console.log('Abrindo URL:', url);
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Tenta reusar uma aba aberta
      for (let i = 0; i < clientList.length; i++) {
        if (clientList[i].url === url && 'focus' in clientList[i]) {
          return clientList[i].focus();
        }
      }
      // Abre uma aba nova
      if (clients.openWindow) {
        return clients.openWindow(url);
      }
    })
  );
});
