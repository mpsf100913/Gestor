// ============================================
// CONFIGURAÇÃO DO FIREBASE
// Cole aqui as chaves que você copiou no console do Firebase
// (Configurações do projeto > Geral > Seus apps > Web)
// ============================================

const firebaseConfig = {
  apiKey: "AIzaSyB5Y2BMqHIBDAhZoHFwDzdG-UuvPR1-FcQ",
  authDomain: "gestor-22b13.firebaseapp.com",
  databaseURL: "https://gestor-22b13-default-rtdb.firebaseio.com", // ex: https://iptv-cobranca-default-rtdb.firebaseio.com
  projectId: "gestor-22b13",
  storageBucket: "gestor-22b13.firebasestorage.app",
  messagingSenderId: "124521158946",
  appId: "1:124521158946:web:06ea51762e01c571512d7b"
};

// URL base do Realtime Database (usada nas chamadas REST via fetch/PATCH)
const DB_URL = firebaseConfig.databaseURL;

// PIN de acesso ao painel admin (troque por um número só seu)
const ADMIN_PIN = "891322";
