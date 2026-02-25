import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore"; // ★追加：データベースを使うための機能

const firebaseConfig = {
  apiKey: "AIzaSyD6icf5w8wqDfyUpKyS_1c-01oH_RUz_NI",
  authDomain: "mobile-order-ukio.firebaseapp.com",
  projectId: "mobile-order-ukio",
  storageBucket: "mobile-order-ukio.firebasestorage.app",
  messagingSenderId: "591445303434",
  appId: "1:591445303434:web:8140342d3145bb47e9cd73"
};

// Firebaseの初期化と、データベース（db）の書き出し
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app); // ★追加：他のファイルからデータベースを使えるようにする