const ensureAuth = window.checkAuth || window.validarSesion;
if (ensureAuth) ensureAuth();

let editingSystemId = null;
let currentSystems = [];
let userProfile = null;
let activityChart = null;
let planChart = null;
let securityChart = null;
let promptCallback = null;

async function init() {
    await loadUserProfile();
    await Promise.all([loadSystems(), loadStatistics()]);

    window.addEventListener('message', (event) => {
        if (event.data.type === 'startLoading') {
            document.getElementById('loadingOverlay').classList.remove('hidden');
        } else if (event.data.type === 'stopLoading') {
            document.getElementById('loadingOverlay').classList.add('hidden');
        } else if (event.data.type === 'systemSaved') {
            document.getElementById('loadingOverlay').classList.add('hidden');
            toggleCreateForm();
            loadSystems();
            loadStatistics();
        } else if (event.data.type === 'closeModal') {
            toggleCreateForm();
        }
    });
}

async function loadUserProfile() {
    try {
        const res = await apiFetch('/user/profile');
        if (res && res.ok) {
            userProfile = await res.json();
            updateUserUI();
        } else {
            console.error('Error loading profile:', res ? res.status : 'No response');
        }
    } catch (error) {
        console.error('Exception loading profile:', error);
    }
}

function updateUserUI() {
    if (!userProfile) return;

    const nameEl = document.getElementById('userName');
    const emailEl = document.getElementById('userEmail');
    const initialEl = document.getElementById('userInitial');

    if (nameEl) nameEl.innerText = userProfile.name || 'Usuario';
    if (emailEl) emailEl.innerText = userProfile.email || '...';
    if (initialEl) initialEl.innerText = (userProfile.name || 'U').charAt(0).toUpperCase();

    if (userProfile.avatarUrl) {
        const avatarImg = document.getElementById('userAvatar');
        if (avatarImg) {
            avatarImg.src = userProfile.avatarUrl;
            avatarImg.classList.remove('hidden');
            if (initialEl) initialEl.classList.add('hidden');
        }
    }
}

async function loadSystems() {
    const res = await apiFetch('/systems');
    if (res && res.ok) {
        currentSystems = await res.json();
        renderSystemsTable();
        renderSystemsSlider();
    }
}

