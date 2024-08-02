import React from 'react';
import './userProfile.css';

const UserProfile = ({ user, onClose }) => {
  if (!user) return null;

  return (
    <div className="userProfileOverlay" onClick={onClose}>
      <div className="userProfile" onClick={(e) => e.stopPropagation()}>
        <button className="closeButton" onClick={onClose}>X</button>
        <img src={user.avatar || "./avatar.png"} alt="User Avatar" />
        <h2>{user.username}</h2>
        <p>Email: {user.email}</p>
        {/* <p>Phone: {user.phone}</p> */}
        <p>Bio: Hey there!{user.bio}</p>
        {/* Add more user information as needed */}
      </div>
    </div>
  );
};

export default UserProfile;
