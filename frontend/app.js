const API_URL = 'http://localhost:8000';

// DOM Elements
const pdfUpload = document.getElementById('pdf-upload');
const uploadStatus = document.getElementById('upload-status');
const documentList = document.getElementById('document-list');
const clearDocsBtn = document.getElementById('clear-docs-btn');
const activeDocName = document.getElementById('active-doc-name');
const activeDocStats = document.getElementById('active-doc-stats');
const chatMessages = document.getElementById('chat-messages');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const toast = document.getElementById('toast');
const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
const newChatBtn = document.getElementById('new-chat-btn');
const sidebar = document.getElementById('sidebar');

// State
let activeChatId = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchChats();
});

// Show Toast
function showToast(message, type = 'success') {
    toast.textContent = message;
    toast.className = `toast show ${type}`;
    setTimeout(() => {
        toast.className = 'toast';
    }, 3000);
}

// Fetch and display chats
async function fetchChats() {
    try {
        const response = await fetch(`${API_URL}/chats`);
        if (!response.ok) throw new Error('Failed to fetch chats');
        
        const chats = await response.json();
        renderChatList(chats);
    } catch (error) {
        showToast(error.message, 'error');
    }
}

// Render Chat List
function renderChatList(chats) {
    documentList.innerHTML = '';
    
    if (chats.length === 0) {
        documentList.innerHTML = '<li class="status-message">No chats found.</li>';
        return;
    }

    // Group by document
    const grouped = {};
    chats.forEach(chat => {
        if (!grouped[chat.pdf_name]) grouped[chat.pdf_name] = [];
        grouped[chat.pdf_name].push(chat);
    });

    for (const [pdfName, pdfChats] of Object.entries(grouped)) {
        // Document Header (like "Pinned" or "Projects")
        const headerLi = document.createElement('li');
        headerLi.className = 'chatgpt-section-header';
        headerLi.innerHTML = `<span>${pdfName}</span>`;
        documentList.appendChild(headerLi);

        // Sub-chats (like the folders/chats under it)
        pdfChats.forEach((chat, index) => {
            const li = document.createElement('li');
            li.className = `doc-item chatgpt-chat-item ${chat.chat_id === activeChatId ? 'active' : ''}`;
            
            // If they are sorted newest first, the top one is the latest.
            const sessionNum = pdfChats.length - index;
            const displayName = chat.chat_name || `Chat Session ${sessionNum}`;
            
            li.innerHTML = `
                <div class="sub-chat-main" onclick="selectChatWrapper('${chat.chat_id}')">
                    <div class="doc-icon"><i class="ph ph-chat-text"></i></div>
                    <div class="doc-info">
                        <span class="doc-name" id="name-${chat.chat_id}">${displayName}</span>
                    </div>
                </div>
                <div class="edit-icon" onclick="enableRename(event, '${chat.chat_id}', '${displayName.replace(/'/g, "\\'")}')">
                    <i class="ph ph-pencil-simple"></i>
                </div>
            `;
            // Store chat obj in a data structure or global if we want, but selectChat takes an object.
            // Let's attach the object to the DOM node for easy retrieval.
            li.chatData = chat;
            documentList.appendChild(li);
        });
    }
}

// Helper for sub-chat click
function selectChatWrapper(chatId) {
    const listItems = documentList.querySelectorAll('.chatgpt-chat-item');
    for (const li of listItems) {
        if (li.chatData && li.chatData.chat_id === chatId) {
            selectChat(li.chatData);
            break;
        }
    }
}

// Enable Renaming
function enableRename(event, chatId, currentName) {
    event.stopPropagation(); // prevent clicking the chat
    const nameSpan = document.getElementById(`name-${chatId}`);
    
    // Replace with input
    nameSpan.innerHTML = `<input type="text" class="rename-input" id="input-${chatId}" value="${currentName}" />`;
    const input = document.getElementById(`input-${chatId}`);
    input.focus();
    
    // Save on Enter or Blur
    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            input.blur();
        }
    });
    
    input.addEventListener('blur', async () => {
        const newName = input.value.trim();
        if (newName && newName !== currentName) {
            await renameChat(chatId, newName);
        } else {
            nameSpan.textContent = currentName;
        }
    });
}

