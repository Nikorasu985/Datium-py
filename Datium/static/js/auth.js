const API_URL = '/api';
let token = localStorage.getItem('token');
let usuarioActual = null;
let sistemaActual = null;

function obtenerToken() {
    return localStorage.getItem('token');
}

function guardarToken(newToken) {
    token = newToken;
    localStorage.setItem('token', newToken);
}

function eliminarToken() {
    token = null;
    localStorage.removeItem('token');
}

function obtenerHeaders() {
    return {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + obtenerToken()
    };
}

async function validarSesion(redirigirSiInvalido = true) {
    const currentToken = obtenerToken();
    if (!currentToken) {
        if (redirigirSiInvalido && 
            !window.location.pathname.includes('login.html') && 
            !window.location.pathname.includes('register.html') &&
            !window.location.pathname.includes('index.html') &&
            !(window.location.pathname === '/' || window.location.pathname === '')) {
            redirigirALogin();
        }
        return false;
    }
    return true;
}

function redirigirALogin() {
    window.location.href = 'login.html';
}

function redirigirADashboard() {
    window.location.href = 'dashboard.html';
}

function redirigirAIndex() {
    window.location.href = 'dashboard.html';
}

function inicializarTema() {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark' || (!theme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
    } else {
        document.documentElement.classList.remove('dark');
    }
    actualizarIconoTema();
}

function toggleTema() {
    const html = document.documentElement;
    if (html.classList.contains('dark')) {
        html.classList.remove('dark');
        localStorage.setItem('theme', 'light');
    } else {
        html.classList.add('dark');
        localStorage.setItem('theme', 'dark');
    }
    actualizarIconoTema();
}

function actualizarIconoTema() {
    const esOscuro = document.documentElement.classList.contains('dark');
    const iconos = document.querySelectorAll('#tema-icon, #tema-icon-dashboard, #tema-icon-sistema, #tema-icon-login, #tema-icon-register');
    iconos.forEach(icono => {
        if (icono) icono.textContent = esOscuro ? 'light_mode' : 'dark_mode';
    });

    const favicon = document.getElementById('favicon');
    if (favicon) {
        favicon.href = esOscuro ? '/static/img/Isotipo modo oscuro.jpeg' : '/static/img/Isotipo modo claro.jpeg';
    }
}

function togglePasswordVisibility(inputId, toggleId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    if (input.type === 'password') {
        input.type = 'text';
        toggle.querySelector('span').textContent = 'visibility';
    } else {
        input.type = 'password';
        toggle.querySelector('span').textContent = 'visibility_off';
    }
}

function obtenerAvatarUsuario(usuario) {
    if (usuario && usuario.avatarUrl && usuario.avatarUrl.trim() !== '') {
        return `<img src="${usuario.avatarUrl}" alt="${usuario.nombre || 'Usuario'}" class="w-8 h-8 rounded-full object-cover">`;
    } else {
        const isDark = document.documentElement.classList.contains('dark');
        return `<div class="isotipo-container w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
            <img src="/static/img/Isotipo modo claro.jpeg" alt="Datium" class="w-6 h-6 object-contain ${isDark ? 'hidden' : ''}"/>
            <img src="/static/img/Isotipo modo oscuro.jpeg" alt="Datium" class="w-6 h-6 object-contain ${isDark ? '' : 'hidden'}"/>
        </div>`;
    }
}

function cerrarSesion() {
    eliminarToken();
    redirigirALogin();
}

