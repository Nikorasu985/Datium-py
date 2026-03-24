let currentSystemId = null;
let isWaitingResponse = false;
let selectedFiles = [];
let currentXhr = null;
let currentConversationId = null;
let lastUndoActions = [];

document.addEventListener('DOMContentLoaded', () => {
    checkAiStatus();
    initConversations();
    
    const chatInput = document.getElementById('chatInput');
    if (chatInput) {
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                sendMessage();
            }
        });
        chatInput.addEventListener('input', autoResizeChatInput);
        autoResizeChatInput();
        chatInput.focus();
    }

    const btnSend = document.getElementById('btnSend');
    if (btnSend) btnSend.onclick = sendMessage;
    
    const btnStop = document.getElementById('btnStop');
    if (btnStop) {
        btnStop.onclick = () => {
            if (currentXhr) {
                currentXhr.abort();
                isWaitingResponse = false;
                currentXhr = null;
                toggleInputState(true);
                const typingIndicators = document.querySelectorAll('[id^="typing-"]');
                typingIndicators.forEach(el => el.remove());
                addMessageToUI('ai', 'Respuesta interrumpida por el usuario.', true);
            }
        };
    }

    const fileInput = document.getElementById('fileInput');
    if (fileInput) {
        fileInput.onchange = () => handleFileSelect(fileInput);
    }

    initVoice();
    loadSystems();

    const systemSelector = document.getElementById('systemSelector');
    if (systemSelector) {
        systemSelector.addEventListener('change', () => {
            currentSystemId = systemSelector.value || null;
            initConversations();
        });
    }
});

function conversationStorageKey() {
    const sysId = currentSystemId || document.getElementById('systemSelector')?.value || 'global';
    return `datium_chat_conversation_${sysId}`;
}

function currentConversationTitle() {
    const selector = document.getElementById('systemSelector');
    if (selector && selector.value) {
        const name = selector.options[selector.selectedIndex]?.text || 'Sistema';
        return `${name} - IA`;
    }
    return 'Chat Global';
}

function undoStorageKey() {
    const conv = currentConversationId || localStorage.getItem(conversationStorageKey()) || 'none';
    return `datium_chat_undo_${conv}`;
}

function persistUndoActions() {
    try {
        if (lastUndoActions && lastUndoActions.length > 0) {
            localStorage.setItem(undoStorageKey(), JSON.stringify(lastUndoActions));
        } else {
            localStorage.removeItem(undoStorageKey());
        }
    } catch (e) {
        console.warn('Could not persist undo actions', e);
    }
    renderPersistentUndoBar();
}

function restoreUndoActions() {
    try {
        const raw = localStorage.getItem(undoStorageKey());
        lastUndoActions = raw ? JSON.parse(raw) : [];
    } catch (e) {
        lastUndoActions = [];
    }
    renderPersistentUndoBar();
}

function clearUndoActions() {
    lastUndoActions = [];
    persistUndoActions();
}

function renderPersistentUndoBar() {
    const bar = document.getElementById('persistentUndoBar');
    const label = document.getElementById('persistentUndoLabel');
    if (!bar || !label) return;
    if (Array.isArray(lastUndoActions) && lastUndoActions.length > 0) {
        label.innerText = `Hay ${lastUndoActions.length} cambio(s) disponibles para deshacer.`;
        bar.classList.remove('hidden');
    } else {
        bar.classList.add('hidden');
    }
}

async function initConversations() {
    currentConversationId = null;
    const stored = localStorage.getItem(conversationStorageKey());
    if (stored) currentConversationId = stored;
    if (!currentConversationId) {
        await createNewConversation(true);
    } else {
        await loadChatHistory();
    }
}

async function createNewConversation(silent = false) {
    try {
        const payload = { title: currentConversationTitle() };
        if (currentSystemId) payload.system_id = currentSystemId;
        const res = await fetch('/chatbot/conversations/' + (currentSystemId ? `?system_id=${encodeURIComponent(currentSystemId)}` : ''), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') },
            body: JSON.stringify(payload)
        });
        if (!res.ok) return;
        const data = await res.json();
        const conv = data.conversation;
        currentConversationId = conv?.id || null;
        if (currentConversationId) {
            localStorage.setItem(conversationStorageKey(), String(currentConversationId));
            restoreUndoActions();
            await loadChatHistory();
        }
    } catch (e) {
        console.error('Error creating conversation', e);
    }
}

async function loadSystems() {
    try {
        const res = await apiFetch('/systems');
        if (res && res.ok) {
            const systems = await res.json();
            const selector = document.getElementById('systemSelector');
            if (selector) {
                selector.innerHTML = '<option value="">Global</option>';
                systems.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.innerText = s.name;
                    selector.appendChild(opt);
                });
                if (currentSystemId) selector.value = String(currentSystemId);
            }
        }
    } catch (e) {
        console.error("Error loading systems", e);
    }
}