// Rename Chat API Call
async function renameChat(chatId, newName) {
    try {
        const response = await fetch(`${API_URL}/chats/${chatId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_name: newName })
        });
        
        if (!response.ok) throw new Error('Failed to rename chat');
        showToast('Chat renamed!');
        fetchChats(); // Refresh list to get new names
    } catch (error) {
        showToast(error.message, 'error');
        fetchChats(); // Revert on error
    }
}

// Select a Chat
async function selectChat(chatItem) {
    activeChatId = chatItem.chat_id;
    
    // Update UI
    document.querySelectorAll('.doc-item').forEach(item => item.classList.remove('active'));
    // We can't rely on event.currentTarget if called manually, so we just re-render or find it.
    // It's easier to just re-render chat list to update active state
    fetchChats();
    
    activeDocName.textContent = chatItem.pdf_name;
    activeDocStats.textContent = `Chat ID: ${chatItem.chat_id.slice(0,12)}...`;
    
    chatInput.disabled = false;
    sendBtn.disabled = false;
    chatInput.focus();
    
    // Fetch chat history
    chatMessages.innerHTML = '<div class="status-message">Loading history...</div>';
    try {
        const response = await fetch(`${API_URL}/chats/${chatItem.chat_id}`);
        if (!response.ok) throw new Error('Failed to load chat history');
        const chatData = await response.json();
        
        chatMessages.innerHTML = '';
        
        if (chatData.messages.length === 0) {
            chatMessages.innerHTML = `
                <div class="welcome-message">
                    <i class="ph ph-chat-circle-dots"></i>
                    <p>You are now chatting with <strong>${chatData.pdf_name}</strong>.</p>
                </div>
            `;
        } else {
            chatData.messages.forEach(msg => {
                appendMessage(msg.role, msg.content, msg.sources || []);
            });
        }
    } catch (error) {
        showToast(error.message, 'error');
        chatMessages.innerHTML = '<div class="status-message">Error loading history.</div>';
    }
}

// Handle PDF Upload
pdfUpload.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    for (let i = 0; i < files.length; i++) {
        if (files[i].type !== 'application/pdf') {
            showToast(`File ${files[i].name} is not a valid PDF.`, 'error');
            return;
        }
        formData.append('files', files[i]);
    }

    uploadStatus.textContent = `Uploading and processing ${files.length} PDF(s)...`;
    
    try {
        const response = await fetch(`${API_URL}/upload`, {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.detail || 'Upload failed');
        
        if (data.is_duplicate) {
            showToast('Document already exists. Created new chat session!');
        } else {
            showToast('PDF uploaded successfully!');
        }
        
        uploadStatus.textContent = '';
        
        // Open the newly created chat
        selectChat(data);
        
    } catch (error) {
        uploadStatus.textContent = 'Upload failed.';
        showToast(error.message, 'error');
    } finally {
        e.target.value = ''; // Reset file input
    }
});

// Clear Documents
clearDocsBtn.addEventListener('click', async () => {
    if (!confirm('Are you sure you want to delete all data? This cannot be undone.')) return;
    
    try {
        const response = await fetch(`${API_URL}/documents`, { method: 'DELETE' });
        if (!response.ok) throw new Error('Failed to clear data');
        
        showToast('All data cleared.');
        activeChatId = null;
        activeDocName.textContent = 'Select a document to start chatting';
        activeDocStats.textContent = '';
        chatInput.disabled = true;
        sendBtn.disabled = true;
        chatMessages.innerHTML = `
            <div class="welcome-message">
                <i class="ph ph-chat-circle-dots"></i>
                <h2>Welcome to PDF Chatbot</h2>
                <p>Get started by uploading a PDF document. You can chat with it instantly!</p>
                <label for="pdf-upload" class="upload-btn main-upload-btn">
                    <i class="ph ph-upload-simple"></i> Choose PDF to Upload
                </label>
            </div>
        `;
        fetchChats();
    } catch (error) {
        showToast(error.message, 'error');
    }
});

// Append Message to Chat
// Append Message to Chat
function appendMessage(role, content, sources = []) {
    const msgDiv = document.createElement('div');
    msgDiv.className = `message ${role}`;
    msgDiv.dataset.rawText = content; // Store raw text for copying/editing
    
    let html = `<div class="message-content"><p>${content.replace(/\n/g, '<br>')}</p></div>`;
    
    if (sources && sources.length > 0) {
        const sourceTags = sources.map(s => {
            if (typeof s === 'object' && s !== null) {
                return `Page ${s.page || '?'}`;
            }
            return s;
        });
        const sourcesJson = JSON.stringify(sources).replace(/"/g, '&quot;');
        html += `<div class="source-docs" data-sources="${sourcesJson}">Sources: ${sourceTags.join(', ')}</div>`;
    }
    
    // Action bar
    html += `<div class="message-actions">`;
    
    if (role === 'user') {
        html += `
        <button class="action-btn copy-btn" title="Copy" onclick="copyMessageText(this)">
            <i class="ph ph-copy"></i>
        </button>
        <button class="action-btn edit-btn" title="Edit" onclick="editMessageText(this)">
            <i class="ph ph-pencil-simple"></i>
        </button>
        <button class="action-btn" title="Share prompt" onclick="showToast('Prompt shared to clipboard!', 'success')">
            <i class="ph ph-export"></i>
        </button>`;
    } else if (role === 'ai') {
        const timeString = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dateString = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        
        html += `
        <button class="action-btn copy-btn" title="Copy" onclick="copyMessageText(this)">
            <i class="ph ph-copy"></i>
        </button>
        <button class="action-btn" title="Good response" onclick="showToast('Feedback submitted', 'success')">
            <i class="ph ph-thumbs-up"></i>
        </button>
        <button class="action-btn" title="Bad response" onclick="showToast('Feedback submitted', 'error')">
            <i class="ph ph-thumbs-down"></i>
        </button>
        <button class="action-btn" title="Share" onclick="showToast('Share link copied to clipboard!', 'success')">
            <i class="ph ph-export"></i>
        </button>
        <button class="action-btn" title="Regenerate" onclick="showToast('Regenerating response...')">
            <i class="ph ph-arrows-clockwise"></i>
        </button>
        
        <div class="more-menu-container">
            <button class="action-btn more-btn" title="More" onclick="toggleMoreMenu(event, this)">
                <i class="ph ph-dots-three"></i>
            </button>
            <div class="more-popover">
                <div class="popover-header">${dateString}, ${timeString}</div>
                <div class="popover-item" onclick="viewSources(this)">
                    <i class="ph ph-book-open"></i> View sources
                </div>
                <div class="popover-item" onclick="showToast('Branched to new chat!', 'success')">
                    <i class="ph ph-git-branch"></i> Branch in new chat
                </div>
                <div class="popover-item" onclick="readAloud(this)">
                    <i class="ph ph-speaker-high"></i> Read aloud
                </div>
            </div>
        </div>`;
    }
    
    html += `</div>`;
    
    msgDiv.innerHTML = html;
    
    // Remove welcome message if it exists
    const welcome = chatMessages.querySelector('.welcome-message');
    if (welcome) welcome.remove();
    
    chatMessages.appendChild(msgDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Action Handlers
window.copyMessageText = function(btn) {
    const msgDiv = btn.closest('.message');
    const text = msgDiv.dataset.rawText;
    navigator.clipboard.writeText(text).then(() => {
        const icon = btn.querySelector('i');
        icon.className = 'ph ph-check text-green';
        setTimeout(() => icon.className = 'ph ph-copy', 2000);
    }).catch(err => console.error('Failed to copy', err));
};

window.editMessageText = function(btn) {
    const msgDiv = btn.closest('.message');
    const text = msgDiv.dataset.rawText;
    chatInput.value = text;
    chatInput.focus();
};

window.toggleMoreMenu = function(event, btn) {
    event.stopPropagation();
    const container = btn.closest('.more-menu-container');
    const popover = container.querySelector('.more-popover');
    
    // Close all other open popovers
    document.querySelectorAll('.more-popover.show').forEach(el => {
        if (el !== popover) el.classList.remove('show');
    });
    
    popover.classList.toggle('show');
};

// Close popovers when clicking outside
document.addEventListener('click', () => {
    document.querySelectorAll('.more-popover.show').forEach(el => {
        el.classList.remove('show');
    });
});

window.readAloud = function(btn) {
    const msgDiv = btn.closest('.message');
    const text = msgDiv.dataset.rawText;
    
    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Stop anything currently playing
        const utterance = new SpeechSynthesisUtterance(text);
        window.speechSynthesis.speak(utterance);
        showToast('Reading message aloud...', 'success');
    } else {
        showToast('Text-to-speech not supported in this browser.', 'error');
    }
};

// Show Typing Indicator
function showTypingIndicator() {
    const indicator = document.createElement('div');
    indicator.className = 'typing-indicator';
    indicator.id = 'typing-indicator';
    indicator.innerHTML = '<div class="dot"></div><div class="dot"></div><div class="dot"></div>';
    chatMessages.appendChild(indicator);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Hide Typing Indicator
function hideTypingIndicator() {
    const indicator = document.getElementById('typing-indicator');
    if (indicator) indicator.remove();
}

// Handle Chat Submission
chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const question = chatInput.value.trim();
    if (!question || !activeChatId) return;
    
    // UI Update for User Message
    appendMessage('user', question);
    chatInput.value = '';
    chatInput.disabled = true;
    sendBtn.disabled = true;
    
    showTypingIndicator();
    
    try {
        const response = await fetch(`${API_URL}/chat`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: activeChatId,
                question: question
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) throw new Error(data.detail || 'Failed to get response');
        
        hideTypingIndicator();
        appendMessage('ai', data.answer, data.sources || []);

        if (data.chat_name) {
            fetchChats(); // Refresh sidebar to show the new auto-generated title
        }
        
    } catch (error) {
        hideTypingIndicator();
        appendMessage('ai', `Error: ${error.message}`);
        showToast(error.message, 'error');
    } finally {
        chatInput.disabled = false;
        sendBtn.disabled = false;
        chatInput.focus();
    }
});

// Toggle Sidebar
toggleSidebarBtn.addEventListener('click', () => {
    sidebar.classList.toggle('closed');
});

// New Chat (Reset UI)
// Toggle Sidebar
newChatBtn.addEventListener('click', () => {
    activeChatId = null;
    document.querySelectorAll('.doc-item').forEach(item => item.classList.remove('active'));
    
    activeDocName.textContent = 'Select a document to start chatting';
    activeDocStats.textContent = '';
    
    chatInput.disabled = true;
    sendBtn.disabled = true;
    
    chatMessages.innerHTML = `
        <div class="welcome-message">
            <i class="ph ph-chat-circle-dots"></i>
            <h2>Welcome to PDF Chatbot</h2>
            <p>Get started by uploading a PDF document. You can chat with it instantly!</p>
            <label for="pdf-upload" class="upload-btn main-upload-btn">
                <i class="ph ph-upload-simple"></i> Choose PDF to Upload
            </label>
        </div>
    `;
    
    // Close sidebar on mobile/small screens for a clean state
    sidebar.classList.add('closed');
});

// Attach File Button
const attachBtn = document.getElementById('attach-file-btn');
if (attachBtn) {
    attachBtn.addEventListener('click', () => {
        document.getElementById('pdf-upload').click();
    });
}

// Voice Recording (Web Speech API)
const voiceBtn = document.getElementById('voice-record-btn');
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

if (SpeechRecognition && voiceBtn) {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    let isRecording = false;
    let originalPlaceholder = chatInput.placeholder;

    recognition.onstart = function() {
        isRecording = true;
        voiceBtn.classList.add('recording');
        originalPlaceholder = chatInput.placeholder;
        chatInput.placeholder = "Listening...";
        chatInput.disabled = false;
    };

    recognition.onresult = function(event) {
        let transcript = '';
        for (let i = 0; i < event.results.length; ++i) {
            transcript += event.results[i][0].transcript;
        }
        chatInput.value = transcript;
        chatInput.dispatchEvent(new Event('input')); // trigger send button toggle
    };

    recognition.onerror = function(event) {
        console.error('Speech recognition error:', event.error);
        if (event.error !== 'aborted') {
            showToast('Microphone error: ' + event.error, 'error');
        }
        stopRecording();
    };

    recognition.onend = function() {
        stopRecording();
    };

    function stopRecording() {
        isRecording = false;
        voiceBtn.classList.remove('recording');
        chatInput.placeholder = originalPlaceholder;
    }

    voiceBtn.addEventListener('click', () => {
        if (!activeChatId) {
            showToast('Please select a document or start a new chat first', 'error');
            return;
        }
        if (isRecording) {
            recognition.stop();
        } else {
            try {
                recognition.start();
            } catch(e) {
                console.error(e);
            }
        }
    });
} else if (voiceBtn) {
    voiceBtn.addEventListener('click', () => {
        showToast('Voice typing is not supported in this browser.', 'error');
    });
}

// Sidebar Resize Logic
const resizer = document.getElementById('sidebar-resizer');
let isResizing = false;

if (resizer && sidebar) {
    resizer.addEventListener('mousedown', (e) => {
        isResizing = true;
        resizer.classList.add('is-resizing');
        document.body.style.cursor = 'col-resize';
        // Prevent text selection while dragging
        document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;
        
        let newWidth = e.clientX;
        // Enforce min/max boundaries matching CSS
        if (newWidth < 200) newWidth = 200;
        if (newWidth > 800) newWidth = 800;
        
        sidebar.style.width = `${newWidth}px`;
    });

    document.addEventListener('mouseup', () => {
        if (isResizing) {
            isResizing = false;
            resizer.classList.remove('is-resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        }
    });
}

// View Sources Logic
const sourcesModal = document.getElementById('sources-modal');
const closeSourcesBtn = document.getElementById('close-sources-modal');
const sourcesModalBody = document.getElementById('sources-modal-body');

window.viewSources = function(btn) {
    const msgDiv = btn.closest('.message');
    const sourceDocsDiv = msgDiv.querySelector('.source-docs');
    
    if (!sourceDocsDiv) {
        showToast('No sources found for this response', 'error');
        return;
    }
    
    let sources = [];
    try {
        sources = JSON.parse(sourceDocsDiv.dataset.sources || '[]');
    } catch (e) {
        console.error('Error parsing sources', e);
    }
    
    if (sources.length === 0) {
        showToast('No sources found', 'error');
        return;
    }
    
    sourcesModalBody.innerHTML = '';
    
    sources.forEach(source => {
        if (typeof source !== 'object' || source === null) return;
        
        const item = document.createElement('div');
        item.className = 'source-item';
        
        const pdfName = source.pdf_name || 'Unknown PDF';
        const page = source.page ? `Page ${source.page}` : '';
        const text = source.text || 'No text extracted';
        
        item.innerHTML = `
            <div class="source-item-header">
                <span><i class="ph ph-file-pdf"></i> ${pdfName}</span>
                <span>${page}</span>
            </div>
            <div class="source-item-text">${text}</div>
        `;
        
        sourcesModalBody.appendChild(item);
    });
    
    sourcesModal.classList.add('show');
};

if (closeSourcesBtn) {
    closeSourcesBtn.addEventListener('click', () => {
        sourcesModal.classList.remove('show');
    });
}

window.addEventListener('click', (e) => {
    if (e.target === sourcesModal) {
        sourcesModal.classList.remove('show');
    }
});
