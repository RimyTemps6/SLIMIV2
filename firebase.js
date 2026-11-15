import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// Configuração do app Web (é pública por natureza; quem protege os dados são as regras do Firestore).
const firebaseConfig = {
    apiKey: "AIzaSyCEXT4Zxz7Tpr488ausn8K0MTMX8gIIu7U",
    authDomain: "slime-tasks-v2.firebaseapp.com",
    projectId: "slime-tasks-v2",
    storageBucket: "slime-tasks-v2.firebasestorage.app",
    messagingSenderId: "409051506560",
    appId: "1:409051506560:web:2560f407b6a45377e38365",
    measurementId: "G-VE3GSY2WDN"
};
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const isFirebaseConfigured = true;
