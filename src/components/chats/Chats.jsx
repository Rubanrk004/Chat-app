import React, { useEffect, useRef, useState } from 'react';
import './chats.css';
import EmojiPicker from 'emoji-picker-react';
import { arrayUnion, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, storage } from '../../lib/firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import useChatStore from '../../lib/chatStore';
import useUserStore from '../../lib/userStore';

const Chats = () => {
  const [chat, setChat] = useState(null);
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [img, setImg] = useState({ file: null, url: "" });
  const [document, setDocument] = useState({ file: null, name: "" });
  const [capturedImg, setCapturedImg] = useState(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState('');
  const [audioPreview, setAudioPreview] = useState(null);
  const [isAudioPreviewOpen, setIsAudioPreviewOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isDocumentPreviewOpen, setIsDocumentPreviewOpen] = useState(false);
  const [hiddenChats, setHiddenChats] = useState([]);
  const [isCallOngoing, setIsCallOngoing] = useState(false);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [taggedMessage, setTaggedMessage] = useState(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const callDocRef = useRef(null);

  const { chatId, user, isCurrentUserBlocked, isReceiverBlocked } = useChatStore();
  const { currentUser } = useUserStore();
  const endRef = useRef(null);

  const configuration = {
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302'
      }
    ]
  };
  

  useEffect(() => {
    if (!chatId) {
      setChat(null);
      return;
    }

    const unSub = onSnapshot(doc(db, 'chats', chatId), (docSnapshot) => {
      if (docSnapshot.exists()) {
        const chatData = docSnapshot.data();
        setChat(chatData);
      } else {
        setChat(null);
      }
    });

    return () => {
      unSub();
    };
  }, [chatId]);

  useEffect(() => {
    if (user) {
      const userDocRef = doc(db, 'users', user.id);
      const unsubscribe = onSnapshot(userDocRef, (docSnapshot) => {
        if (docSnapshot.exists()) {
          const userData = docSnapshot.data();
          const lastSeenTimestamp = userData.lastseen;
          if (lastSeenTimestamp && lastSeenTimestamp.toDate) {
            const lastSeenDate = lastSeenTimestamp.toDate();
            setLastSeen(lastSeenDate);
          } else {
            console.error("Invalid last seen timestamp format:", lastSeenTimestamp);
          }
        }
      });

      return () => {
        unsubscribe();
      };
    }
  }, [user]);

  useEffect(() => {
    if (chat?.messages) {
      endRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chat?.messages]);

  const updateLastSeen = async () => {
    try {
      await updateDoc(doc(db, 'users', currentUser.id), {
        lastseen: new Date(),
      });
    } catch (err) {
      console.error('Error updating last seen:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      updateLastSeen();
    }
  }, [currentUser]);

  const handleEmoji = (emoji) => {
    setText((prev) => prev + emoji.emoji);
    setOpen(false);
  };

  const handleImg = e => {
    if (!isCurrentUserBlocked && !isReceiverBlocked && e.target.files[0]) {
      setImg({ file: e.target.files[0], url: URL.createObjectURL(e.target.files[0]) });
      setIsPreviewOpen(true);
    }
  };

  const handleDocument = e => {
    if (!isCurrentUserBlocked && !isReceiverBlocked && e.target.files[0]) {
      setDocument({ file: e.target.files[0], name: e.target.files[0].name });
      setIsDocumentPreviewOpen(true);
    }
  };

  const handleSend = async () => {
    if (text === '' && !img.file && !audioURL && !capturedImg && !document.file) return;

    let imgUrl = null;
    let documentUrl = null;

    try {
      if (img.file) {
        const imageRef = ref(storage, `images/${chatId}/${Date.now()}.jpg`);
        await uploadBytes(imageRef, img.file);
        imgUrl = await getDownloadURL(imageRef);
      } else if (capturedImg) {
        const imageRef = ref(storage, `images/${chatId}/${Date.now()}.jpg`);
        await uploadBytes(imageRef, capturedImg);
        imgUrl = await getDownloadURL(imageRef);
      } else if (document.file) {
        const documentRef = ref(storage, `documents/${chatId}/${Date.now()}_${document.name}`);
        await uploadBytes(documentRef, document.file);
        documentUrl = await getDownloadURL(documentRef);
      }
      const message = {
        senderId: currentUser.id,
        text,
        createdAt: new Date().toISOString(),
        ...(imgUrl && { img: imgUrl }),
        ...(audioURL && { audio: audioURL }),
        ...(documentUrl && { document: documentUrl, documentName: document.name }),
        ...(taggedMessage && { taggedMessage }),
      };
      

      const chatRef = doc(db, 'chats', chatId);

      await updateDoc(chatRef, {
        messages: arrayUnion(message),
        ...(imgUrl && { sharedPhotos: arrayUnion(imgUrl) }),
        ...(documentUrl && { sharedDocuments: arrayUnion({ url: documentUrl, name: document.name }) }),
      });

      await updateLastSeen();

      const userIDs = [currentUser.id, user.id];
      for (const id of userIDs) {
        const userChatsRef = doc(db, 'userchats', id);
        const userChatsSnapshot = await getDoc(userChatsRef);

        if (userChatsSnapshot.exists()) {
          const userChatsData = userChatsSnapshot.data();
          const chatIndex = userChatsData.chats.findIndex(c => c.chatId === chatId);

          if (chatIndex !== -1) {
            userChatsData.chats[chatIndex].lastMessage = text;
            userChatsData.chats[chatIndex].isSeen = id === currentUser.id ? true : false;
            userChatsData.chats[chatIndex].updatedAt = Date.now();

            await updateDoc(userChatsRef, {
              chats: userChatsData.chats,
            });
          }
        }
      }

      setText('');
      setAudioURL('');
      setCapturedImg(null);
      setImg({ file: null, url: "" });
      setDocument({ file: null, name: "" });
      setTaggedMessage(null);
      setIsPreviewOpen(false);
      setIsDocumentPreviewOpen(false);
    } catch (err) {
      console.error('Error sending message:', err);
    }
  };

  const startRecording = async () => {
    if (isCurrentUserBlocked || isReceiverBlocked) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      mediaRecorderRef.current.ondataavailable = event => {
        audioChunksRef.current.push(event.data);
      };
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/mpeg' });
        audioChunksRef.current = [];
        const audioRef = ref(storage, `audioMessages/${chatId}/${Date.now()}.mp3`);
        await uploadBytes(audioRef, audioBlob);
        const audioUrl = await getDownloadURL(audioRef);
        setAudioURL(audioUrl);
        setAudioPreview(audioUrl); 
        setIsAudioPreviewOpen(true); 
      };
      mediaRecorderRef.current.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Error starting recording:', err);
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current.stop();
    setIsRecording(false);
  };

  const openCamera = async () => {
    if (isCurrentUserBlocked || isReceiverBlocked) return;

    setIsCameraOpen(true);
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    videoRef.current.srcObject = stream;
  };

  const closeCamera = () => {
    const stream = videoRef.current.srcObject;
    const tracks = stream.getTracks();

    tracks.forEach(track => track.stop());
    setIsCameraOpen(false);
  };

  const captureImage = () => {
    if (isCurrentUserBlocked || isReceiverBlocked) return;

    const context = canvasRef.current.getContext('2d');
    context.drawImage(videoRef.current, 0, 0, canvasRef.current.width, canvasRef.current.height);
    canvasRef.current.toBlob((blob) => {
      setCapturedImg(blob);
      setIsPreviewOpen(true);
      closeCamera();
    }, 'image/jpeg');
  };

  const handleCancelAudioPreview = () => {
    setAudioURL('');
    setAudioPreview(null); 
    setIsAudioPreviewOpen(false);
  };

  const handleConfirmAudioPreview = async () => {
    handleSend();
    setIsAudioPreviewOpen(false);
  };

  const handleClearChat = async () => {
    try {
      await updateDoc(doc(db, 'chats', chatId), {
        messages: [],
        sharedPhotos: [],
        sharedDocuments: []
      });
      await updateLastSeen();
    } catch (error) {
      console.error('Error clearing chat:', error);
    }
  };

  // const handleHideChat = () => {
  //   setHiddenChats((prevHiddenChats) => [...prevHiddenChats, chatId]);
  // };

  // const startCall = async (isVideo = false) => {
  //   if (isCurrentUserBlocked || isReceiverBlocked) return;

  //   try {
  //     const stream = await navigator.mediaDevices.getUserMedia({ video: isVideo, audio: true });
  //     setLocalStream(stream);
  //     setIsCallOngoing(true);
  //     localVideoRef.current.srcObject = stream;

  //     // TODO: Add logic to connect to the remote user using WebRTC or another service
  //   } catch (error) {
  //     console.error('Error starting call:', error);
  //   }
  // };

  // const endCall = () => {
  //   if (localStream) {
  //     localStream.getTracks().forEach(track => track.stop());
  //     setLocalStream(null);
  //     setIsCallOngoing(false);
  //   }

  //   // TODO: Add logic to disconnect the call from the remote user
  // };
  

  if (hiddenChats.includes(chatId)) {
    return null; // Return null to hide the chat
  }

  const startCall = async () => {
    setIsCallOngoing(true);
    peerConnectionRef.current = new RTCPeerConnection(configuration);
  
    const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream.getTracks().forEach(track => {
      peerConnectionRef.current.addTrack(track, localStream);
    });
  
    setLocalStream(localStream);
    localVideoRef.current.srcObject = localStream;
  
    peerConnectionRef.current.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStream(remoteStream);
      remoteVideoRef.current.srcObject = remoteStream;
    };
  
    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        callDocRef.current.update({
          'offerCandidates': arrayUnion(event.candidate.toJSON())
        });
      }
    };
  
    const callDoc = doc(db, 'calls', chatId);
    callDocRef.current = callDoc;
  
    const callOffer = await peerConnectionRef.current.createOffer();
    await peerConnectionRef.current.setLocalDescription(callOffer);
  
    const offerDescription = {
      sdp: callOffer.sdp,
      type: callOffer.type,
    };
  
    await updateDoc(callDoc, { offer: offerDescription });
  
    onSnapshot(callDoc, (docSnapshot) => {
      const data = docSnapshot.data();
      if (data.answer && !peerConnectionRef.current.currentRemoteDescription) {
        const answerDescription = new RTCSessionDescription(data.answer);
        peerConnectionRef.current.setRemoteDescription(answerDescription);
      }
  
      if (data.answerCandidates) {
        data.answerCandidates.forEach(candidate => {
          peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        });
      }
    });
  };
  
  const answerCall = async () => {
    setIsCallOngoing(true);
    peerConnectionRef.current = new RTCPeerConnection(configuration);
  
    const localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localStream.getTracks().forEach(track => {
      peerConnectionRef.current.addTrack(track, localStream);
    });
  
    setLocalStream(localStream);
    localVideoRef.current.srcObject = localStream;
  
    peerConnectionRef.current.ontrack = (event) => {
      const [remoteStream] = event.streams;
      setRemoteStream(remoteStream);
      remoteVideoRef.current.srcObject = remoteStream;
    };
  
    peerConnectionRef.current.onicecandidate = (event) => {
      if (event.candidate) {
        callDocRef.current.update({
          'answerCandidates': arrayUnion(event.candidate.toJSON())
        });
      }
    };
  
    const callDoc = doc(db, 'calls', chatId);
    callDocRef.current = callDoc;
  
    const callData = (await getDoc(callDoc)).data();
    const offerDescription = callData.offer;
    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offerDescription));
  
    const answerDescription = await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answerDescription);
  
    const answer = {
      sdp: answerDescription.sdp,
      type: answerDescription.type,
    };
  
    await updateDoc(callDoc, { answer });
  
    onSnapshot(callDoc, (docSnapshot) => {
      const data = docSnapshot.data();
      if (data.offerCandidates) {
        data.offerCandidates.forEach(candidate => {
          peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
        });
      }
    });
  };
  
  const endCall = () => {
    setIsCallOngoing(false);
    localStream.getTracks().forEach(track => track.stop());
    remoteStream.getTracks().forEach(track => track.stop());
    peerConnectionRef.current.close();
    peerConnectionRef.current = null;
  };

  const handleTagMessage = (message) => {
    setTaggedMessage(message);
  };

  

  return (
    <div className='chat'>
      <div className="top">
        <div className="user">
          <img src={user?.avatar || "./avatar.png"} alt="" />
          <div className="texts">
            <span>{user && user.username}</span>
            {lastSeen && <p>Last Seen: {new Date(lastSeen).toLocaleTimeString()}</p>}
          </div>
        </div>
        <div className="icons">
          <img src="./phone.png" alt="" onClick={() => startCall(false)} />
          <img src="./video.png" alt="" onClick={() => startCall(true)} />
          <div className='info'>
            <img src="./info.png" alt="" />
          </div>
          <button onClick={handleClearChat}>Clear Chat</button>
        </div>
      </div>
      <div className="center">
        {chat?.messages && chat.messages.map((message) => (
          <div className={message.senderId === currentUser?.id ? "message own" : "message"} key={message?.createdAt}>
            <div className="texts">
              {message.img && <img src={message.img} alt="" />}
              {message.text && <p>{message.text}</p>}
              {message.audio && <audio controls src={message.audio}></audio>}
              {message.document && (
                <div>
                  <a href={message.document} target="_blank" rel="noopener noreferrer">
                    {message.documentName}
                  </a>
                </div>
              )}
              {message.taggedMessage && (
                <div className="tagged-message">
                  <span>Tagged:</span>
                  <p>{message.taggedMessage.text}</p>
                  {message.taggedMessage.img && <img src={message.taggedMessage.img} alt="Tagged Content" />}
                  {message.taggedMessage.audio && <audio controls src={message.taggedMessage.audio} />}
                  {message.taggedMessage.document && (
                    <a href={message.taggedMessage.document} download={message.taggedMessage.documentName}>
                      {message.taggedMessage.documentName}
                    </a>
                  )}
                </div>
              )}
              <span>{new Date(message.createdAt).toLocaleTimeString()}</span>
            </div>
            {/* Button to tag a message */}
            <button onClick={() => handleTagMessage(message)}>Tag</button>
          </div>
        ))}
        <div ref={endRef}></div>
      </div>
      <div className="bottom">
        <div className="icons">
          <label htmlFor="file" style={{ cursor: (isCurrentUserBlocked || isReceiverBlocked) ? "not-allowed" : "pointer" }}>
            <img src="img.png" alt="" />
          </label>
          <input type="file" id="file" style={{ display: "none" }} onChange={handleImg} disabled={isCurrentUserBlocked || isReceiverBlocked} />
          <label htmlFor="document" style={{ cursor: (isCurrentUserBlocked || isReceiverBlocked) ? "not-allowed" : "pointer" }}>
            <img src="plus.png" alt="" />
          </label>
          <input type="file" id="document" style={{ display: "none" }} onChange={handleDocument} disabled={isCurrentUserBlocked || isReceiverBlocked} />
          <img src="camera.png" alt="" onClick={openCamera} style={{ cursor: (isCurrentUserBlocked || isReceiverBlocked) ? "not-allowed" : "pointer" }} />
          {isRecording ? (
            <img src="stop.png" alt="Stop recording" onClick={stopRecording} />
          ) : (
            <img src="mic.png" alt="Start recording" onClick={startRecording} style={{ cursor: (isCurrentUserBlocked || isReceiverBlocked) ? "not-allowed" : "pointer" }} />
          )}
        </div>
        <input type="text" placeholder={(isCurrentUserBlocked || isReceiverBlocked) ? "You cannot send a message" : 'Type a message...'} value={text} onChange={(e) => setText(e.target.value)} disabled={isCurrentUserBlocked || isReceiverBlocked} />
        <div className="emoji">
          <img src="./emoji.png" alt="" onClick={() => setOpen((prev) => !prev)} />
          <div className="picker">
            <EmojiPicker open={open} onEmojiClick={handleEmoji} />
          </div>
        </div>
        <button className='sendButton' onClick={handleSend} disabled={isCurrentUserBlocked || isReceiverBlocked}>Send</button>
      </div>
      {isPreviewOpen && (
        <div className="preview">
          <h3>Image Preview</h3>
          <img src={img.url || URL.createObjectURL(capturedImg)} alt="Preview" />
          <button onClick={handleSend}>Send Image</button>
          <button onClick={() => {
            setImg({ file: null, url: "" });
            setCapturedImg(null);
            setIsPreviewOpen(false);
          }}>Cancel</button>
        </div>
      )}
      {isCameraOpen && (
        <div className="camera">
          <video ref={videoRef} autoPlay playsInline></video>
          <button onClick={captureImage}>Capture</button>
          <button onClick={closeCamera}>Close</button>
          <canvas ref={canvasRef} style={{ display: 'none' }} width="400" height="300"></canvas>
        </div>
      )}
      {isAudioPreviewOpen && (
        <div className="preview">
          <h3>Preview Voice Message</h3>
          <audio controls src={audioPreview}></audio>
          <button onClick={handleConfirmAudioPreview}>Send</button>
          <button className="cancel" onClick={handleCancelAudioPreview}>Cancel</button>
        </div>
      )}
      {isDocumentPreviewOpen && (
        <div className="preview">
          <h3>Document Preview</h3>
          <p>{document.name}</p>
          <button onClick={handleSend}>Send Document</button>
          <button onClick={() => {
            setDocument({ file: null, name: "" });
            setIsDocumentPreviewOpen(false);
          }}>Cancel</button>
        </div>
      )}
      {isCallOngoing && (
        <div className="call">
          <div className="video-container">
            <video className="local-video" ref={localVideoRef} autoPlay muted></video>
            <video className="remote-video" ref={remoteVideoRef} autoPlay></video>
          </div>
        <button onClick={endCall}>End Call</button>
        </div>
      )}

      {taggedMessage && (
        <div className="tagged-message-preview">
          <span>Replying to:</span>
          <p>{taggedMessage.text}</p>
          {taggedMessage.img && <img src={taggedMessage.img} alt="Tagged Content" />}
          {taggedMessage.audio && <audio controls src={taggedMessage.audio} />}
          {taggedMessage.document && (
            <a href={taggedMessage.document} download={taggedMessage.documentName}>
              {taggedMessage.documentName}
            </a>
          )}
          <button onClick={() => setTaggedMessage(null)}>Cancel</button>
        </div>
      )}

    </div>
  );
};

export default Chats;
