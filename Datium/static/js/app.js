function getToken() {
    return localStorage.getItem('token');
}

function setToken(token) {
    localStorage.setItem('token', token);
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = 'login.html';
}

function checkAuth() {
    if (!getToken()) {
        window.location.href = 'login.html';
    }
}

async function apiFetch(endpoint, options = {}) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...options.headers
    };

    if (token) {
        headers['Authorization'] = 'Bearer ' + token;
    }

    const response = await fetch(API_URL + endpoint, {
        cache: 'no-store',
        ...options,
        headers,
        credentials: 'include'
    });

    if (response.status === 401) {
        logout();
        return;
    }

    return response;
}

function injectLoadingHTML() {
    if (document.getElementById('loading-overlay')) return;

    const loadingHTML = `
        <div class="loading-overlay" id="loading-overlay">
            <div class="loading-content">
                <img src="/static/img/Datium logo modo claro.jpeg" alt="Datium" class="loading-logo block dark:hidden" />
                <img src="/static/img/Datium logo modo oscuro.jpeg" alt="Datium" class="loading-logo hidden dark:block" />
                <div id="loading-spinner-container">
                    <div class="loading-spinner" id="loading-spinner"></div>
                    <div class="checkmark" id="checkmark"></div>
                    <div class="cross" id="cross"></div>
                </div>
                <p class="loading-text" id="loading-text">Cargando...</p>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', loadingHTML);
}

function showLoading(message = 'Cargando...') {
    injectLoadingHTML();
    const overlay = document.getElementById('loading-overlay');
    const spinner = document.getElementById('loading-spinner');
    const checkmark = document.getElementById('checkmark');
    const cross = document.getElementById('cross');
    const text = document.getElementById('loading-text');

    if (!overlay) return;

    spinner.style.display = 'block';
    spinner.className = 'loading-spinner';
    checkmark.classList.remove('show');
    cross.classList.remove('show');

    text.textContent = message;
    text.className = 'loading-text';

    overlay.classList.add('active');
}

function showSuccess(message = '¡Éxito!', callback = null) {
    hideLoading();
    showToast(message, 'success');
    if (callback) setTimeout(callback, 1500);
}

function showError(message = 'Ha ocurrido un error') {
    hideLoading();
    showToast(message, 'error');
}

function showToast(message, type = 'info') {
    // Remove existing toasts to avoid stacking too many (optional, or allow stacking)
    // Let's allow stacking but limit vertically
    const containerId = 'toast-container';
    let container = document.getElementById(containerId);

    if (!container) {
        container = document.createElement('div');
        container.id = containerId;
        container.className = 'fixed top-4 right-4 z-[120] flex flex-col gap-3 pointer-events-none';
        document.body.appendChild(container);
    }

    const toastId = 'toast-' + Date.now();
    const isError = type === 'error';
    const icon = isError ? 'error' : 'check_circle';
    const bgColor = isError ? 'bg-white dark:bg-[#1e293b]' : 'bg-white dark:bg-[#1e293b]'; // Use white/dark bg with colored border/icon
    const borderColor = isError ? 'border-l-4 border-red-500' : 'border-l-4 border-green-500';
    const iconColor = isError ? 'text-red-500' : 'text-green-500';

    const html = `
        <div id="${toastId}" class="pointer-events-auto min-w-[300px] max-w-md ${bgColor} ${borderColor} shadow-xl rounded-lg p-4 flex items-start gap-3 transform translate-x-full transition-all duration-300">
            <span class="material-symbols-outlined ${iconColor} mt-0.5">${icon}</span>
            <div class="flex-1">
                <h4 class="font-bold text-[#111418] dark:text-white text-sm mb-0.5">${isError ? 'Error' : 'Notificación'}</h4>
                <p class="text-gray-500 dark:text-gray-400 text-sm leading-tight">${message}</p>
            </div>
            <button onclick="document.getElementById('${toastId}').classList.add('translate-x-full', 'opacity-0'); setTimeout(() => document.getElementById('${toastId}').remove(), 300);" 
                class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition-colors">
                <span class="material-symbols-outlined text-lg">close</span>
            </button>
        </div>
    `;

    container.insertAdjacentHTML('beforeend', html);

    // Animate in
    requestAnimationFrame(() => {
        const toast = document.getElementById(toastId);
        if (toast) toast.classList.remove('translate-x-full');
    });

    // Auto remove
    setTimeout(() => {
        const toast = document.getElementById(toastId);
        if (toast) {
            toast.classList.add('translate-x-full', 'opacity-0');
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

function hideLoading() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.remove('active');
    }
}

function showConfirm(message, onConfirm) {
    // Remove existing if any
    const existing = document.getElementById('confirm-modal');
    if (existing) existing.remove();

    const html = `
        <div id="confirm-modal" class="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm opacity-0 transition-opacity duration-300">
            <div class="bg-white dark:bg-[#1e293b] rounded-2xl p-6 shadow-2xl max-w-sm w-full transform scale-95 transition-transform duration-300">
                <div class="flex flex-col gap-4 text-center">
                    <div class="mx-auto p-3 rounded-full bg-blue-50 dark:bg-blue-900/20 text-blue-500">
                        <span class="material-symbols-outlined text-3xl">help</span>
                    </div>
                    <h3 class="text-lg font-bold text-[#111418] dark:text-white">¿Estás seguro?</h3>
                    <p class="text-gray-500 dark:text-gray-400 text-sm">${message}</p>
                    <div class="flex gap-3 justify-center mt-2">
                        <button id="confirm-cancel" class="px-5 py-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-bold text-sm transition-colors">Cancelar</button>
                        <button id="confirm-ok" class="px-5 py-2 rounded-xl bg-gradient-to-r from-primary to-blue-600 text-white font-bold shadow-lg shadow-primary/30 hover:shadow-primary/50 text-sm transition-all">Confirmar</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    const modal = document.getElementById('confirm-modal');

    // Trigger animation
    requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
        modal.querySelector('div').classList.add('scale-100');
    });

    document.getElementById('confirm-cancel').onclick = () => {
        modal.classList.add('opacity-0');
        setTimeout(() => modal.remove(), 300);
    };

    document.getElementById('confirm-ok').onclick = () => {
        modal.classList.add('opacity-0');
        setTimeout(() => {
            modal.remove();
            if (onConfirm) onConfirm();
        }, 300);
    };
}

