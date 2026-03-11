let currentSystemId = null;
let isWaitingResponse = false;

document.addEventListener('DOMContentLoaded', () => {
    loadSystemsForChat();
    checkAiStatus();
    
    document.getElementById('chatInput').addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    document.getElementById('btnSend').onclick = sendMessage;
    document.getElementById('chatSystemSelect').onchange = (e) => {
        currentSystemId = e.target.value;
        if (currentSystemId === "") currentSystemId = null;
        loadChatHistory(currentSystemId);
        if (currentSystemId) analyzeSystem(currentSystemId);
        
        const chatWelcome = document.getElementById('chatWelcome');
        if (currentSystemId && chatWelcome) chatWelcome.classList.add('hidden');
    };

    // Enable chat by default
    const chatInput = document.getElementById('chatInput');
    const btnSend = document.getElementById('btnSend');
    if (chatInput) chatInput.disabled = false;
    if (btnSend) btnSend.disabled = false;
    
    // Load global history on start
    loadChatHistory(null);
});

async function checkAiStatus() {
    const statusDot = document.getElementById('aiStatusDot');
    const statusText = document.getElementById('aiStatusText');
    
    if (!statusDot || !statusText) return;
    
    try {
        const res = await fetch('/chatbot/status/', { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            if (data.status === 'ONLINE') {
                statusDot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
                statusText.innerText = `Online: ${data.model}`;
            } else {
                statusDot.className = 'w-1.5 h-1.5 rounded-full bg-amber-500';
                statusText.innerText = `Offline: ${data.model}`;
            }
        }
    } catch (e) {
        if (statusDot) statusDot.className = 'w-1.5 h-1.5 rounded-full bg-red-500';
        if (statusText) statusText.innerText = 'Error de conexión';
    }
}

async function loadSystemsForChat() {
    const res = await apiFetch('/systems');
    if (res && res.ok) {
        const systems = await res.json();
        const select = document.getElementById('chatSystemSelect');
        if (!select) return;
        
        systems.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.innerText = s.name;
            select.appendChild(opt);
        });
    }
}

async function loadChatHistory(systemId) {
    const container = document.getElementById('chatMessages');
    const clearBtn = document.getElementById('btnClearHistory');
    if (!container) return;
    container.innerHTML = '';
    
    try {
        const url = systemId ? `/chatbot/history/${systemId}/` : '/chatbot/history/';
        const res = await fetch(url, { credentials: 'include' });
        if (res.ok) {
            const data = await res.json();
            if (data.status === 'success') {
                data.history.forEach(msg => {
                    addMessageToUI(msg.role, msg.content, false);
                });
                if (clearBtn) clearBtn.classList.toggle('hidden', data.history.length === 0);
            } else {
                if (clearBtn) clearBtn.classList.add('hidden');
            }
        } else {
            console.error('Error loading history:', res.status);
            if (res.status === 500) {
                container.innerHTML = `<div class="p-4 text-center text-red-500 text-sm font-bold">Error del servidor (500). Por favor revisa chatbot_error.log en la raíz del proyecto.</div>`;
            }
            if (clearBtn) clearBtn.classList.add('hidden');
        }
    } catch (e) {
        console.error("Error loading history", e);
        if (clearBtn) clearBtn.classList.add('hidden');
    }
}

async function clearHistory() {
    if (!currentSystemId) return;
    const confirmed = confirm('¿Estás seguro de limpiar todo el historial y archivos? Esta acción no se puede deshacer.');
    if (!confirmed) return;
    
    try {
        const url = currentSystemId ? `/chatbot/history/${currentSystemId}/clear/` : '/chatbot/history/clear/';
        const res = await fetch(url, { 
            method: 'POST',
            credentials: 'include'
        });
        if (res.ok) {
            const container = document.getElementById('chatMessages');
            if (container) container.innerHTML = '';
            const welcome = document.getElementById('chatWelcome');
            if (welcome) welcome.classList.remove('hidden');
            const clearBtn = document.getElementById('btnClearHistory');
            if (clearBtn) clearBtn.classList.add('hidden');
        }
    } catch (e) {
        console.error("Error clearing history", e);
    }
}

