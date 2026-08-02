import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyADMDjQpxgJ9eRVYQTeOuqkCW5s4ZjgzY4",
  authDomain: "cacheta-ca0da.firebaseapp.com",
  projectId: "cacheta-ca0da",
  storageBucket: "cacheta-ca0da.firebasestorage.app",
  messagingSenderId: "459255576559",
  appId: "1:459255576559:web:993494b523a397146f681a"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
