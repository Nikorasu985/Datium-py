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
        ...options,
        headers
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
                <img src="img/Datium logo modo claro.jpeg" alt="Datium" class="loading-logo block dark:hidden" />
                <img src="img/Datium logo modo oscuro.jpeg" alt="Datium" class="loading-logo hidden dark:block" />
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
    const spinner = document.getElementById('loading-spinner');
    const checkmark = document.getElementById('checkmark');
    const text = document.getElementById('loading-text');

    if (spinner) spinner.style.display = 'none';
    if (checkmark) checkmark.classList.add('show');

    if (text) {
        text.innerText = message;
        text.classList.add('success-text');
    }

    setTimeout(() => {
        hideLoading();
        if (callback) callback();
    }, 1500);
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
        if(toast) toast.classList.remove('translate-x-full');
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
        <div id="password-prompt-modal" class="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm opacity-0 transition-opacity duration-300">
            <div class="bg-white dark:bg-[#1e293b] rounded-2xl p-6 shadow-2xl max-w-sm w-full transform scale-95 transition-transform duration-300">
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
                if (onSuccess) onSuccess();
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


function showSuccessModal(title, message, buttons = []) {
    const existing = document.getElementById('success-modal');
    if (existing) existing.remove();

    let buttonsHtml = '';
    buttons.forEach((btn, index) => {
        const styleClass = btn.primary
            ? 'bg-gradient-to-r from-primary to-blue-600 text-white shadow-lg shadow-primary/30 hover:shadow-primary/50'
            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700';

        buttonsHtml += `
            <button id="success-btn-${index}" class="w-full py-3 rounded-xl font-bold text-sm transition-all ${styleClass}">
                ${btn.text}
            </button>
        `;
    });

    const html = `
        <div id="success-modal" class="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-white/90 dark:bg-[#0b1116]/90 backdrop-blur-md opacity-0 transition-opacity duration-300">
            <div class="bg-white dark:bg-[#151f2b] rounded-3xl p-8 shadow-2xl max-w-md w-full transform scale-95 transition-transform duration-500 border border-gray-200 dark:border-gray-800 relative overflow-hidden">
                
                <div class="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-primary to-blue-600"></div>

                <div class="flex flex-col items-center text-center">
                    <div class="mb-6 relative">
                        <div class="absolute inset-0 bg-green-500/20 blur-xl rounded-full"></div>
                        <div class="h-20 w-20 bg-green-50 dark:bg-green-900/10 rounded-full flex items-center justify-center relative z-10 mx-auto">
                            <span class="material-symbols-outlined text-5xl text-green-500 animate-bounce-slow">check_circle</span>
                        </div>
                    </div>
                    
                    <h2 class="text-2xl font-black text-[#111418] dark:text-white mb-3">${title}</h2>
                    <p class="text-gray-500 dark:text-gray-400 mb-8 leading-relaxed">${message}</p>
                    
                    <div class="flex flex-col gap-3 w-full">
                        ${buttonsHtml}
                    </div>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', html);
    const modal = document.getElementById('success-modal');

    // Bind events
    buttons.forEach((btn, index) => {
        document.getElementById(`success-btn-${index}`).onclick = () => {
            // Close modal? Maybe user navigation handles it.
            // If navigation, we don't need to close manually as checking out page destroys it.
            // But if specific action, close it first.
            if (btn.onClick) btn.onClick();
        };
    });

    // Trigger animation
    requestAnimationFrame(() => {
        modal.classList.remove('opacity-0');
        modal.querySelector('div').classList.remove('scale-95');
        modal.querySelector('div').classList.add('scale-100');
    });
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

document.addEventListener('DOMContentLoaded', () => {
    injectLoadingHTML();

    // Add overlay if not exists
    if (!document.getElementById('sidebarOverlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'sidebarOverlay';
        overlay.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-40 hidden md:hidden transition-opacity';
        overlay.onclick = toggleSidebar;
        document.body.appendChild(overlay);
    }
});
