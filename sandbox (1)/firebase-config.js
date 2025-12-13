const firebaseConfig = {
  apiKey: "AIzaSyBJy3PcTMb1D2qciLOsVnl9v7S6BoDVjmg",
  authDomain: "teschi-bazar.firebaseapp.com",
  projectId: "teschi-bazar",
  storageBucket: "teschi-bazar.firebasestorage.app",
  messagingSenderId: "248798526831",
  appId: "1:248798526831:web:e1ba1209da2d3da4e53c9a",
  measurementId: "G-6VF2SY5B81",
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
