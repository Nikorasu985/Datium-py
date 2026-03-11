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
        if (redirigirSiInvalido && !window.location.pathname.includes('login.html') && !window.location.pathname.includes('register.html')) {
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
                redirigirAIndex();
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
    const password = document.getElementById('registro-password').value;
    const planId = (typeof window !== 'undefined' && window.planSeleccionado) ? window.planSeleccionado : 1;

    if (!nombre || !email || !password) {
        showError('Por favor completa todos los campos');
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

    showLoading('Creando tu cuenta...');

    try {
        const response = await fetch(API_URL + '/autenticacion/registro', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nombre, email, password, planId })
        });

        const data = await response.json();

        if (response.ok && data.token) {
            showSuccess('¡Cuenta creada exitosamente!', () => {
                redirigirADashboard();
            });
        } else {
            showError('Error: ' + (data.error || 'No se pudo crear la cuenta'));
        }
    } catch (error) {
        showError('Error de conexión.');
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

document.addEventListener('DOMContentLoaded', () => {
    const path = window.location.pathname;
    // inicializarTema(); // Handled in <head> to prevent flicker


});
