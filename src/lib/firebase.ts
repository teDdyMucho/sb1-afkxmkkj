import { initializeApp } from 'firebase/app';
import { getFirestore, enableNetwork } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyCl35Jd6lE2Tgsd43fJPm27SK4rd7SSvEs",
  authDomain: "fbt-bet.firebaseapp.com",
  databaseURL: "https://fbt-bet-default-rtdb.firebaseio.com",
  projectId: "fbt-bet",
  storageBucket: "fbt-bet.appspot.com",
  messagingSenderId: "303855684192",
  appId: "1:303855684192:web:7c974a54422cf15ad45105"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);

// Enable network by default
enableNetwork(db).catch(console.error);

setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Auth persistence error:", error);
});

export { db, auth, storage };