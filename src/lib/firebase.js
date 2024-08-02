import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {getAuth} from "firebase/auth";
import { getFirestore} from "firebase/firestore";
import {getStorage} from "firebase/storage"


const firebaseConfig = {
  apiKey: import.meta.env.VITE_API_KEY,
  authDomain: "chat-application-871ec.firebaseapp.com",
  projectId: "chat-application-871ec",
  storageBucket: "chat-application-871ec.appspot.com",
  messagingSenderId: "499921390450",
  appId: "1:499921390450:web:a940bacd31a3da7dc4ebeb",
  measurementId: "G-W17C3TF8ER"
};

const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);

export const auth = getAuth()
export const db = getFirestore()
export const storage = getStorage()