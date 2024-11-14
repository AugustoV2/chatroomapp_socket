// pages/index.js
'use client';
import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:3001'); // Replace with your server URL

const Index = () => {
  const [messages, setMessages] = useState<{ user: string; text: string }[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [username, setUsername] = useState('');
  const [isNameSet, setIsNameSet] = useState(false);

  useEffect(() => {
    // Listen for incoming messages from the server and display them
    socket.on('chat message', (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    });

    // Clean up on component unmount
    return () => {
      socket.off('chat message');
    };
  }, []);

  const handleSetUsername = () => {
    if (username.trim() !== '') {
      setIsNameSet(true);
    }
  };

  const sendMessage = () => {
    if (newMessage.trim() !== '') {
      // Send the new message along with the username to the server
      socket.emit('chat message', { user: username, text: newMessage });
      setNewMessage(''); // Clear input field after sending
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-indigo-600 via-purple-500 to-pink-500 text-white font-sans">
      {!isNameSet ? (
        <div className="flex flex-col items-center w-full max-w-md animate-fade-in">
          <h1 className="text-3xl font-bold mb-6 text-shadow-lg">Kerrunno Mownuse</h1>
          <input
            type="text"
            className="p-3 w-full border-none rounded-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300 mb-6"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Enter your name"
          />
          <button
            onClick={handleSetUsername}
            className="px-6 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 transition-all transform hover:scale-105"
          >
            Join Chat
          </button>
        </div>
      ) : (
        <div className="flex flex-col items-center w-full max-w-lg animate-fade-in">
          <h1 className="text-4xl font-extrabold mb-6 text-shadow-lg">Real-Time Group Chat</h1>

          <div className="w-full max-h-96 overflow-y-auto bg-white p-4 rounded-lg shadow-inner mb-4 bg-opacity-10 backdrop-blur-sm scrollbar-thin scrollbar-thumb-purple-300 scrollbar-track-transparent">
            {messages.map((message, index) => (
              <div key={index} className="p-3 mb-2 bg-purple-100 bg-opacity-80 rounded-md text-gray-800 animate-slide-up">
                <strong className="text-purple-900">{message.user}:</strong> {message.text}
              </div>
            ))}
          </div>

          <div className="flex w-full">
            <input
              type="text"
              className="flex-1 p-3 border-none rounded-l-md text-gray-800 focus:outline-none focus:ring-2 focus:ring-pink-300"
              value={newMessage}
              placeholder="Type a message..."
              onChange={(e) => setNewMessage(e.target.value)}
            />
            <button
              onClick={sendMessage}
              className="px-4 py-3 bg-pink-600 text-white rounded-r-md hover:bg-pink-700 transition-all transform hover:scale-105"
            >
              Send
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Index;
