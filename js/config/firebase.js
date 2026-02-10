// js/config/firebase.js - Firebase Configuration & Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-analytics.js";
import {
  getFirestore, collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc,
  onSnapshot, query, where, serverTimestamp, writeBatch, orderBy, increment, addDoc
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";
import { 
  getStorage, ref as storageRef, uploadString, getDownloadURL, deleteObject 
} from "https://www.gstatic.com/firebasejs/9.22.0/firebase-storage.js";

// Firebase config - prefer environment-aware config from firebase-config.js if present
const firebaseConfig = (typeof window !== 'undefined' && window.firebaseConfig) ? window.firebaseConfig : {
  apiKey: "AIzaSyBNuIYfcsi2NWkK1Ua4Tnycaf_qM3oix1s",
  authDomain: "neon-voting-app.firebaseapp.com",
  projectId: "neon-voting-app",
  storageBucket: "neon-voting-app.firebasestorage.app",
  messagingSenderId: "406871836482",
  appId: "1:406871836482:web:b25063cd3829cd3dc6aadb",
  measurementId: "G-VGW2Z3FR8M"
};

// Initialize Firebase
let app, db, storage;
try {
  app = initializeApp(firebaseConfig);
  
  try { 
    getAnalytics(app); 
  } catch(e) {
    console.warn('Analytics initialization failed:', e);
  }
  
  db = getFirestore(app);
  storage = getStorage(app);
  
  // Set global flags after successful initialization
  window.firebase = { apps: [app] };
  window.__appInitialized = true;
  window.firebaseReady = Promise.resolve(true);
  
  console.log('✅ Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
  window.__appInitialized = false;
  window.firebaseReady = Promise.reject(error);
  alert('Firebase initialization failed. Please refresh the page. Error: ' + error.message);
}

// Export Firebase instances and Firestore functions
export {
  app,
  db,
  storage,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  writeBatch,
  orderBy,
  increment,
  addDoc,
  storageRef,
  uploadString,
  getDownloadURL,
  deleteObject
};
