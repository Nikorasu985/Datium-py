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
    return 'datium_chat_conversation_global';
}

async function initConversations() {
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
        const res = await fetch('/chatbot/conversations/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') },
            body: JSON.stringify({ title: 'Chat Global' })
        });
        if (!res.ok) return;
        const data = await res.json();
        const conv = data.conversation;
        currentConversationId = conv?.id || null;
        if (currentConversationId) {
            localStorage.setItem(conversationStorageKey(), String(currentConversationId));
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
                systems.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.innerText = s.name;
                    selector.appendChild(opt);
                });
            }
        }
    } catch (e) {
        console.error("Error loading systems", e);
    }
}

async function checkAiStatus() {
    const statusDot = document.getElementById('aiStatusDot');
    const statusText = document.getElementById('aiStatusText');
    if (!statusDot || !statusText) return;
    try {
        const res = await fetch('/chatbot/status/', { 
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') } 
        });
        if (res.ok) {
            const data = await res.json();
            if (data.status === 'ONLINE') {
                statusDot.className = 'w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]';
                statusText.innerText = 'IA lista';
            } else {
                statusDot.className = 'w-1.5 h-1.5 rounded-full bg-amber-500';
                statusText.innerText = 'IA no disponible';
            }
        }
    } catch (e) {
        if (statusDot) statusDot.className = 'w-1.5 h-1.5 rounded-full bg-red-500';
        if (statusText) statusText.innerText = 'Error de conexión';
    }
}