async function checkAiStatus() {
    try {
        await fetch('/chatbot/status/', {
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') }
        });
    } catch (e) {
        console.warn('AI status check failed', e);
    }
}

function renderWelcomeState() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    container.innerHTML = `
        <div class="max-w-5xl mx-auto w-full py-10 md:py-14">
            <div class="flex flex-col items-center justify-center gap-8 text-center">
                <img src="/static/img/Isotipo modo oscuro.jpeg" alt="Datium" class="w-24 h-24 md:w-28 md:h-28 object-contain opacity-95">
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl">
                    <button onclick="setSuggestion('Crea una tabla de asistentes para un evento con nombre, apellido y asistió')" class="bg-white dark:bg-[#151f2b] hover:bg-gray-50 dark:hover:bg-[#1e2c3d] rounded-xl p-4 border border-gray-200 dark:border-gray-800 hover:border-blue-500/50 transition-all text-left flex items-center gap-4 group shadow-sm">
                        <div class="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-500 group-hover:scale-110 transition-transform"><span class="material-symbols-outlined">table_chart</span></div>
                        <div><div class="text-blue-400 font-bold text-sm">Crear tabla</div><div class="text-gray-500 text-xs">Diseño exacto según lo que pidas</div></div>
                    </button>
                    <button onclick="setSuggestion('Crea registros de ejemplo para el sistema actual y dime qué hace falta completar')" class="bg-white dark:bg-[#151f2b] hover:bg-gray-50 dark:hover:bg-[#1e2c3d] rounded-xl p-4 border border-gray-200 dark:border-gray-800 hover:border-emerald-500/50 transition-all text-left flex items-center gap-4 group shadow-sm">
                        <div class="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform"><span class="material-symbols-outlined">playlist_add</span></div>
                        <div><div class="text-emerald-400 font-bold text-sm">Crear registros</div><div class="text-gray-500 text-xs">Insertar datos y completar estructura</div></div>
                    </button>
                    <button onclick="setSuggestion('Muéstrame las tablas del sistema actual y dime cuál conviene mejorar')" class="bg-white dark:bg-[#151f2b] hover:bg-gray-50 dark:hover:bg-[#1e2c3d] rounded-xl p-4 border border-gray-200 dark:border-gray-800 hover:border-purple-500/50 transition-all text-left flex items-center gap-4 group shadow-sm">
                        <div class="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-500 group-hover:scale-110 transition-transform"><span class="material-symbols-outlined">analytics</span></div>
                        <div><div class="text-purple-400 font-bold text-sm">Analizar estructura</div><div class="text-gray-500 text-xs">Tablas, campos, relaciones y mejoras</div></div>
                    </button>
                    <button onclick="setSuggestion('Muéstrame los últimos cambios importantes y qué debería auditar')" class="bg-white dark:bg-[#151f2b] hover:bg-gray-50 dark:hover:bg-[#1e2c3d] rounded-xl p-4 border border-gray-200 dark:border-gray-800 hover:border-orange-500/50 transition-all text-left flex items-center gap-4 group shadow-sm">
                        <div class="h-10 w-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-500 group-hover:scale-110 transition-transform"><span class="material-symbols-outlined">history</span></div>
                        <div><div class="text-orange-400 font-bold text-sm">Revisar auditoría</div><div class="text-gray-500 text-xs">Cambios sensibles, trazabilidad y riesgos</div></div>
                    </button>
                </div>
            </div>
        </div>`;
}

async function loadChatHistory() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    try {
        if (!currentConversationId) return;
        const url = `/chatbot/conversations/${currentConversationId}/`;
        const res = await fetch(url, {
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') } 
        });
        if (res.ok) {
            const data = await res.json();
            if (data.status === 'success' && data.history.length > 0) {
                container.innerHTML = '';
                data.history.forEach(msg => {
                    addMessageToUI(msg.role, msg.content, false);
                });
            } else {
                renderWelcomeState();
            }
            const selector = document.getElementById('systemSelector');
            if (selector && currentSystemId) selector.value = String(currentSystemId);
            restoreUndoActions();
        }
    } catch (e) {
        console.error("Error loading history", e);
    }
}

async function clearHistory() {
    // Check if promptPassword is globally available from app.js
    if (typeof promptPassword === 'function') {
        promptPassword(async () => {
            executeClearHistory();
        });
    } else {
        // Fallback if missing
        if (confirm('¿Vaciar historial del chat?')) {
            executeClearHistory();
        }
    }
}

