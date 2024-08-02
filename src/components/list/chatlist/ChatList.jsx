import React, { useEffect, useState } from 'react';
import './chatlist.css';
import AddUser from './addUser/AddUser';
import useUserStore from '../../../lib/userStore';
import { doc, onSnapshot, getDoc, updateDoc } from "firebase/firestore";
import { db } from '../../../lib/firebase';
import useChatStore from '../../../lib/chatStore';
import UserProfile from './userProfile'; // Import the new UserProfile component

const ChatList = () => {
  const [addMode, setAddMode] = useState(false);
  const [chats, setChats] = useState([]);
  const [archivedChats, setArchivedChats] = useState([]);
  const { currentUser, isLoading } = useUserStore();
  const { chatId, changeChat } = useChatStore();
  const [input, setInput] = useState("");
  const [hiddenChats, setHiddenChats] = useState([]);
  const [showArchived, setShowArchived] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null); // State for selected user

  useEffect(() => {
    if (!currentUser || !currentUser.id) return; // Ensure currentUser and currentUser.id are defined

    const unsub = onSnapshot(doc(db, "userchats", currentUser.id), async (docSnapshot) => {
      if (!docSnapshot.exists()) return;
      const chatItems = docSnapshot.data().chats || [];
      const chatPromises = chatItems.map(async (item) => {
        const userDocRef = doc(db, "users", item.receiverId);
        const userDocSnap = await getDoc(userDocRef);
        if (!userDocSnap.exists()) return null;
        const user = userDocSnap.data();
        return { ...item, user };
      });
      const chatData = await Promise.all(chatPromises);
      const activeChats = chatData.filter(chat => chat && !chat.isArchived);
      const archivedChats = chatData.filter(chat => chat && chat.isArchived);
      setChats(activeChats.sort((a, b) => b.updatedAt - a.updatedAt));
      setArchivedChats(archivedChats.sort((a, b) => b.updatedAt - a.updatedAt));
    });

    return () => {
      unsub();
    };
  }, [currentUser?.id]);

  const handleSelect = async (chat) => {
    const updatedChats = chats.map(item => {
      if (item.chatId === chat.chatId) {
        return { ...item, isSeen: true };
      }
      return item;
    });

    const userChatsRef = doc(db, "userchats", currentUser.id);

    try {
      const docSnapshot = await getDoc(userChatsRef);
      if (docSnapshot.exists()) {
        await updateDoc(userChatsRef, {
          chats: updatedChats,
        });
        changeChat(chat.chatId, chat.user);
      } else {
        console.error(`Document does not exist: userchats/${currentUser.id}`);
      }
    } catch (err) {
      console.error('Error updating document:', err);
    }
  };

  const handleDelete = async (chatId, e) => {
    e.stopPropagation(); // Prevent the click event from bubbling up
    const updatedChats = chats.filter(chat => chat.chatId !== chatId);

    const userChatsRef = doc(db, "userchats", currentUser.id);

    try {
      const docSnapshot = await getDoc(userChatsRef);
      if (docSnapshot.exists()) {
        await updateDoc(userChatsRef, {
          chats: updatedChats,
        });
        setChats(updatedChats);
      } else {
        console.error(`Document does not exist: userchats/${currentUser.id}`);
      }
    } catch (err) {
      console.error('Error updating document:', err);
    }
  };

  const filteredChats = (showArchived ? archivedChats : chats)
    .filter(chat => chat.user.username.toLowerCase().includes(input.toLowerCase()))
    .filter(chat => !hiddenChats.includes(chat.chatId));

  if (isLoading) {
    return <div className="chatList">Loading...</div>;
  }

  if (!currentUser) {
    return <div className="chatList">No user information available.</div>;
  }

  return (
    <div className='chatList'>
      <div className="search">
        <div className="searchBar">
          <img src="/search.png" alt="Search Icon" />
          <input type="text" placeholder='Search' onChange={(e) => setInput(e.target.value)} />
        </div>
        <img
          src={addMode ? "./minus.png" : "./plus.png"}
          alt="Toggle Add User"
          className='add'
          onClick={() => setAddMode((prev) => !prev)}
        />
      </div>
      <button className="showArchivedButton" onClick={() => setShowArchived(!showArchived)}>
        {showArchived ? "Show Active Chats" : "Show Archived Chats"}
      </button>

      <div className="height">
        {filteredChats.map((chat) => (
          <div
            className="item"
            key={chat.chatId}
            onClick={() => handleSelect(chat)}
            style={{
              backgroundColor: chat.isSeen ? "transparent" : "#5183fe",
            }}
          >
            <img src={chat.user.blocked.includes(currentUser.id) ? "./avatar.png" : chat.user.avatar || "./avatar.png"} alt="User Avatar" onClick={() => setSelectedUser(chat.user)} /> {/* Set selected user */}
            <div className="texts">
              <span>{chat.user.blocked.includes(currentUser.id) ? "User" : chat.user.username}</span>
              <p>{chat.lastMessage}</p>
            </div>
            <button className="deleteButton" onClick={(e) => handleDelete(chat.chatId, e)}>Delete</button>
          </div>
        ))}
      </div>
      {addMode && <AddUser  />}
      {selectedUser && <UserProfile user={selectedUser} onClose={() => setSelectedUser(null)} />} {/* Show UserProfile */}
    </div>
  );
};

export default ChatList;
