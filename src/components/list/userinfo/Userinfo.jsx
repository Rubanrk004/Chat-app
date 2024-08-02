import React, { useEffect, useState } from 'react';
import './userinfo.css';
import useUserStore from "../../../lib/userStore";
import { auth } from '../../../lib/firebase';
import axios from 'axios';

const Userinfo = () => {
  const { currentUser, isLoading, fetchUserinfo, updateUsername } = useUserStore();
  const [isEditing, setIsEditing] = useState(false);
  const [username, setUsername] = useState("");
  const [news, setNews] = useState([]);
  const [isNewsVisible, setIsNewsVisible] = useState(false);
  const [isImageCentered, setIsImageCentered] = useState(false);

  useEffect(() => {
    const uid = auth.currentUser ? auth.currentUser.uid : null;
    fetchUserinfo(uid);
  }, [fetchUserinfo]);

  useEffect(() => {
    if (currentUser) {
      setUsername(currentUser.username);
    }
  }, [currentUser]);

  const handleEditClick = () => {
    setIsEditing(true);
  };

  const handleSaveClick = () => {
    updateUsername(auth.currentUser.uid, username);
    setIsEditing(false);
  };

  const handleCancelClick = () => {
    setUsername(currentUser.username);
    setIsEditing(false);
  };

  const fetchNews = async () => {
    const apiKey = '50f7478831cd445692a81225c76ffe25'; // Replace with your NewsAPI key
    try {
      const response = await axios.get(`https://newsapi.org/v2/top-headlines?country=us&apiKey=${apiKey}`);
      setNews(response.data.articles);
      setIsNewsVisible(true);
    } catch (error) {
      console.error("Error fetching news:", error);
    }
  };

  const handleBackClick = () => {
    setIsNewsVisible(false);
  };

  const handleImageClick = () => {
    setIsImageCentered(true);
  };

  const handleOverlayClick = () => {
    setIsImageCentered(false);
  };

  if (isLoading) {
    return <div className='userinfo'>Loading...</div>;
  }

  if (!currentUser) {
    return <div className='userinfo'>No user information available.</div>;
  }

  return (
    <div className='userinfo'>
      <div className="user">
        <img 
          src={currentUser.avatar || "./avatar.png"} 
          alt="User Avatar" 
          onClick={handleImageClick} 
        />
        {isEditing ? (
          <div>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <button onClick={handleSaveClick}>Save</button>
            <button onClick={handleCancelClick}>Cancel</button>
          </div>
        ) : (
          <h3>{currentUser.username}</h3>
        )}
      </div>
      <div className="icons">
        <img src="./edit.png" alt="Edit Icon" onClick={handleEditClick} />
        <button onClick={fetchNews}>News</button>
      </div>
      {isNewsVisible && (
        <div className="news-feed">
          <button className="back-button" onClick={handleBackClick}>Back</button>
          {news.length > 0 ? (
            news.map((article, index) => (
              <div key={index} className="news-article">
                {article.urlToImage && (
                  <img src={article.urlToImage} alt={article.title} />
                )}
                <div>
                  <h4>{article.title}</h4>
                  <p>{article.description}</p>
                  <a href={article.url} target="_blank" rel="noopener noreferrer">Read more</a>
                </div>
              </div>
            ))
          ) : (
            <div>No news articles available.</div>
          )}
        </div>
      )}
      {isImageCentered && (
        <div className="overlay" onClick={handleOverlayClick}>
          <img src={currentUser.avatar || "./avatar.png"} alt="User Avatar" className="centered-image" />
        </div>
      )}
    </div>
  );
}

export default Userinfo;