async function analyzeSystem(systemId) {
    addMessageToUI('ai', '⚡ Analizando sistema... Cargando esquemas, tablas y permisos.', true);
    // Simulate thinking/analyzing
    setTimeout(() => {
        const lastMsg = document.querySelector('#chatMessages > div:last-child');
        if (lastMsg && lastMsg.innerText.includes('Analizando')) {
            lastMsg.remove();
        }
        addMessageToUI('ai', '✅ Sistema analizado correctamente. ¿En qué puedo ayudarte hoy?', true);
    }, 1500);
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text || isWaitingResponse) return;

    addMessageToUI('user', text, true);
    input.value = '';
    isWaitingResponse = true;
    toggleInputState(false);

    // Typing indicator
    const typingId = addTypingIndicator();

    try {
        const formData = new FormData();
        formData.append('system_id', currentSystemId);
        formData.append('message', text);

        const res = await fetch('/chatbot/chat/', {
            method: 'POST',
            body: formData,
            credentials: 'include'
        });
        const data = await res.json();
        
        removeTypingIndicator(typingId);
        
        if (data.status === 'success') {
            addMessageToUI('ai', data.content, true);
        } else {
            addMessageToUI('ai', '❌ Error al procesar el mensaje: ' + data.message, true);
        }
    } catch (e) {
        removeTypingIndicator(typingId);
        addMessageToUI('ai', '❌ Error de red.', true);
    } finally {
        isWaitingResponse = false;
        toggleInputState(true);
    }
}

function addMessageToUI(role, content, animate) {
    const container = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `flex ${role === 'user' ? 'justify-end' : 'justify-start'} mb-6 items-end gap-2 ${animate ? 'animate-fade-in-up' : ''}`;
    
    const avatar = document.createElement('div');
    avatar.className = `h-8 w-8 rounded-full flex-shrink-0 overflow-hidden shadow-sm border border-white dark:border-gray-800 ${role === 'user' ? 'order-last' : 'order-first'}`;
    
    if (role === 'user') {
        const userImg = document.getElementById('userAvatar');
        if (userImg && !userImg.classList.contains('hidden')) {
            avatar.innerHTML = `<img src="${userImg.src}" class="h-full w-full object-cover">`;
        } else {
            avatar.className += ' bg-primary flex items-center justify-center text-[10px] text-white font-bold';
            avatar.innerText = (document.getElementById('userName')?.innerText || 'U').charAt(0).toUpperCase();
        }
    } else {
        avatar.className += ' bg-white dark:bg-gray-800 flex items-center justify-center';
        avatar.innerHTML = `<img src="/static/img/Isotipo modo oscuro.jpeg" class="h-full w-full object-cover">`;
    }

    const inner = document.createElement('div');
    inner.className = `max-w-[75%] p-3.5 text-sm leading-relaxed ${role === 'user' ? 'chat-bubble-user text-white shadow-lg shadow-primary/20' : 'chat-bubble-ai'}`;
    inner.style.cssText = role === 'user' ? 
        'border-radius: 18px 18px 2px 18px;' : 
        'border-radius: 18px 18px 18px 2px;';
    
    inner.innerText = content;
    
    div.appendChild(avatar);
    div.appendChild(inner);
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
}

function addTypingIndicator() {
    const container = document.getElementById('chatMessages');
    const id = 'typing-' + Date.now();
    const div = document.createElement('div');
    div.id = id;
    div.className = 'flex justify-start mb-4 animate-pulse';
    div.innerHTML = `
        <div class="chat-bubble-ai p-4 flex gap-1 items-center">
            <div class="typing-dot" style="animation-delay: 0s"></div>
            <div class="typing-dot" style="animation-delay: 0.2s"></div>
            <div class="typing-dot" style="animation-delay: 0.4s"></div>
        </div>
    `;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el) el.remove();
}

function toggleInputState(enabled) {
    document.getElementById('chatInput').disabled = !enabled;
    document.getElementById('btnSend').disabled = !enabled;
}

// Confirm Modal Support
function showConfirmation(text, callback) {
    const modal = document.getElementById('confirmModal');
    document.getElementById('confirmText').innerText = text;
    modal.classList.remove('hidden');
    window.confirmCallback = (result) => {
        modal.classList.add('hidden');
        callback(result);
    };
}

function closeConfirmModal(result) {
    if (window.confirmCallback) window.confirmCallback(result);
}