function promptPassword(onSuccess) {
    // Remove existing if any
    const existing = document.getElementById('password-prompt-modal');
    if (existing) existing.remove();

    const html = `
        <div id="password-prompt-modal" class="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-transparent opacity-0 transition-opacity duration-300">
            <div class="bg-white dark:bg-[#151f2b] rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-100 dark:border-gray-800 flex flex-col items-center text-center transform scale-95 transition-transform duration-300">
                <div class="flex flex-col gap-4 text-center">
                    <div class="mx-auto p-3 rounded-full bg-red-50 dark:bg-red-900/20 text-red-500">
                        <span class="material-symbols-outlined text-3xl">lock</span>
                    </div>
                    <h3 class="text-lg font-bold text-[#111418] dark:text-white">Verificación Requerida</h3>
                    <p class="text-gray-500 dark:text-gray-400 text-sm">Por seguridad, ingresa tu contraseña para continuar.</p>
                    
                    <div class="mt-2 text-left">
                        <input type="password" id="prompt-password-input" placeholder="Tu contraseña"
                            class="w-full px-4 py-3 rounded-xl border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 text-[#111418] dark:text-white focus:ring-2 focus:ring-primary/50 outline-none transition-all">
                        <p id="prompt-error" class="text-xs text-red-500 mt-2 hidden"></p>
                    </div>

                    <div class="flex gap-3 justify-center mt-2">
                        <button id="prompt-cancel" class="px-5 py-2 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 font-bold text-sm transition-colors">Cancelar</button>
                        <button id="prompt-confirm" class="px-5 py-2 rounded-xl bg-red-600 text-white font-bold shadow-lg shadow-red-500/30 hover:shadow-red-500/50 text-sm transition-all">Confirmar</button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    const modal = document.getElementById('password-prompt-modal');
    const input = document.getElementById('prompt-password-input');
    const errorMsg = document.getElementById('prompt-error');
    const confirmBtn = document.getElementById('prompt-confirm');

    // Trigger animation
    requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
        modal.querySelector('div').classList.add('scale-100');
        input.focus();
    });

    const close = () => {
        modal.classList.add('opacity-0');
        setTimeout(() => modal.remove(), 300);
    };

    document.getElementById('prompt-cancel').onclick = close;

    const verify = async () => {
        const password = input.value;
        if (!password) {
            errorMsg.innerText = "Ingresa tu contraseña";
            errorMsg.classList.remove('hidden');
            return;
        }

        confirmBtn.disabled = true;
        confirmBtn.innerText = "Verificando...";
        errorMsg.classList.add('hidden');

        try {
            const res = await apiFetch('/user/verify-password', {
                method: 'POST',
                body: JSON.stringify({ password })
            });

            if (res.ok) {
                close();
                if (onSuccess) onSuccess(password);
            } else {
                const data = await res.json();
                errorMsg.innerText = data.error || "Contraseña incorrecta";
                errorMsg.classList.remove('hidden');
                confirmBtn.disabled = false;
                confirmBtn.innerText = "Confirmar";
            }
        } catch (e) {
            errorMsg.innerText = "Error de conexión";
            errorMsg.classList.remove('hidden');
            confirmBtn.disabled = false;
            confirmBtn.innerText = "Confirmar";
        }
    };

    confirmBtn.onclick = verify;
    input.onkeyup = (e) => {
        if (e.key === 'Enter') verify();
    };
}



function toggleSidebar() {
    const sidebar = document.querySelector('aside');
    const overlay = document.getElementById('sidebarOverlay');

    if (sidebar) {
        if (sidebar.classList.contains('-translate-x-full')) {
            // Open
            sidebar.classList.remove('-translate-x-full');
            if (overlay) overlay.classList.remove('hidden');
        } else {
            // Close
            sidebar.classList.add('-translate-x-full');
            if (overlay) overlay.classList.add('hidden');
        }
    }
}

function injectAiNavLink() {
    const nav = document.querySelector('aside nav');
    if (!nav || document.querySelector('aside nav a[href="chat.html"]')) return;
    const current = (window.location.pathname || '').toLowerCase();
    const isChat = current.endsWith('/chat.html') || current.endsWith('/chatbot/chat.html');
    const active = isChat
        ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400 font-bold shadow-sm shadow-emerald-500/10'
        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 font-medium';
    const html = `
        <a href="chat.html" class="flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors ${active}">
            <span class="material-symbols-outlined">smart_toy</span>
            Datium IA
        </a>
    `;
    nav.insertAdjacentHTML('beforeend', html);
}


document.addEventListener('DOMContentLoaded', () => {
    injectLoadingHTML();
    injectAiNavLink();
    // Add overlay if not exists
    if (!document.getElementById('sidebarOverlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'sidebarOverlay';
        overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-40 hidden md:hidden transition-opacity';
        overlay.onclick = toggleSidebar;
        document.body.appendChild(overlay);
    }

    // Check if user is admin to inject Panel Admin button
    if (getToken() && !window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html')) {
        apiFetch('/user/profile').then(async res => {
            if (res && res.ok) {
                const user = await res.json();
                if (user.role === 'admin') {
                    const nav = document.querySelector('aside nav');
                    if (nav && !document.querySelector('a[href="admin.html"]')) {
                        const adminLink = `
                        <a href="admin.html" class="flex items-center gap-3 px-4 py-3 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-xl text-sm font-bold transition-colors mt-2 border-t border-gray-100 dark:border-gray-800 pt-4">
                            <span class="material-symbols-outlined">shield_person</span>
                            Panel Admin
                        </a>`;
                        nav.insertAdjacentHTML('beforeend', adminLink);
                    }
                }
            }
        }).catch(e => console.warn(e));
    }
});

// =========================================
// UNIVERSAL REPORT SYSTEM
// =========================================
function injectReportSystem() {
    if (!getToken()) return;
    if (document.getElementById('reportFab')) return;

    if (!window.html2canvas && !document.querySelector('script[data-report-capture="1"]')) {
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        script.dataset.reportCapture = '1';
        script.defer = true;
        document.head.appendChild(script);
    }

    const fabHtml = `
        <button id="reportFab" onclick="openReportModal()" class="fixed bottom-6 right-6 bg-red-600 hover:bg-red-700 text-white px-4 py-4 rounded-full shadow-2xl flex items-center justify-center z-50 group transition-all hover:scale-110" aria-label="Reportar problema">
            <span class="material-symbols-outlined">bug_report</span>
            <span class="max-w-0 overflow-hidden whitespace-nowrap group-hover:max-w-xs transition-all duration-300 ease-in-out font-bold group-hover:ml-2">Reportar Problema</span>
        </button>
    `;
    document.body.insertAdjacentHTML('beforeend', fabHtml);

    // 3. Modal de Reporte
    const modalHtml = `
        <div id="reportModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] hidden flex-col items-center justify-center p-4">
            <div class="bg-white dark:bg-gray-800 rounded-2xl w-full max-w-md p-6 shadow-2xl transform transition-transform scale-95 opacity-0 duration-200" id="reportModalContent">
                <div class="flex items-center gap-3 mb-6">
                    <div class="p-2 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl">
                        <span class="material-symbols-outlined font-bold">bug_report</span>
                    </div>
                    <h3 class="text-xl font-black text-gray-900 dark:text-white truncate">Reportar un Problema</h3>
                </div>
                
                <div class="space-y-4">
                    <div>
                        <label class="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Título del problema</label>
                        <input type="text" id="reportTitle" placeholder="Ej. El botón no funciona" class="w-full px-4 py-3 rounded-xl border-2 border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 dark:text-white focus:border-red-500 focus:ring-0 transition-colors">
                    </div>
                    <div>
                        <label class="block text-xs font-black text-gray-400 dark:text-gray-500 uppercase tracking-widest mb-2">Descripción Detallada</label>
                        <textarea id="reportSummary" rows="4" placeholder="¿Qué estabas intentando hacer? ¿Qué ocurrió?" class="w-full px-4 py-3 rounded-xl border-2 border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 dark:text-white focus:border-red-500 focus:ring-0 transition-colors resize-none"></textarea>
                    </div>
                    <div class="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30 rounded-xl">
                        <span class="material-symbols-outlined text-amber-500 mt-0.5">info</span>
                        <p class="text-xs text-amber-700 dark:text-amber-400 font-medium">Al enviar, se tomará automáticamente una captura de pantalla de tu vista actual para adjuntarla al reporte.</p>
                    </div>
                </div>

                <div class="flex justify-end gap-3 mt-8">
                    <button onclick="closeReportModal()" class="px-5 py-2.5 rounded-xl border-2 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 font-bold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">Cancelar</button>
                    <button onclick="submitReport()" class="px-5 py-2.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg shadow-red-600/20 transition-all flex items-center gap-2">
                        <span>Enviar Reporte</span>
                        <span class="material-symbols-outlined text-sm">send</span>
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

window.openReportModal = function () {
    const modal = document.getElementById('reportModal');
    const content = document.getElementById('reportModalContent');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    setTimeout(() => {
        content.classList.remove('scale-95', 'opacity-0');
    }, 10);
};

window.closeReportModal = function () {
    const modal = document.getElementById('reportModal');
    const content = document.getElementById('reportModalContent');
    content.classList.add('scale-95', 'opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.getElementById('reportTitle').value = '';
        document.getElementById('reportSummary').value = '';
    }, 200);
};

