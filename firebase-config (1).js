// ============================================
// CONFIGURAÇÃO DO FIREBASE
// Cole aqui as chaves que você copiou no console do Firebase
// (Configurações do projeto > Geral > Seus apps > Web)
// ============================================

const firebaseConfig = {
  apiKey: "COLE_AQUI",
  authDomain: "COLE_AQUI",
  databaseURL: "COLE_AQUI", // ex: https://iptv-cobranca-default-rtdb.firebaseio.com
  projectId: "COLE_AQUI",
  storageBucket: "COLE_AQUI",
  messagingSenderId: "COLE_AQUI",
  appId: "COLE_AQUI"
};

// URL base do Realtime Database (usada nas chamadas REST via fetch/PATCH)
const DB_URL = firebaseConfig.databaseURL;

// PIN de acesso ao painel admin (troque por um número só seu)
const ADMIN_PIN = "0000";
