import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-auth.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.5/firebase-firestore.js';

const firebaseConfig = {
  apiKey: 'AIzaSyA9DT2n8NbC_Od4e6HLyDvS_c2WNMgLFW8',
  authDomain: 'horalivre-7c86c.firebaseapp.com',
  projectId: 'horalivre-7c86c',
  storageBucket: 'horalivre-7c86c.firebasestorage.app',
  messagingSenderId: '334858873661',
  appId: '1:334858873661:web:b28d3617a887f84fe8f354'
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
