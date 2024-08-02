import React, { useEffect, useState } from 'react';
import './detail.css';
import { auth, db, storage } from '../../lib/firebase';
import useChatStore from '../../lib/chatStore';
import useUserStore from '../../lib/userStore';
import { arrayRemove, arrayUnion, doc, updateDoc, onSnapshot, getDoc } from 'firebase/firestore';
import { getDownloadURL, ref } from 'firebase/storage';

const Detail = () => {
  const { chatId, user, isCurrentUserBlocked, isReceiverBlocked, changeBlock } = useChatStore();
  const { currentUser } = useUserStore();
  const [sharedPhotos, setSharedPhotos] = useState([]);
  const [sharedDocuments, setSharedDocuments] = useState([]);
  const [isChatSettingsVisible, setChatSettingsVisible] = useState(false);
  const [isPrivacyHelpVisible, setPrivacyHelpVisible] = useState(false);
  const [isSharedPhotosVisible, setSharedPhotosVisible] = useState(false);
  const [isSharedFilesVisible, setSharedFilesVisible] = useState(false);
  const [isArchived, setIsArchived] = useState(false);

  useEffect(() => {
    const fetchSharedData = async () => {
      if (!chatId) return;

      const chatDocRef = doc(db, 'chats', chatId);
      const unsubscribe = onSnapshot(chatDocRef, (doc) => {
        if (doc.exists()) {
          const chatData = doc.data();
          setSharedPhotos(chatData.sharedPhotos || []);
          setSharedDocuments(chatData.sharedDocuments || []);
          setIsArchived(chatData.isArchived || false);
        } else {
          console.log("No such document!");
        }
      });

      return () => unsubscribe();
    };

    fetchSharedData();
  }, [chatId]);

  const handleBlock = async () => {
    if (!user) return;
    const userDocRef = doc(db, "users", currentUser.id);

    try {
      await updateDoc(userDocRef, {
        blocked: isReceiverBlocked ? arrayRemove(user.id) : arrayUnion(user.id)
      });
      changeBlock();
      await updateChatBlockStatus();
    } catch (err) {
      console.log(err);
    }
  };

  const updateChatBlockStatus = async () => {
    const chatDocRef = doc(db, 'chats', chatId);
    try {
      await updateDoc(chatDocRef, {
        isCurrentUserBlocked: !isCurrentUserBlocked,
        isReceiverBlocked: !isReceiverBlocked
      });
    } catch (err) {
      console.error('Error updating chat block status:', err);
    }
  };

  const handleClearSharedPhotos = async () => {
    const chatDocRef = doc(db, 'chats', chatId);
    try {
      await updateDoc(chatDocRef, {
        sharedPhotos: []
      });
      setSharedPhotos([]);
    } catch (err) {
      console.error('Error clearing shared photos:', err);
    }
  };

  const handleClearSharedDocuments = async () => {
    const chatDocRef = doc(db, 'chats', chatId);
    try {
      await updateDoc(chatDocRef, {
        sharedDocuments: []
      });
      setSharedDocuments([]);
    } catch (err) {
      console.error('Error clearing shared documents:', err);
    }
  };

  const downloadFile = async (fileObject) => {
    try {
      console.log('Attempting to download file:', fileObject);
      if (typeof fileObject !== 'object' || !fileObject.url) {
        throw new Error(`Invalid fileObject: ${fileObject}`);
      }

      const fileRef = ref(storage, fileObject.url);
      const url = await getDownloadURL(fileRef);
      console.log('File download URL:', url);

      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.target = "_blank"; // Open in a new tab
      anchor.download = fileObject.name; // Extract file name from object
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    } catch (error) {
      console.error('Error downloading file:', error);
    }
  };

  const handleArchiveToggle = async () => {
    const chatDocRef = doc(db, 'userchats', currentUser.id);
    const userChatDoc = await getDoc(chatDocRef);
    if (userChatDoc.exists()) {
      const chatData = userChatDoc.data();
      const updatedChats = chatData.chats.map(chat => 
        chat.chatId === chatId ? { ...chat, isArchived: !chat.isArchived } : chat
      );
      await updateDoc(chatDocRef, {
        chats: updatedChats,
      });
      setIsArchived(!isArchived);
    }
  };

  return (
    <div className='detail'>
      <div className="user">
        <img src={user?.avatar || "./avatar.png"} alt="" />
        <h3>{user?.username}</h3>
        <p>Hey there!</p>
      </div>
      <div className="info">
        <div className="option">
          <div className="title" onClick={() => setChatSettingsVisible(!isChatSettingsVisible)}>
            <span>Chat Settings</span>
            <img src={isChatSettingsVisible ? "./arrowUp.png" : "./arrowDown.png"} alt="" />
          </div>
          {isChatSettingsVisible && (
            <div className="content">
             
            
              {/* Add other chat settings content here */}
            </div>
          )}
        </div>

        <div className="option">
          <div className="title" onClick={() => setPrivacyHelpVisible(!isPrivacyHelpVisible)}>
            <span>Privacy & help</span>
            <img src={isPrivacyHelpVisible ? "./arrowUp.png" : "./arrowDown.png"} alt="" />
          </div>
          {isPrivacyHelpVisible && (
            <div className="content">
              {/* Add privacy and help content here */}
              <button onClick={handleArchiveToggle}>
                {isArchived ? "Unarchive Chat" : "Archive Chat"}
              </button>
            </div>
          )}
        </div>

        <div className="option">
          <div className="title" onClick={() => setSharedPhotosVisible(!isSharedPhotosVisible)}>
            <span>Shared photos</span>
            <button onClick={handleClearSharedPhotos} className="clearButton">Clear</button>
            <img src={isSharedPhotosVisible ? "./arrowUp.png" : "./arrowDown.png"} alt="" />
          </div>
          {isSharedPhotosVisible && (
            <div className="photos">
              {sharedPhotos.length > 0 ? (
                sharedPhotos.map((photoUrl, index) => (
                  <div className="photoItem" key={index}>
                    <div className="photoDetail">
                      <img src={photoUrl} alt={`Shared photo ${index}`} />
                      <span>{`Photo_${index + 1}`}</span>
                    </div>
                    <img src="./download.png" alt="Download" className='icon' onClick={() => downloadFile({url: photoUrl, name: `Photo_${index + 1}`})} />
                  </div>
                ))
              ) : ""}
            </div>
          )}
        </div>

        <div className="option">
          <div className="title" onClick={() => setSharedFilesVisible(!isSharedFilesVisible)}>
            <span>Shared Files</span>
            <button onClick={handleClearSharedDocuments} className="clearButton">Clear</button>
            <img src={isSharedFilesVisible ? "./arrowUp.png" : "./arrowDown.png"} alt="" />
          </div>
          {isSharedFilesVisible && (
            <div className="files">
              {sharedDocuments.length > 0 ? (
                sharedDocuments.map((file, index) => (
                  <div className="fileItem" key={index}>
                    <div className="fileDetail">
                      <span>{file.name || `File_${index + 1}`}</span>
                    </div>
                    <img src="./download.png" alt="Download" className='icon' onClick={() => downloadFile(file)} />
                  </div>
                ))
              ) : ""}
            </div>
          )}
        </div>

        <button onClick={handleBlock}>{isCurrentUserBlocked ? "You are Blocked" : isReceiverBlocked ? "User Blocked" : "Block User"}</button>
        <button className='logout' onClick={() => auth.signOut()}> Logout </button>
      </div>
    </div>
  );
};

export default Detail;