async function executeClearHistory() {
    try {
        if (!currentConversationId) return;
        const prevConversationId = currentConversationId;
        const url = `/chatbot/conversations/${currentConversationId}/`;
        const res = await fetch(url, { 
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') } 
        });
        if (res.ok) {
            pendingAiActions = null;
            selectedFiles = [];
            clearUndoActions();
            try { localStorage.removeItem(`datium_chat_undo_${prevConversationId}`); } catch (e) {}
            renderFilePreviews();
            if (currentXhr) {
                try { currentXhr.abort(); } catch (e) {}
                currentXhr = null;
            }
            isWaitingResponse = false;
            toggleInputState(true);
            currentConversationId = null;
            localStorage.removeItem(conversationStorageKey());
            renderWelcomeState();
            addMessageToUI('ai', 'Listo. Borré el contexto de este chat y arranqué una conversación limpia ✨', true);
            await createNewConversation(true);
        } else {
            if(typeof window.showError === 'function') window.showError('Error al vaciar chat');
        }
    } catch (e) {
        console.error("Error clearing history", e);
    }
}

function handleFileSelect(input) {
    const files = Array.from(input.files);
    files.forEach(file => {
        if (!selectedFiles.find(f => f.name === file.name && f.size === file.size)) {
            selectedFiles.push(file);
        }
    });
    renderFilePreviews();
    input.value = '';
}

function renderFilePreviews() {
    const container = document.getElementById('filePreviewContainer');
    if (!container) return;
    if (selectedFiles.length === 0) {
        container.classList.add('hidden');
        return;
    }
    container.classList.remove('hidden');
    container.innerHTML = '';
    selectedFiles.forEach((file, index) => {
        const div = document.createElement('div');
        div.className = 'flex items-center gap-2 bg-white dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-200 dark:border-gray-700 text-xs shadow-sm animate-fade-in';
        let icon = 'description';
        if (file.type.includes('image')) icon = 'image';
        if (file.type.includes('pdf')) icon = 'picture_as_pdf';
        div.innerHTML = `
            <span class="material-symbols-outlined text-sm text-primary">${icon}</span>
            <span class="truncate max-w-[120px] font-medium dark:text-gray-300">${file.name}</span>
            <div class="text-[9px] text-gray-400 ml-1">Listo</div>
            <button onclick="removeFile(${index})" class="hover:text-red-500 transition-colors ml-1">
                <span class="material-symbols-outlined text-sm">close</span>
            </button>
        `;
        container.appendChild(div);
    });
}

function removeFile(index) {
    selectedFiles.splice(index, 1);
    renderFilePreviews();
}

async function sendMessage() {
    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text && selectedFiles.length === 0) return;
    if (isWaitingResponse) return;

    let displayContent = text;
    let systemInfo = null;
    const sysSelector = document.getElementById('systemSelector');
    if (sysSelector && sysSelector.value) {
        systemInfo = sysSelector.options[sysSelector.selectedIndex].text;
    }
    
    if (selectedFiles.length > 0) {
        displayContent += '\n\nAdjuntos: ' + selectedFiles.map(f => f.name).join(', ');
    }
    addMessageToUI('user', displayContent, true, null, systemInfo);
    
    const originalText = text;
    input.value = '';
    autoResizeChatInput();
    const filesToSend = [...selectedFiles];
    selectedFiles = [];
    renderFilePreviews();
    
    isWaitingResponse = true;
    toggleInputState(false);

    const typingId = addTypingIndicator();
    const typingBubble = document.querySelector(`#${typingId} .chat-bubble-ai`);
    
    const progressDiv = document.createElement('div');
    progressDiv.className = 'text-[10px] ml-2 text-gray-400 font-bold italic animate-pulse';
    progressDiv.id = 'uploadProgress';
    if (filesToSend.length > 0) {
        progressDiv.innerText = 'Subiendo archivos...';
        typingBubble.appendChild(progressDiv);
    }

    try {
        const formData = new FormData();
        formData.append('message', originalText);
        if (currentConversationId) formData.append('conversation_id', currentConversationId);
        
        const sysSelector = document.getElementById('systemSelector');
        if (sysSelector && sysSelector.value) {
            formData.append('system_id', sysSelector.value);
        }

        filesToSend.forEach((file, i) => {
            formData.append(`file_${i}`, file);
        });

        currentXhr = new XMLHttpRequest();
        currentXhr.open('POST', '/chatbot/chat/', true);
        currentXhr.setRequestHeader('Authorization', 'Bearer ' + localStorage.getItem('token'));
        
        currentXhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
                const percent = Math.round((e.loaded / e.total) * 100);
                const pEl = document.getElementById('uploadProgress');
                if (pEl) pEl.innerText = percent + '%';
            }
        };

        currentXhr.onload = async function() {
            if (!currentXhr) return;
            removeTypingIndicator(typingId);
            if (currentXhr.status === 200 || currentXhr.status === 201) {
                const data = JSON.parse(currentXhr.responseText);
                if (data.status === 'success') {
                    if (data.conversation && data.conversation.id) {
                        currentConversationId = data.conversation.id;
                        localStorage.setItem(conversationStorageKey(), String(currentConversationId));
                    }
                    addMessageToUI('ai', data.content, true, data.actions);
                } else {
                    addMessageToUI('ai', 'Error: ' + (data.error || data.message), true);
                }
            } else if (currentXhr.status === 402) {
                try {
                    const data = JSON.parse(currentXhr.responseText);
                    const plans = data.plans || [];
                    let msg = `### Datium AI no disponible en tu plan\n${data.error || ''}\n\n### Planes\n`;
                    msg += plans.map(p => `- **${p.name}**: ${p.ai ? 'Incluye IA' : 'Sin IA'}`).join('\n');
                    msg += `\n\n### Subir de plan\n- Abrir planes: ${data.upgradeUrl || '/profile.html'}`;
                    addMessageToUI('ai', msg, true);
                } catch (e) {
                    addMessageToUI('ai', 'Datium AI no está disponible en tu plan. Abre /profile.html para subir a Pro.', true);
                }
            } else {
                addMessageToUI('ai', 'Error del servidor: ' + currentXhr.status, true);
            }
            isWaitingResponse = false;
            currentXhr = null;
            toggleInputState(true);
            const btnClear = document.getElementById('btnClearHistory');
            if (btnClear) btnClear.classList.remove('hidden');
        };

        currentXhr.onerror = function() {
            if (!currentXhr) return;
            removeTypingIndicator(typingId);
            addMessageToUI('ai', 'Error de red.', true);
            isWaitingResponse = false;
            currentXhr = null;
            toggleInputState(true);
        };

        currentXhr.send(formData);

    } catch (e) {
        removeTypingIndicator(typingId);
        addMessageToUI('ai', 'Error inesperado.', true);
        isWaitingResponse = false;
        currentXhr = null;
        toggleInputState(true);
    }
}