async function login() {
    const emailInput = document.getElementById('login-email');
    const passwordInput = document.getElementById('login-password');

    if (!emailInput || !passwordInput) {
        console.error('Campos de login no encontrados');
        return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    if (!email || !password) {
        showError('Por favor completa todos los campos');
        return;
    }

    showLoading('Iniciando sesión...');

    try {
        const response = await fetch(API_URL + '/autenticacion/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });

        let data;
        try {
            data = await response.json();
        } catch (e) {
            showError('Error de servidor. Verifique conexión.');
            console.error('Error parseando respuesta:', e);
            return;
        }

        if (response.ok && data.token) {
            guardarToken(data.token);
            if (data.usuario) {
                usuarioActual = data.usuario;
            }
            showSuccess('¡Bienvenido!', () => {
                if (data.usuario && data.usuario.role === 'admin') {
                    window.location.href = 'admin.html';
                } else {
                    redirigirAIndex();
                }
            });
        } else {
            showError('Error: ' + (data.error || 'Credenciales inválidas'));
        }
    } catch (error) {
        showError('Error de conexión.');
        console.error('Error en login:', error);
    }
}

async function registro() {
    const nombre = document.getElementById('registro-nombre').value.trim();
    const email = document.getElementById('registro-email').value.trim();
    // Get full international phone number if provided
    const numTel = document.getElementById('registro-telefono') ? document.getElementById('registro-telefono').value.trim() : '';
    let phone = '';
    if (numTel && window.iti) {
        phone = window.iti.getNumber(); // Gets full number with + and country code
    }

    const password = document.getElementById('registro-password').value;
    const planId = (typeof window !== 'undefined' && window.planSeleccionado) ? window.planSeleccionado : 1;

    if (!nombre || !email || !password) {
        showError('Por favor completa los campos obligatorios (Nombre, Email, Contraseña)');
        return;
    }

    if (!email.includes('@')) {
        showError('Por favor ingresa un email válido');
        return;
    }

    if (password.length < 6) {
        showError('La contraseña debe tener al menos 6 caracteres');
        return;
    }

    let strength = 0;
    if (password.length >= 6) strength++;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;

    if (strength <= 2) {
        showError('La contraseña es demasiado débil. Por favor usa una mezcla de letras, números y símbolos.');
        return;
    }

    showLoading('Creando tu cuenta...');

    try {
        const response = await fetch(API_URL + '/autenticacion/registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, phone, password, planId })
        });

        let data;
        try {
            data = await response.json();
        } catch (e) {
            showError('Error de servidor. Verifique conexion.');
            console.error('Error parseando respuesta registro:', e);
            return;
        }

        if (response.ok && data.token) {
            guardarToken(data.token);
            if (data.usuario) usuarioActual = data.usuario;
            showSuccess('Cuenta creada exitosamente!', () => {
                redirigirADashboard();
            });
        } else {
            showError('Error: ' + (data.error || 'No se pudo crear la cuenta'));
        }
    } catch (error) {
        showError('Error de conexion.');
        console.error('Error en registro:', error);
    }
}

async function recuperarPassword() {
    const email = document.getElementById('login-email').value;
    if (!email) {
        showError('Por favor ingresa tu email primero');
        return;
    }
    try {
        const response = await fetch(API_URL + '/autenticacion/recuperar-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await response.json();
        showSuccess(data.mensaje || 'Si existe, se envió el correo.', null);
    } catch (error) {
        showError('Error: ' + error.message);
    }
}

let lastActivity = Date.now();

async function checkTerms() {
    if (!usuarioActual) return;
    try {
        if (usuarioActual.needsTermsAcceptance) {
            showTermsModal(
                usuarioActual.termsContent || 'Acepta los nuevos términos y condiciones para continuar.',
                usuarioActual.termsVersion || 1
            );
        }
    } catch (e) {
        console.error("Error checking terms:", e);
    }
}

function showTermsModal(content, version) {
    if (document.getElementById('terms-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'terms-modal';
    modal.className = 'fixed inset-0 bg-black/80 backdrop-blur-md z-[9999] flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white dark:bg-[#101922] w-full max-w-2xl rounded-[2rem] shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[90vh]">
            <div class="p-8 border-b border-gray-100 dark:border-gray-800">
                <h3 class="text-2xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Términos y Condiciones</h3>
                <p class="text-xs text-primary font-black uppercase tracking-[0.2em] mt-1">Actualización requerida (v${version})</p>
            </div>
            <div class="p-8 overflow-y-auto text-sm text-gray-600 dark:text-gray-400 leading-relaxed font-medium prose dark:prose-invert max-w-none">
                ${content}
            </div>
            <div class="p-8 bg-gray-50/50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row gap-4">
                <button onclick="cerrarSesion()" class="flex-1 py-4 px-6 rounded-xl border border-gray-200 dark:border-gray-800 text-sm font-bold text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all uppercase tracking-widest">Rechazar y Salir</button>
                <button onclick="aceptarTerminos('${version}')" class="flex-[2] py-4 px-6 bg-primary text-white rounded-xl text-sm font-black uppercase tracking-widest hover:bg-primary/90 transition-all shadow-xl shadow-primary/20">Aceptar y Continuar</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

async function aceptarTerminos(version) {
    try {
        const res = await fetch(API_URL + '/autenticacion/aceptar-terminos', {
            method: 'POST',
            headers: obtenerHeaders(),
            body: JSON.stringify({ version })
        });
        if (res.ok) {
            document.getElementById('terms-modal').remove();
            if (usuarioActual) {
                usuarioActual.terms_version_accepted = version;
                usuarioActual.needsTermsAcceptance = false;
                usuarioActual.termsVersion = version;
            }
        }
    } catch (e) {
        showError("Error al aceptar términos");
    }
}

function initAutoLogout() {
    if (!usuarioActual) return;
    const timeoutMinutes = usuarioActual.session_timeout_minutes || 30;
    const timeoutMs = timeoutMinutes * 60 * 1000;

    const updateActivity = () => { lastActivity = Date.now(); };
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);

    setInterval(() => {
        if (Date.now() - lastActivity > timeoutMs) {
            console.log("Sesión expirada por inactividad");
            cerrarSesion();
        }
    }, 10000); // Check every 10s
}

document.addEventListener('DOMContentLoaded', async () => {
    const p = window.location.pathname;
    const isPublicPage = p.includes('login.html') || p.includes('register.html') || p.includes('index.html') || p === '/' || p === '';
    
    if (!isPublicPage) {
        const valid = await validarSesion();
        if (valid) {
            // Try to load current user if not already loaded
            if (!usuarioActual) {
                try {
                    const res = await fetch(API_URL + '/autenticacion/usuario', { headers: obtenerHeaders() });
                    if (res.ok) {
                        const data = await res.json();
                        usuarioActual = data;
                        checkTerms();
                        initAutoLogout();
                    }
                } catch (e) { }
            } else {
                checkTerms();
                initAutoLogout();
            }
        }
    }
    inicializarTema();
});