window.submitReport = async function () {
    const title = document.getElementById('reportTitle').value.trim();
    const summary = document.getElementById('reportSummary').value.trim();

    if (!title || !summary) return showError('Por favor completa todos los campos');

    closeReportModal();
    showLoading('Tomando captura de pantalla...');

    try {
        if (typeof html2canvas === 'undefined') {
            throw new Error('La librería de capturas aún no carga.');
        }

        const fab = document.getElementById('reportFab');
        if (fab) fab.style.display = 'none';

        const canvas = await html2canvas(document.body, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: document.documentElement.classList.contains('dark') ? '#101922' : '#f6f7f8'
        });

        if (fab) fab.style.display = '';

        showLoading('Subiendo evidencia...');
        const blob = await new Promise(res => canvas.toBlob(res, 'image/png'));
        const formData = new FormData();
        formData.append('file', blob, 'report.png');

        const token = getToken();
        let screenshotUrl = '';

        // This fails softly if the image is too big for the plan, but we'll try anyway
        try {
            const uploadRes = await fetch(API_URL + '/upload/image', {
                method: 'POST',
                headers: { 'Authorization': 'Bearer ' + token },
                body: formData
            });

            if (uploadRes.ok) {
                const data = await uploadRes.json();
                screenshotUrl = data.url;
            }
        } catch (e) {
            console.warn('Screenshot upload issue', e);
        }

        showLoading('Enviando reporte...');
        const repRes = await apiFetch('/user/reports', {
            method: 'POST',
            body: JSON.stringify({
                title, summary, screenshot_url: screenshotUrl
            })
        });

        if (repRes.ok) {
            showSuccess('Reporte enviado correctamente. El administrador lo revisará pronto.');
        } else {
            showError('Hubo un error al enviar el reporte');
        }

    } catch (e) {
        console.error(e);
        hideLoading();
        showError('No se pudo procesar tu reporte. ' + e.message);
    }
};

document.addEventListener('DOMContentLoaded', injectReportSystem);