function renderSystemsTable() {
    const container = document.getElementById('systemsList');
    const emptyState = document.getElementById('emptyState');

    if (!container) return;

    if (currentSystems.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.classList.remove('hidden');
        return;
    }

    if (emptyState) emptyState.classList.add('hidden');

    container.innerHTML = currentSystems.map(system => {
        const createdDate = system.createdAt ? new Date(system.createdAt).toLocaleDateString('es-ES', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        }) : 'N/A';

        const imageUrl = system.imageUrl || 'img/Isotipo modo claro.jpeg';
        const securityIcon = system.securityMode === 'none' ? 'lock_open' :
            system.securityMode === 'general' ? 'lock' : 'admin_panel_settings';
        const securityColor = system.securityMode === 'none' ? 'text-gray-400' :
            system.securityMode === 'general' ? 'text-yellow-400' : 'text-green-400';

        return `
            <tr class="hover:bg-gray-50 dark:hover:bg-[#1a2634] transition-colors cursor-pointer" onclick="enterSystem(${system.id})">
                <td class="py-4 px-5">
                    <div class="flex items-center justify-center">
                        <img src="${imageUrl}" alt="${system.name}" 
                             class="w-10 h-10 rounded-lg object-cover border border-gray-700"
                             onerror="this.src='img/Isotipo modo claro.jpeg'">
                    </div>
                </td>
                <td class="py-4 px-5">
                    <div class="flex flex-col">
                        <span class="text-[#111418] dark:text-white font-bold text-sm">${system.name || 'Sin nombre'}</span>
                        <span class="text-gray-400 text-xs truncate max-w-xs">${system.description || 'Sin descripción'}</span>
                    </div>
                </td>
                <td class="py-4 px-5 text-center">
                    <div class="flex items-center justify-center gap-1">
                        <span class="material-symbols-outlined text-gray-400 text-sm">group</span>
                        <span class="text-[#111418] dark:text-white font-medium text-sm">${system.userCount || 1}</span>
                    </div>
                </td>
                <td class="py-4 px-5">
                    <div class="flex items-center gap-2">
                        <span class="material-symbols-outlined ${securityColor} text-sm">${securityIcon}</span>
                        <span class="text-gray-400 text-xs">${createdDate}</span>
                    </div>
                </td>

                <td class="py-4 px-5 text-right">
                    <div class="flex items-center justify-end gap-2">
                        ${(userProfile && system.ownerId === userProfile.id) ? `
                        <button onclick="openInvitationModal(event, ${system.id})" 
                                class="p-1.5 text-purple-400 hover:text-purple-300 hover:bg-purple-500/10 rounded-lg transition-colors"
                                title="Invitar Usuarios">
                            <span class="material-symbols-outlined text-sm">person_add</span>
                        </button>` : ''}
                        <button onclick="editSystem(event, ${system.id})" 
                                class="p-1.5 text-blue-400 hover:text-blue-300 hover:bg-blue-500/10 rounded-lg transition-colors"
                                title="Editar">
                            <span class="material-symbols-outlined text-sm">edit</span>
                        </button>
                        <button onclick="deleteSystem(event, ${system.id})" 
                                class="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                                title="Eliminar">
                            <span class="material-symbols-outlined text-sm">delete</span>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function renderSystemsSlider() {
    const sliderContainer = document.getElementById('systemsSlider');
    if (!sliderContainer || currentSystems.length === 0) return;

    sliderContainer.innerHTML = currentSystems.map((system, index) => {
        const imageUrl = system.imageUrl || 'img/Isotipo modo claro.jpeg';
        return `
            <div class="system-slide min-w-[280px] bg-white/20 dark:bg-black/20 backdrop-blur-md rounded-xl p-4 border border-white/20 dark:border-white/10 hover:bg-white/30 dark:hover:bg-black/30 transition-all cursor-pointer"
                 onclick="enterSystem(${system.id})">
                <div class="flex items-center gap-3 mb-3">
                    <img src="${imageUrl}" alt="${system.name}" 
                         class="w-24 h-24 rounded-lg object-cover border border-gray-700"
                         onerror="this.src='img/Isotipo modo claro.jpeg'">
                    <div class="flex-1 min-w-0">
                        <h4 class="text-[#111418] dark:text-white font-bold text-sm truncate">${system.name || 'Sin nombre'}</h4>
                        <p class="text-gray-400 text-xs truncate">${system.description || 'Sin descripción'}</p>
                    </div>
                </div>
                <div class="flex items-center justify-between text-xs">
                    <span class="text-gray-400">${system.userCount || 1} usuarios</span>
                    <span class="text-primary font-medium">Ver detalles →</span>
                </div>
            </div>
        `;
    }).join('');
}

async function enterSystem(id) {
    checkSystemAccess(id, () => {
        window.location.href = `system.html?id=${id}`;
    });
}

async function checkSystemAccess(systemId, actionCallback) {
    const system = currentSystems.find(s => s.id === systemId);
    if (!system) return;

    if (system.securityMode === 'general') {
        openPasswordPrompt(systemId, actionCallback);
        return;
    }

    if (userProfile && system.ownerId === userProfile.id) {
        actionCallback();
        return;
    }

    actionCallback();
}

function openPasswordPrompt(systemId, callback) {
    promptCallback = (password) => verifyAnd(systemId, password, callback);
    document.getElementById('promptPasswordInput').value = '';
    document.getElementById('passwordErrorMsg').classList.add('hidden');
    document.getElementById('passwordPromptModal').classList.remove('hidden');
}

function closePasswordPrompt() {
    document.getElementById('passwordPromptModal').classList.add('hidden');
    promptCallback = null;
}

async function verifyAnd(systemId, password, callback) {
    if (!password) {
        showPasswordError('La contraseña es requerida');
        return;
    }

    try {
        const res = await apiFetch(`/systems/${systemId}/verify-password`, {
            method: 'POST',
            body: JSON.stringify({ password: password })
        });

        if (res.ok) {
            closePasswordPrompt();
            callback();
        } else {
            showPasswordError('Contraseña incorrecta');
        }
    } catch (e) {
        console.error(e);
        showPasswordError('Error de verificación');
    }
}

function confirmPassword() {
    if (promptCallback) {
        const pwd = document.getElementById('promptPasswordInput').value;
        promptCallback(pwd);
    }
}

function showPasswordError(msg) {
    const el = document.getElementById('passwordErrorMsg');
    el.innerText = msg;
    el.classList.remove('hidden');
}

async function editSystem(event, id) {
    if (event) event.stopPropagation();
    checkSystemAccess(id, () => {
        window.location.href = `system_form.html?id=${id}`;
        return;
    });
}

async function deleteSystem(event, id) {
    if (event) event.stopPropagation();
    checkSystemAccess(id, async () => {
        if (!confirm('¿Estás seguro de eliminar este sistema? Esta acción no se puede deshacer.')) {
            return;
        }

        const res = await apiFetch(`/systems/${id}`, { method: 'DELETE' });
        if (res && res.ok) {
            loadSystems();
            loadStatistics();
        } else {
            const errorData = await res.json();
            showError(errorData.message || 'Error al eliminar sistema');
        }
    });
}

async function loadStatistics() {
    const res = await apiFetch('/systems/estadisticas');
    if (res && res.ok) {
        const stats = await res.json();

        animateValue('statTotalSystems', 0, stats.totalSystems || 0, 1000);
        animateValue('statTotalUsers', 0, stats.totalUsers || 0, 1000);
        animateValue('statTotalRecords', 0, stats.totalRecords || 0, 1000);

        const totalSecure = (stats.securityGeneral || 0) + (stats.securityIndividual || 0);
        animateValue('statSecureSystems', 0, totalSecure, 1000);

        if (stats.planUsage) {
            const usage = stats.planUsage;
            const planNameEl = document.getElementById('statPlanName');
            const planUsageEl = document.getElementById('statPlanUsage');

            if (planNameEl) planNameEl.innerText = usage.planName || 'Básico';
            if (planUsageEl) {
                planUsageEl.innerText = usage.max === -1
                    ? `${usage.current} / ∞ Usados`
                    : `${usage.current} / ${usage.max} Usados`;
            }

            renderPlanChart(usage);
        }

        renderActivityChart(stats.activityLabels, stats.activityData);
        renderSecurityChart(stats);
    }
}

function renderSecurityChart(stats) {
    const ctx = document.getElementById('securityChart');
    if (!ctx) return;

    if (securityChart) {
        securityChart.destroy();
    }

    const secure = (stats.securityGeneral || 0) + (stats.securityIndividual || 0);
    const notSecure = stats.securityNone || 0;

    securityChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Segura', 'Ninguna'],
            datasets: [{
                data: [secure, notSecure],
                backgroundColor: ['#22c55e', '#ef4444'],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { display: false },
                tooltip: { enabled: true }
            }
        }
    });
}

function renderPlanChart(usage) {
    const ctx = document.getElementById('planChart');
    if (!ctx) return;

    if (planChart) {
        planChart.destroy();
    }

    const max = usage.max === -1 ? 100 : usage.max;
    const current = usage.current;

    const data = usage.max === -1
        ? [0, 100]
        : [current, Math.max(0, max - current)];

    planChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Usado', 'Disponible'],
            datasets: [{
                data: data,
                backgroundColor: [
                    '#ef4444',
                    '#22c55e',
                ],
                borderWidth: 0,
                hoverOffset: 4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '75%',
            plugins: {
                legend: { display: false },
                tooltip: { enabled: false }
            }
        }
    });
}

function renderActivityChart(labels, data) {
    const ctx = document.getElementById('activityChart');
    if (!ctx) return;

    if (activityChart) {
        activityChart.destroy();
    }

    const color = '#3b82f6';
    const gridColor = 'rgba(255, 255, 255, 0.05)';

    activityChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels || ['Lun', 'Mar', 'Mie', 'Jue', 'Vie', 'Sab', 'Dom'],
            datasets: [{
                label: 'Interacciones',
                data: data || [0, 0, 0, 0, 0, 0, 0],
                borderColor: color,
                backgroundColor: (context) => {
                    const bg = context.chart.ctx.createLinearGradient(0, 0, 0, 300);
                    bg.addColorStop(0, 'rgba(59, 130, 246, 0.2)');
                    bg.addColorStop(1, 'rgba(59, 130, 246, 0)');
                    return bg;
                },
                borderWidth: 2,
                tension: 0.1,
                pointRadius: 3,
                pointBackgroundColor: '#151f2b',
                pointBorderColor: color,
                pointBorderWidth: 2,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: '#1e293b',
                    titleColor: '#fff',
                    bodyColor: '#94a3b8',
                    borderColor: '#334155',
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: gridColor, drawBorder: false },
                    ticks: { color: '#64748b', font: { size: 10 } }
                },
                x: {
                    grid: { color: gridColor, drawBorder: false },
                    ticks: { color: '#64748b', font: { size: 10 }, maxRotation: 0 }
                }
            },
            interaction: {
                intersect: false,
                mode: 'nearest',
            },
        }
    });
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;

    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) {
            window.requestAnimationFrame(step);
        }
    };
    window.requestAnimationFrame(step);
}

function toggleCreateForm() {
    const container = document.getElementById('createSystemContainer');
    const isHidden = container.classList.contains('hidden');
    const iframe = document.getElementById('systemFormFrame');

    if (isHidden) {
        container.classList.remove('hidden');
        if (!editingSystemId) {
            iframe.contentWindow.postMessage({ type: 'resetForm' }, '*');
        }
    } else {
        container.classList.add('hidden');
        editingSystemId = null;
        iframe.contentWindow.postMessage({ type: 'resetForm' }, '*');
    }
}

window.toggleCreateForm = toggleCreateForm;


let currentInvitationSystemId = null;

function openInvitationModal(event, systemId) {
    if (event) event.stopPropagation();
    currentInvitationSystemId = systemId;
    document.getElementById('invitationModal').classList.remove('hidden');
    document.getElementById('inviteEmail').value = '';
    loadInvitations(systemId);
}

function closeInvitationModal() {
    document.getElementById('invitationModal').classList.add('hidden');
    currentInvitationSystemId = null;
}

async function loadInvitations(systemId) {
    const listEl = document.getElementById('invitationsList');
    listEl.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">Cargando...</div>';

    try {
        const res = await apiFetch(`/systems/${systemId}/invitations`);
        if (res.ok) {
            const invitations = await res.json();
            if (invitations.length === 0) {
                listEl.innerHTML = '<div class="text-center py-8 text-gray-400 text-sm">No hay usuarios invitados aún.</div>';
                return;
            }

            listEl.innerHTML = invitations.map(inv => `
                <div class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800">
                    <div class="flex items-center gap-3">
                        <div class="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-sm">
                            ${inv.userEmail.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="text-sm font-bold text-[#111418] dark:text-white">${inv.userEmail}</div>
                            <div class="text-xs text-gray-400">${inv.permissionLevel === 'EDITOR' ? 'Editor' : 'Visualizador'}</div>
                        </div>
                    </div>
                    ${inv.status === 'ACCEPTED' ?
                    '<span class="text-[10px] bg-green-500/10 text-green-500 px-2 py-0.5 rounded-md font-bold">Aceptado</span>' :
                    '<span class="text-[10px] bg-yellow-500/10 text-yellow-500 px-2 py-0.5 rounded-md font-bold">Pendiente</span>'}
                    <button onclick="revokeInvitation(${systemId}, ${inv.id})" 
                        class="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/10 rounded-lg transition-colors" title="Revocar acceso">
                        <span class="material-symbols-outlined text-lg">block</span>
                    </button>
                </div>
            `).join('');
        } else {
            listEl.innerHTML = '<div class="text-center py-8 text-red-400 text-sm">Error al cargar invitaciones.</div>';
        }
    } catch (e) {
        console.error(e);
        listEl.innerHTML = '<div class="text-center py-8 text-red-400 text-sm">Error de conexión.</div>';
    }
}

async function sendInvitation() {
    if (!currentInvitationSystemId) return;
    const email = document.getElementById('inviteEmail').value;
    if (!email) {
        showError('Ingresa un correo electrónico');
        return;
    }

    showLoading('Enviando invitación...');

    try {
        const res = await apiFetch(`/systems/${currentInvitationSystemId}/invite`, {
            method: 'POST',
            body: JSON.stringify({ email: email, permission: 'EDITOR' }) // Default to EDITOR for full access
        });

        if (res.ok) {
            showSuccess('Invitación enviada');
            document.getElementById('inviteEmail').value = '';
            loadInvitations(currentInvitationSystemId);
        } else {
            const data = await res.json();
            showError(data.message || 'Error al invitar');
        }
    } catch (e) {
        showError('Error de conexión');
    }
}

async function deleteSystem(event, id) {
    if (event) event.stopPropagation();

    // First confirm intention
    showConfirm('¿Estás seguro de eliminar este sistema? Esta acción no se puede deshacer.', () => {
        // Then prompt password for security
        promptPassword(async () => {
            showLoading('Eliminando sistema...');
            try {
                const res = await apiFetch(`/systems/${id}`, { method: 'DELETE' });
                if (res && res.ok) {
                    showSuccess('Sistema eliminado', () => {
                        loadSystems();
                        loadStatistics();
                    });
                } else {
                    const errorData = await res.json();
                    showError(errorData.message || 'Error al eliminar sistema');
                }
            } catch (e) {
                showError('Error de conexión');
            }
        });
    });
}

async function revokeInvitation(systemId, shareId) {
    showConfirm('¿Seguro que deseas revocar el acceso a este usuario?', () => {
        promptPassword(async () => {
            try {
                const res = await apiFetch(`/systems/${systemId}/invitations/${shareId}`, {
                    method: 'DELETE'
                });
                if (res.ok) {
                    showSuccess('Acceso revocado', () => {
                        loadInvitations(systemId);
                    });
                } else {
                    showError('Error al revocar acceso');
                }
            } catch (e) {
                showError('Error de conexión');
            }
        });
    });
}

init();
