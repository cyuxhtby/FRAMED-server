// Initialize the connection to the server
const socket = io();

// Reference to the necessary DOM elements
const chatBox = document.getElementById('chat-box');
const messageInput = document.getElementById('message-input');
const roomIdInput = document.getElementById('room-id-input');
const joinRoomBtn = document.getElementById('join-room-btn');
const sendBtn = document.getElementById('send-btn');

// Display incoming messages
function displayMessages(messages) {
    chatBox.innerHTML = '';
    messages.forEach(message => {
        const messageElement = document.createElement('div');
        messageElement.classList.add('mb-2', 'p-2', 'rounded', message.role === 'user' ? 'bg-blue-200' : 'bg-gray-200');
        messageElement.textContent = message.content;
        chatBox.appendChild(messageElement);
    });
    chatBox.scrollTop = chatBox.scrollHeight;
}

// Emit a joinRoom event when a new roomId is entered
joinRoomBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    if (roomId) {
        console.log("requesting init message");
        socket.emit('requestInitialMessage', {roomId, username: 'WaterFren'});
    } else {
        console.log("couldn't request init message");
    }
});

// Send a message when the "Send" button is clicked
sendBtn.addEventListener('click', () => {
    const roomId = roomIdInput.value.trim();
    const messageContent = messageInput.value.trim();

    if (roomId && messageContent) {
        socket.emit('sendMessage', roomId, { username: 'Water Fren', sender: 'user', content: messageContent });
        messageInput.value = '';  // Clear the input after sending
    }
});

// Handle the display of incoming messages
socket.on('newMessage', (message) => {
    displayMessages([message]);
});

// Fetch chat history when a new room ID is entered or changed
roomIdInput.addEventListener('change', () => {
    const roomId = roomIdInput.value.trim();
    if (roomId) {
        chatBox.innerHTML = '';  // Clear previous messages

        // Request the chat history for the entered room
        socket.emit('requestChatHistory', roomId, (chatHistory) => {
            displayMessages(chatHistory);
        });
    }
});
