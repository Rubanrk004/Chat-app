import { create } from 'zustand';
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { db } from './firebase';

export const useUserStore = create((set) => ({
  currentUser: null,
  isLoading: true,
  fetchUserinfo: async (uid) => {
    if (!uid) {
      set({ currentUser: null, isLoading: false });
      return;
    }

    try {
      const docRef = doc(db, "users", uid);
      const docSnap = await getDoc(docRef);

      if (docSnap.exists()) {
        const userData = docSnap.data();
        set({ currentUser: userData, isLoading: false });
      } else {
        console.error("User not found");
        set({ currentUser: null, isLoading: false });
      }
    } catch (err) {
      console.error("Error fetching user info:", err);
      set({ currentUser: null, isLoading: false });
    }
  },
  updateUsername: async (uid, newUsername) => {
    if (!uid || !newUsername) return;
    try {
      const userRef = doc(db, 'users', uid);
      await updateDoc(userRef, {
        username: newUsername,
      });
      set((state) => ({
        currentUser: { ...state.currentUser, username: newUsername }
      }));
    } catch (error) {
      console.error('Error updating username:', error);
    }
  },
}));

export default useUserStore;
