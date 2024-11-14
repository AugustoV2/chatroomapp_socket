// server/server.js
const http = require('http');
const { Server } = require('socket.io');

// Set up an HTTP server
const server = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('WebSocket server is running');
});

const io = new Server(server, {
  cors: {
    origin: '*', // Allow CORS for development (Adjust as needed in production)
    methods: ['GET', 'POST']
  }
});

io.on('connection', (socket) => {
  console.log('A user connected');

  // Listen for 'chat message' and broadcast to all clients
  socket.on('chat message', ({ user, text }) => {
    io.emit('chat message', { user, text }); // Broadcast the message with the user's name
  });

  socket.on('disconnect', () => {
    console.log('A user disconnected');
  });
});

// Listen on port 3001
server.listen(3001, () => {
  console.log('WebSocket server listening on port 3001');
});
