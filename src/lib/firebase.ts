import { initializeApp } from 'firebase/app';
import { 
  getFirestore, 
  enableIndexedDbPersistence,
  CACHE_SIZE_UNLIMITED,
  initializeFirestore,
  persistentLocalCache,
  persistentSingleTabManager
} from 'firebase/firestore';
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

// Initialize Firestore with persistence enabled
const db = initializeFirestore(app, {
  cache: persistentLocalCache({
    tabManager: persistentSingleTabManager(),
    cacheSizeBytes: CACHE_SIZE_UNLIMITED
  })
});

// Enable offline persistence
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time
      console.warn('Firestore persistence disabled: multiple tabs open');
    } else if (err.code === 'unimplemented') {
      // The current browser doesn't support persistence
      console.warn('Firestore persistence not supported by browser');
    }
  });

const auth = getAuth(app);
const storage = getStorage(app);

// Enable auth persistence
setPersistence(auth, browserLocalPersistence).catch((error) => {
  console.error("Auth persistence error:", error);
});

export { db, auth, storage };