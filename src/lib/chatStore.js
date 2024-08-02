import { create } from 'zustand';
import { doc, getDoc } from "firebase/firestore";
import { db } from "./firebase";
import useUserStore from './userStore';

export const useChatStore = create((set) => ({
  chatId: null,
  user: null,
  isCurrentUserBlocked: false,
  isReceiverBlocked: false,
  changeChat: async (chatId, user) => {
    const currentUser = useUserStore.getState().currentUser;

    if (!currentUser || !user) {
      console.error("Current user or target user is undefined");
      return;
    }

    const userBlocked = user.blocked || [];
    const currentUserBlocked = currentUser.blocked || [];

    if (userBlocked.includes(currentUser.id)) {
      set({
        chatId,
        user: null,
        isCurrentUserBlocked: true,
        isReceiverBlocked: false,
      });
    } else if (currentUserBlocked.includes(user.id)) {
      set({
        chatId,
        user: user,
        isCurrentUserBlocked: false,
        isReceiverBlocked: true,
      });
    } else {
      set({
        chatId,
        user,
        isCurrentUserBlocked: false,
        isReceiverBlocked: false,
      });
    }
  },
  changeBlock: () => {
    set((state) => ({ ...state, isReceiverBlocked: !state.isReceiverBlocked }));
  },
}));

export default useChatStore;