function renderWelcomeState() {
    const container = document.getElementById('chatMessages');
    if (!container) return;
    container.innerHTML = `
        <div class="max-w-4xl mx-auto w-full">
            <div class="rounded-[2rem] border border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/40 backdrop-blur-xl shadow-sm p-6 md:p-8">
                <div class="flex items-start gap-4">
                    <div class="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-cyan-500 text-white flex items-center justify-center shadow-lg shadow-primary/20 flex-shrink-0">
                        <span class="material-symbols-outlined text-3xl">auto_awesome</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <h2 class="text-2xl md:text-3xl font-black text-[#111418] dark:text-white">Datium AI</h2>
                            <span class="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-[0.18em] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-900/40">Lista ✨</span>
                        </div>
                        <p class="mt-2 text-sm md:text-base text-gray-600 dark:text-gray-300 leading-relaxed">Puedo ayudarte a crear, editar, consultar y ordenar tu sistema con lenguaje natural. Tengo el mismo acceso operativo que tu sesión actual, pero con validaciones antes de tocar cosas sensibles. 🛡️</p>
                    </div>
                </div>
                <div class="grid sm:grid-cols-2 gap-3 mt-6">
                    <button onclick="setSuggestion('Crea una tabla de asistentes para un evento con nombre, apellido y asistió')" class="text-left p-4 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-primary/30 hover:bg-blue-50/60 dark:hover:bg-blue-900/10 transition-all">
                        <div class="text-xs font-black uppercase tracking-widest text-primary mb-1">Crear estructura</div>
                        <div class="text-sm font-medium text-gray-700 dark:text-gray-200">Tabla para asistencia de evento ✅</div>
                    </button>
                    <button onclick="setSuggestion('Muéstrame las tablas del sistema actual y dime cuál conviene mejorar')" class="text-left p-4 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-primary/30 hover:bg-blue-50/60 dark:hover:bg-blue-900/10 transition-all">
                        <div class="text-xs font-black uppercase tracking-widest text-primary mb-1">Analizar</div>
                        <div class="text-sm font-medium text-gray-700 dark:text-gray-200">Revisar tablas, campos y oportunidades 📊</div>
                    </button>
                    <button onclick="setSuggestion('Quiero registrar asistentes con nombre, apellido, empresa y estado de ingreso')" class="text-left p-4 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-primary/30 hover:bg-blue-50/60 dark:hover:bg-blue-900/10 transition-all">
                        <div class="text-xs font-black uppercase tracking-widest text-primary mb-1">CRUD guiado</div>
                        <div class="text-sm font-medium text-gray-700 dark:text-gray-200">Diseñar tablas y campos exactos 🧩</div>
                    </button>
                    <button onclick="setSuggestion('Muéstrame los últimos cambios importantes y qué debería auditar')" class="text-left p-4 rounded-2xl border border-gray-200 dark:border-gray-700 hover:border-primary/30 hover:bg-blue-50/60 dark:hover:bg-blue-900/10 transition-all">
                        <div class="text-xs font-black uppercase tracking-widest text-primary mb-1">Auditoría</div>
                        <div class="text-sm font-medium text-gray-700 dark:text-gray-200">Cambios recientes, riesgos y trazabilidad 🔍</div>
                    </button>
                </div>
                <div class="mt-5 flex flex-wrap gap-2 text-[11px] text-gray-500 dark:text-gray-400 font-medium">
                    <span class="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">Aceptar / Cancelar</span>
                    <span class="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">Undo después de ejecutar</span>
                    <span class="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">Contraseña para eliminar</span>
                    <span class="px-3 py-1 rounded-full bg-gray-100 dark:bg-gray-800">Auditoría integrada</span>
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
        const url = `/chatbot/conversations/${currentConversationId}/`;
        const res = await fetch(url, { 
            method: 'DELETE',
            headers: { 'Authorization': 'Bearer ' + localStorage.getItem('token') } 
        });
        if (res.ok) {
            pendingAiActions = null;
            selectedFiles = [];
            renderFilePreviews();
            if (currentXhr) {
                try { currentXhr.abort(); } catch (e) {}
                currentXhr = null;
            }
            isWaitingResponse = false;
            toggleInputState(true);
            const container = document.getElementById('chatMessages');
            renderWelcomeState();
            addMessageToUI('ai', 'Listo. Limpié el chat y dejé la vista fresca para arrancar otra vez ✨', true);
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

function formatAiMessage(content) {
    if (!content) return "No hay contenido para mostrar.";

    const normalize = (txt) => {
        let t = (txt || '').trim();
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

        if (action === 'create_table' && payload?.name) {
            const f = (payload.fields || []).map(fd => {
                if (!fd?.name) return null;
                const extras = [];
                if (fd.type === 'relation' && fd.relatedTableName) extras.push(`relación con ${fd.relatedTableName}`);
                if (fd.type === 'select' && Array.isArray(fd.options) && fd.options.length) extras.push(fd.options.join(', '));
                return extras.length ? `${fd.name} (${extras.join(' · ')})` : fd.name;
            }).filter(Boolean);
            pushTable(payload.name, f.length ? f : ['(Sin campos definidos)']);
        }

        if (action === 'update_table' && payload?.name) {
            const f = (payload.fields || []).map(fd => fd?.name).filter(Boolean);
            pushTable(`Actualizar ${payload.name}`, f.length ? f : ['(Sin cambios de campos visibles)']);
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
            btnCancel.className = 'w-full py-3 rounded-2xl border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 font-black text-[10px] uppercase tracking-wider hover:bg-gray-100 dark:hover:bg-gray-800 transition-all';
            btnCancel.innerText = 'Cancelar';
            btnCancel.onclick = () => addMessageToUI('ai', 'Cancelado. No ejecuté ningún cambio 👍', true);

            const btn = document.createElement('button');
            btn.className = 'w-full py-3 rounded-2xl bg-emerald-500 text-white font-black text-[10px] uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all';
            btn.innerText = 'Aceptar y revisar';
            btn.onclick = () => openAiCrudModal(actions);

            btnRow.appendChild(btnCancel);
            btnRow.appendChild(btn);
            actionBox.appendChild(title);
            actionBox.appendChild(list);
            actionBox.appendChild(btnRow);
            inner.appendChild(actionBox);
        }

        if (quickAction && quickAction.label && typeof quickAction.onClick === 'function') {
            const quickBtn = document.createElement('button');
            quickBtn.className = 'mt-4 px-4 py-2.5 rounded-xl bg-amber-500 text-white font-black text-[10px] uppercase tracking-wider shadow-lg shadow-amber-500/20 hover:bg-amber-600 transition-all';
            quickBtn.innerText = quickAction.label;
            quickBtn.onclick = quickAction.onClick;
            inner.appendChild(quickBtn);
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
            addMessageToUI('ai', 'Error: ' + (data.error || 'Error desconocido'), true);
            return;
        }

        const results = (data && data.results) ? data.results : [];
        const okCount = results.filter(r => r.ok).length;
        const errCount = results.length - okCount;
        lastUndoActions = (data && data.undo_actions) ? data.undo_actions : [];

        let msg = `Listo ✨\n\n- Ejecutadas correctamente: ${okCount}`;
        if (errCount > 0) msg += `\n- Con error: ${errCount}`;
        if (results.some(r => r.error)) {
            msg += `\n\nDetalles\n` + results.filter(r => r.error).map(r => `- ${r.error}`).join('\n');
        }

        const links = results.flatMap(r => (r.links || [])).filter(l => l && l.url && l.label).slice(0, 8);
        if (links.length > 0) {
            msg += '\n\nAbrir cambios\n' + links.map(l => `- ${l.label}: ${l.url}`).join('\n');
        }

        if (lastUndoActions.length > 0) {
            msg += '\n\nPuedes deshacer este cambio con el botón Undo ↩️';
        }

        addMessageToUI('ai', msg, true, null, null, lastUndoActions.length > 0 ? {
            label: 'Undo',
            onClick: () => executeUndoActions()
        } : null);
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
    lastUndoActions = [];
    await executeAiActions(actions);
}

function initVoice() {
    const btnVoice = document.getElementById('btnVoice');
    const input = document.getElementById('chatInput');
    if (!btnVoice || (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window))) {
        if (btnVoice) btnVoice.style.display = 'none';
        return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.onstart = () => {
        btnVoice.classList.add('text-red-500', 'animate-pulse');
        btnVoice.querySelector('span').innerText = 'mic_active';
        input.placeholder = 'Escuchando...';
    };
    recognition.onend = () => {
        btnVoice.classList.remove('text-red-500', 'animate-pulse');
        btnVoice.querySelector('span').innerText = 'mic';
        input.placeholder = 'Escribe un mensaje para Datium AI...';
    };
    recognition.onresult = (event) => {
        input.value = event.results[0][0].transcript;
        const btnSend = document.getElementById('btnSend');
        if (btnSend) btnSend.disabled = false;
    };
    btnVoice.onclick = () => {
        recognition.start();
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

