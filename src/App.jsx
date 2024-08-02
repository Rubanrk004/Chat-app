import { useEffect } from "react"
import Chats from "./components/chats/Chats"
import Detail from "./components/details/Detail"
import List from "./components/list/List"
import Login from "./components/login/Login"
import Notification from "./components/notification/Notification"
import { onAuthStateChanged } from "firebase/auth"
import { auth } from "./lib/firebase"
import { useUserStore } from "./lib/userStore"
import usechatStore from "./lib/chatStore"
 
const App = () => {

  const {currentUser,isLoading,fetchUserinfo} = useUserStore();
  const {chatId} = usechatStore()

  useEffect(() =>{
     const unSub = onAuthStateChanged(auth,(user) =>{
      fetchUserinfo(user?.uid);
     });

     return () =>{
      unSub();
     };
  },[fetchUserinfo]);

  console.log(currentUser);

  if (isLoading) return <div className="loading">Loading...</div>
 
  return (
    <div className='container'>
      {
        currentUser?(
          <>
          <List />
          {chatId && <Chats />}
          {chatId && <Detail />}
          </>
        ):(<Login />)
      }
      <Notification />
 

    </div>
  )
}

export default App