function autoResizeChatInput() {
    const input = document.getElementById('chatInput');
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = `${Math.min(input.scrollHeight, 220)}px`;
}

function sanitizeAiText(content) {
    let t = String(content || '');
    t = t.replace(/[\uFFFD]/g, '');
    t = t.replace(/([A-Za-zÁÉÍÓÚáéíóúÑñ])([\u4E00-\u9FFF\u3040-\u30FF]+)(?=[A-Za-zÁÉÍÓÚáéíóúÑñ])/g, '$1 $3');
    t = t.replace(/([A-Za-zÁÉÍÓÚáéíóúÑñ])([\u4E00-\u9FFF\u3040-\u30FF]+)/g, '$1 ');
    t = t.replace(/([\u4E00-\u9FFF\u3040-\u30FF]+)([A-Za-zÁÉÍÓÚáéíóúÑñ])/g, ' $2');
    return t;
}

function formatAiMessage(content) {
    if (!content) return "No hay contenido para mostrar.";

    const normalize = (txt) => {
        let t = sanitizeAiText((txt || '').trim());
        t = t.replace(/^\s*#+\s*/gm, '');
        t = t.replace(/\?\?\?\?+/g, '');
        t = t.replace(/[^\S\r\n]+/g, ' ');
        return t;
    };

    let html = normalize(content)
        .replace(/Sistema: (.*)/g, '<div class="text-[10px] uppercase tracking-widest text-primary font-black mb-1">Sistema: $1</div>')
        .replace(/Tabla: (.*)/g, '<div class="text-xs font-bold dark:text-white mb-0.5">Tabla: $1</div>')
        .replace(/Filtro: (.*)/g, '<div class="text-xs text-gray-500 mb-0.5 italic">Filtro: $1</div>')
        .replace(/Estado: (.*)/g, '<div class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold mt-2">● $1</div>')
        .replace(/\*\*(.*?)\*\*/g, '<span class="font-black text-primary">$1</span>')
        .replace(/^####\s+(.*)/gm, '<span class="text-xs font-black text-primary/90 block mt-3 mb-1">$1</span>')
        .replace(/^###\s+(.*)/gm, '<span class="text-sm font-black text-primary block mt-3 mb-1">$1</span>')
        .replace(/^##\s+(.*)/gm, '<span class="text-base font-black text-primary block mt-3 mb-1">$1</span>')
        .replace(/^#\s+(.*)/gm, '<span class="text-lg font-black text-primary block mt-3 mb-1">$1</span>')
        .replace(/^\- (.*)/gm, '• $1')
        .replace(/^\* (.*)/gm, '• $1')
        .replace(/\n/g, '<br>');

    if (html.includes('|')) {
        const lines = html.split('<br>');
        let inTable = false;
        let tableHtml = '';
        let processedHtml = [];
        
        lines.forEach(line => {
            if (line.includes('|') && line.trim().startsWith('|')) {
                if (!inTable) {
                    inTable = true;
                    tableHtml = '<div class="overflow-x-auto my-3"><table class="w-full text-left border-collapse bg-white/5 dark:bg-gray-800/30 rounded-xl overflow-hidden">';
                }
                
                const cells = line.split('|').filter((c, i, a) => i > 0 && i < a.length - 1);
                if (line.includes('---')) return;
                
                tableHtml += '<tr class="border-b border-gray-100 dark:border-gray-700/50">';
                cells.forEach(cell => {
                    tableHtml += `<td class="p-2.5 text-xs">${cell.trim()}</td>`;
                });
                tableHtml += '</tr>';
            } else {
                if (inTable) {
                    inTable = false;
                    tableHtml += '</table></div>';
                    processedHtml.push(tableHtml);
                }
                processedHtml.push(line);
            }
        });
        if (inTable) {
            tableHtml += '</table></div>';
            processedHtml.push(tableHtml);
        }
        html = processedHtml.join('<br>');
    }

    return html;
}

function describeField(fd) {
    if (!fd?.name) return null;
    const extras = [];
    if (fd.type === 'relation' && fd.relatedTableName) extras.push(`relación con ${fd.relatedTableName}`);
    if (fd.type === 'select' && Array.isArray(fd.options) && fd.options.length) extras.push(fd.options.join(', '));
    return extras.length ? `${fd.name} (${extras.join(' · ')})` : fd.name;
}

function buildHumanPreviewFromActions(actions) {
    const a = Array.isArray(actions) ? actions : [];
    const lines = [];
    const pushTable = (name, fields) => {
        lines.push(`Tabla: ${name}`);
        (fields || []).forEach(f => lines.push(`- ${f}`));
        lines.push('');
    };

    a.forEach(x => {
        const action = x?.action || x?.type;
        const payload = x?.payload || {};

        if (action === 'create_system' && payload?.name) {
            lines.push(`Sistema: ${payload.name}`);
            if (payload.description) lines.push(`- ${payload.description}`);
            lines.push('');
            (payload.tables || []).forEach(tbl => {
                const f = (tbl.fields || []).map(describeField).filter(Boolean);
                pushTable(tbl.name || 'Tabla', f.length ? f : ['(Sin campos definidos)']);
            });
        }

        if (action === 'create_table' && payload?.name) {
            const f = (payload.fields || []).map(describeField).filter(Boolean);
            pushTable(payload.name, f.length ? f : ['(Sin campos definidos)']);
        }

        if (action === 'update_table' && payload?.name) {
            const f = (payload.fields || []).map(describeField).filter(Boolean);
            pushTable(`Actualizar ${payload.name}`, f.length ? f : ['(Sin cambios de campos visibles)']);
        }

        if (action === 'create_record' && payload?.values) {
            lines.push('Registro nuevo:');
            Object.entries(payload.values || {}).forEach(([k, v]) => lines.push(`- ${k}: ${v}`));
            lines.push('');
        }
    });

    return lines.join('\n').trim();
}

function addMessageToUI(role, content, animate, actions = null, systemName = null, quickAction = null) {
    const container = document.getElementById('chatMessages');
    
    const wrapper = document.createElement('div');
    wrapper.className = 'max-w-4xl mx-auto w-full';
    
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
    inner.className = `max-w-[85%] md:max-w-[75%] p-3.5 text-sm leading-relaxed ${role === 'user' ? 'chat-bubble-user text-white shadow-lg shadow-primary/20' : 'chat-bubble-ai'}`;
    inner.style.cssText = role === 'user' ? 'border-radius: 18px 18px 2px 18px;' : 'border-radius: 18px 18px 18px 2px;';
    
    if (role === 'assistant' || role === 'ai') {
        if (!content || content.trim() === "") content = "El asistente no devolvió una respuesta válida.";
        inner.innerHTML = formatAiMessage(content);
        if (actions && actions.length > 0) {
            const actionBox = document.createElement('div');
            actionBox.className = 'mt-4 p-4 rounded-2xl bg-gray-50/60 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700';
            const title = document.createElement('div');
            title.className = 'text-[11px] font-black uppercase tracking-widest text-gray-500 dark:text-gray-400 mb-2';
            title.innerText = 'Vista previa (antes de ejecutar)';
            const list = document.createElement('div');
            list.className = 'text-xs text-gray-700 dark:text-gray-200 whitespace-pre-line leading-relaxed';
            const preview = buildHumanPreviewFromActions(actions);
            list.innerText = preview || 'Se ejecutarán cambios en el sistema.';

            const btnRow = document.createElement('div');
            btnRow.className = 'mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2';

            const btnCancel = document.createElement('button');
            btnCancel.className = 'w-full py-3 rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900/40 text-gray-700 dark:text-gray-200 font-black text-[10px] uppercase tracking-[0.16em] hover:bg-gray-100 dark:hover:bg-gray-800 transition-all shadow-sm';
            btnCancel.innerText = 'Cancelar';
            btnCancel.onclick = () => addMessageToUI('ai', 'Cancelado. No ejecuté ningún cambio 👍', true);

            const btn = document.createElement('button');
            btn.className = 'w-full py-3 rounded-2xl bg-gradient-to-r from-emerald-500 to-teal-500 text-white font-black text-[10px] uppercase tracking-[0.16em] shadow-lg shadow-emerald-500/20 hover:from-emerald-600 hover:to-teal-600 transition-all';
            btn.innerText = 'Crear / aplicar';
            btn.onclick = () => openAiCrudModal(actions);

            btnRow.appendChild(btnCancel);
            btnRow.appendChild(btn);
            actionBox.appendChild(title);
            actionBox.appendChild(list);
            actionBox.appendChild(btnRow);
            inner.appendChild(actionBox);
        }

        const quickActions = Array.isArray(quickAction) ? quickAction : (quickAction ? [quickAction] : []);
        if (quickActions.length > 0) {
            const actionRow = document.createElement('div');
            actionRow.className = 'mt-4 flex flex-wrap gap-2';
            quickActions.forEach(action => {
                if (!action?.label || typeof action.onClick !== 'function') return;
                const quickBtn = document.createElement('button');
                quickBtn.className = (action.variant === 'primary'
                    ? 'px-4 py-2.5 rounded-xl bg-primary text-white font-black text-[10px] uppercase tracking-wider shadow-lg shadow-primary/20 hover:bg-blue-600 transition-all'
                    : 'px-4 py-2.5 rounded-xl bg-amber-500 text-white font-black text-[10px] uppercase tracking-wider shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all');
                quickBtn.innerText = action.label;
                quickBtn.onclick = action.onClick;
                actionRow.appendChild(quickBtn);
            });
            inner.appendChild(actionRow);
        }
    }
    else inner.innerText = content;
    div.appendChild(avatar);
    div.appendChild(inner);
    
    if (role === 'user' && systemName) {
        const badge = document.createElement('div');
        badge.className = 'flex items-center gap-1.5 mt-2 px-2.5 py-1 bg-primary/10 rounded-full border border-primary/20 text-[9px] font-black uppercase tracking-widest text-primary w-fit ml-auto animate-fade-in';
        badge.innerHTML = `
            <span class="material-symbols-outlined text-[10px]">target</span>
            Foco: ${systemName}
        `;
        wrapper.appendChild(div);
        wrapper.appendChild(badge);
    } else {
        wrapper.appendChild(div);
    }

    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
}

function addTypingIndicator() {
    const container = document.getElementById('chatMessages');
    const id = 'typing-' + Date.now();
    const wrapper = document.createElement('div');
    wrapper.className = 'max-w-4xl mx-auto w-full';
    
    const div = document.createElement('div');
    div.id = id;
    div.className = 'flex justify-start mb-4 animate-pulse';
    div.innerHTML = `
        <div class="chat-bubble-ai p-4 flex flex-col gap-2 items-start">
            <div class="flex gap-1 items-center">
                <div class="typing-dot" style="animation-delay: 0s"></div>
                <div class="typing-dot" style="animation-delay: 0.2s"></div>
                <div class="typing-dot" style="animation-delay: 0.4s"></div>
            </div>
        </div>
    `;
    wrapper.appendChild(div);
    container.appendChild(wrapper);
    container.scrollTop = container.scrollHeight;
    return id;
}

function removeTypingIndicator(id) {
    const el = document.getElementById(id);
    if (el && el.parentElement) el.parentElement.remove();
}

function toggleInputState(enabled) {
    const chatInput = document.getElementById('chatInput');
    const btnSend = document.getElementById('btnSend');
    const btnStop = document.getElementById('btnStop');
    
    if (chatInput) chatInput.disabled = !enabled;
    if (btnSend) btnSend.classList.toggle('hidden', !enabled);
    if (btnStop) btnStop.classList.toggle('hidden', enabled);
}

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

let pendingAiActions = null;

function isDestructiveAction(actionName) {
    return ['delete_system', 'delete_table', 'delete_record'].includes(actionName);
}

function openAiCrudModal(actions) {
    pendingAiActions = actions;
    const modal = document.getElementById('aiCrudModal');
    const summary = document.getElementById('aiCrudSummary');
    if (!modal || !summary) return;
    const lines = (actions || []).map((a) => {
        const name = a.action || a.type || 'acción';
        const payload = a.payload || {};
        const hint = payload.name || payload.tableName || payload.recordId || payload.tableId || payload.systemId || '';
        const icon = isDestructiveAction(name) ? '🗑️' : (name.startsWith('update_') ? '✏️' : '✨');
        return `${icon} ${name}${hint ? ` (${hint})` : ''}`;
    });
    const hasDelete = (actions || []).some(a => isDestructiveAction(a.action || a.type || ''));
    const footer = hasDelete ? '\n\n🔒 Esta operación incluye eliminación. Se pedirá contraseña antes de ejecutar.' : '\n\n✅ Podrás deshacer lo ejecutado con Undo si aplica.';
    summary.innerText = (lines.join('\n') || '—') + footer;
    modal.classList.remove('hidden');
}

function closeAiCrudModal(confirmed) {
    const modal = document.getElementById('aiCrudModal');
    if (modal) modal.classList.add('hidden');
    if (confirmed && pendingAiActions) {
        const actions = pendingAiActions;
        pendingAiActions = null;
        const needsPassword = actions.some(a => isDestructiveAction(a.action || a.type || ''));
        if (needsPassword) {
            promptPassword((password) => executeAiActions(actions, { password }));
            return;
        }
        executeAiActions(actions);
    } else {
        pendingAiActions = null;
        if (confirmed === false) addMessageToUI('ai', 'Operación cancelada. No toqué nada 👌', true);
    }
}

function humanizeCrudError(error) {
    const raw = String(error || '').trim();
    if (!raw) return 'Ocurrió un error al ejecutar el cambio.';
    if (raw.includes("Field 'id' expected a number but got")) {
        return 'Una relación entre tablas llegó con un nombre en vez de un ID real. Ya ajusté esta parte para resolver tablas nuevas correctamente; inténtalo otra vez.';
    }
    if (raw.toLowerCase().includes('no tienes permiso')) {
        return raw;
    }
    if (raw.toLowerCase().includes('contraseña')) {
        return raw;
    }
    return raw;
}

async function executeAiActions(actions, extra = {}) {
    addMessageToUI('ai', 'Voy con eso. Ejecutando cambios en Datium... ⚙️', true);
    const typingId = addTypingIndicator();
    try {
        const res = await fetch('/chatbot/execute/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') },
            body: JSON.stringify({ actions: actions, ...(extra || {}) })
        });
        removeTypingIndicator(typingId);
        const data = await res.json();
        if (!res.ok) {
            addMessageToUI('ai', 'No pude ejecutar ese cambio.\n\n- ' + humanizeCrudError(data.error || 'Error desconocido'), true);
            return;
        }

        const results = (data && data.results) ? data.results : [];
        const okCount = results.filter(r => r.ok).length;
        const errCount = results.length - okCount;
        lastUndoActions = (data && data.undo_actions) ? data.undo_actions : [];
        persistUndoActions();

        let msg = `Listo ✨\n\n- Ejecutadas correctamente: ${okCount}`;
        if (errCount > 0) msg += `\n- Con error: ${errCount}`;
        if (results.some(r => r.error)) {
            msg += `\n\nQué pasó\n` + results.filter(r => r.error).map(r => `- ${humanizeCrudError(r.error)}`).join('\n');
        }

        const links = results.flatMap(r => (r.links || [])).filter(l => l && l.url && l.label).slice(0, 8);
        const createdSystem = results.map(r => r.data).find(d => d && d.id && Array.isArray(d.tables));
        if (links.length > 0) {
            msg += '\n\nAbrir cambios\n' + links.map(l => `- ${l.label}: ${l.url}`).join('\n');
        }
        if (createdSystem) {
            const tableCount = Array.isArray(createdSystem.tables) ? createdSystem.tables.length : 0;
            msg += `\n\nEl sistema ya quedó listo${tableCount ? ` con ${tableCount} tabla${tableCount === 1 ? '' : 's'}` : ''}.`;
            if (Array.isArray(createdSystem.table_errors) && createdSystem.table_errors.length) {
                msg += `\n\nOjo: algunas tablas no se pudieron crear:` + createdSystem.table_errors.map(e => `\n- ${e.table}`).join('');
            }
        }

        if (lastUndoActions.length > 0) {
            msg += '\n\nPuedes deshacer este cambio con el botón Undo ↩️';
        }

        const quickActions = [];
        if (createdSystem?.id) {
            quickActions.push({
                label: 'Abrir sistema',
                variant: 'primary',
                onClick: () => { window.location.href = `/system.html?id=${createdSystem.id}`; }
            });
        } else if (links.length > 0) {
            quickActions.push({
                label: 'Abrir',
                variant: 'primary',
                onClick: () => { window.location.href = links[0].url; }
            });
        }
        if (lastUndoActions.length > 0) {
            quickActions.push({
                label: 'Undo',
                onClick: () => executeUndoActions()
            });
        }

        addMessageToUI('ai', msg, true, null, null, quickActions);
    } catch (e) {
        removeTypingIndicator(typingId);
        addMessageToUI('ai', 'Error de conexión.', true);
    }
}

async function executeUndoActions() {
    if (!lastUndoActions || lastUndoActions.length === 0) {
        addMessageToUI('ai', 'No tengo una acción reciente para deshacer.', true);
        return;
    }
    const actions = [...lastUndoActions];
    clearUndoActions();
    await executeAiActions(actions);
}

function initVoice() {
    const btnVoice = document.getElementById('btnVoice');
    const input = document.getElementById('chatInput');
    if (!btnVoice || !input || (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window))) {
        if (btnVoice) btnVoice.style.display = 'none';
        return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    let isRecording = false;
    let shouldKeepRecording = false;
    let finalTranscript = '';

    recognition.lang = 'es-ES';
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    const syncTranscriptToInput = (interim = '') => {
        const merged = `${finalTranscript} ${interim}`.replace(/\s+/g, ' ').trim();
        input.value = merged;
        autoResizeChatInput();
        const btnSend = document.getElementById('btnSend');
        if (btnSend) btnSend.disabled = !input.value.trim();
    };

    const resetVoiceUi = () => {
        isRecording = false;
        btnVoice.classList.remove('text-red-500', 'animate-pulse', 'bg-red-50');
        btnVoice.classList.add('text-gray-400');
        btnVoice.querySelector('span').innerText = 'mic';
        input.placeholder = 'Pídeme algo como: crea una tabla de asistentes, analiza este sistema o prepara un cambio...';
    };

    recognition.onstart = () => {
        isRecording = true;
        btnVoice.classList.remove('text-gray-400');
        btnVoice.classList.add('text-red-500', 'animate-pulse', 'bg-red-50');
        btnVoice.querySelector('span').innerText = 'mic_external_on';
        input.placeholder = 'Escuchando... pulsa el micrófono otra vez para terminar';
    };

    recognition.onresult = (event) => {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const part = event.results[i][0].transcript || '';
            if (event.results[i].isFinal) {
                finalTranscript = `${finalTranscript} ${part}`.trim();
            } else {
                interimTranscript += ` ${part}`;
            }
        }
        syncTranscriptToInput(interimTranscript);
    };

    recognition.onerror = () => {
        if (!shouldKeepRecording) {
            resetVoiceUi();
        }
    };

    recognition.onend = () => {
        if (shouldKeepRecording) {
            try { recognition.start(); return; } catch (e) {}
        }
        resetVoiceUi();
    };

    btnVoice.onclick = () => {
        if (isRecording || shouldKeepRecording) {
            shouldKeepRecording = false;
            recognition.stop();
            return;
        }
        finalTranscript = input.value.trim();
        shouldKeepRecording = true;
        try { recognition.start(); } catch (e) { resetVoiceUi(); }
    };
}

let aiSettingsCache = null;

function openAiSettings() {
    const modal = document.getElementById('aiSettingsModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    loadAiSettings();
}

function closeAiSettings() {
    const modal = document.getElementById('aiSettingsModal');
    if (!modal) return;
    modal.classList.add('hidden');
}

async function loadAiSettings() {
    try {
        const res = await fetch('/chatbot/settings/', {
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') },
        });
        if (!res.ok) return;
        const data = await res.json();
        aiSettingsCache = data.config || {};
        renderAiSettings();
    } catch (e) {
        console.error('Error loading AI settings', e);
    }
}

function renderAiSettings() {
    const enabledLabel = document.getElementById('aiEnabledLabel');
    const modelInput = document.getElementById('aiModelInput');
    if (!enabledLabel || !modelInput) return;

    const enabled = !!aiSettingsCache?.enabled;
    enabledLabel.innerText = enabled ? 'Asistente activo con permisos del usuario' : 'Asistente pausado';
    modelInput.value = aiSettingsCache?.model || 'datium-openclaw';
}

async function toggleAiEnabled() {
    const enabled = !(!!aiSettingsCache?.enabled);
    await saveAiSettings({ enabled });
}

async function saveAiSettings(extra = null) {
    const modelInput = document.getElementById('aiModelInput');
    const payload = {
        model: modelInput ? modelInput.value : (aiSettingsCache?.model || 'qwen3.5:cloud'),
        enabled: aiSettingsCache?.enabled ?? true,
        ...(extra || {}),
    };

    try {
        const res = await fetch('/chatbot/settings/', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') },
            body: JSON.stringify(payload),
        });
        if (!res.ok) return;
        const data = await res.json();
        aiSettingsCache = data.config || payload;
        renderAiSettings();
        checkAiStatus();
    } catch (e) {
        console.error('Error saving AI settings', e);
    }
}

