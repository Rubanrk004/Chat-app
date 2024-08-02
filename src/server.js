import { useRef, useEffect } from 'react';

const useWebRTC = (signalingServerUrl) => {
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const signalingRef = useRef(null);

  useEffect(() => {
    signalingRef.current = new WebSocket(signalingServerUrl);

    signalingRef.current.onmessage = async (message) => {
      const data = JSON.parse(message.data);

      switch (data.type) {
        case 'offer':
          await handleOffer(data.offer);
          break;
        case 'answer':
          await handleAnswer(data.answer);
          break;
        case 'candidate':
          await handleCandidate(data.candidate);
          break;
        default:
          break;
      }
    };

    return () => {
      if (signalingRef.current) {
        signalingRef.current.close();
      }
    };
  }, [signalingServerUrl]);

  const createPeerConnection = () => {
    const peerConnection = new RTCPeerConnection();

    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        signalingRef.current.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
      }
    };

    peerConnection.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };

    return peerConnection;
  };

  const handleOffer = async (offer) => {
    peerConnectionRef.current = createPeerConnection();

    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(offer));

    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    stream.getTracks().forEach((track) => peerConnectionRef.current.addTrack(track, stream));

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    const answer = await peerConnectionRef.current.createAnswer();
    await peerConnectionRef.current.setLocalDescription(answer);

    signalingRef.current.send(JSON.stringify({ type: 'answer', answer }));
  };

  const handleAnswer = async (answer) => {
    await peerConnectionRef.current.setLocalDescription(new RTCSessionDescription(answer));
  };

  const handleCandidate = async (candidate) => {
    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(candidate));
  };

  const startCall = async (isVideoCall) => {
    peerConnectionRef.current = createPeerConnection();

    const stream = await navigator.mediaDevices.getUserMedia({ video: isVideoCall, audio: true });
    stream.getTracks().forEach((track) => peerConnectionRef.current.addTrack(track, stream));

    if (localVideoRef.current) {
      localVideoRef.current.srcObject = stream;
    }

    const offer = await peerConnectionRef.current.createOffer();
    await peerConnectionRef.current.setLocalDescription(offer);

    signalingRef.current.send(JSON.stringify({ type: 'offer', offer }));
  };

  const endCall = () => {
    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
      peerConnectionRef.current = null;
    }
  };

  return { localVideoRef, remoteVideoRef, startCall, endCall };
};

export default useWebRTC;
