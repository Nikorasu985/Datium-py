let appPlans = [];
let allUsers = [];

// Module Helper
const modules = {
    dashboard: { title: 'Motor Datium', subtitle: 'Global System Dashboard. Monitorización de núcleos, usuarios y sistemas en tiempo real.' },
    reports: { title: 'Critical Intelligence', subtitle: 'Centro de reportes de errores y bugs. Analiza el feedback técnico de la comunidad.' },
    plans: { title: 'Market Center', subtitle: 'Gestión de monetización, cuotas de sistemas, límites de almacenamiento y pricing dinámico.' },
    users: { title: 'Nexus Global', subtitle: 'Control total de la base de usuarios. Gestión de roles, accesos, suspensiones y logs de actividad.' },
    legal: { title: 'Legal Engine', subtitle: 'Redacción y gestión de términos de uso. Cada cambio requiere re-aceptación de todos los usuarios.' }
};

async function initAdmin() {
    showLoading('Iniciando Nexus Engine...');
    const profileRes = await apiFetch('/user/profile');
    if (!profileRes || !profileRes.ok) return window.location.href = 'dashboard.html';
    
    const user = await profileRes.json();
    if (user.role !== 'admin') {
        window.location.href = 'dashboard.html';
        return;
    }

    // Initial Data Load
    await Promise.all([
        loadReports(),
        loadPlans(),
        loadTrashCount(),
        loadUsers(),
        loadPolicies()
    ]);

    hideLoading();
    setupSearch();
}

function setupSearch() {
    const searchInput = document.getElementById('userListSearch');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            const term = e.target.value.toLowerCase();
            const filtered = allUsers.filter(u => 
                (u.name || '').toLowerCase().includes(term) || 
                (u.email || '').toLowerCase().includes(term)
            );
            renderUsers(filtered);
        });
    }
}

async function loadReports() {
    const res = await apiFetch('/admin/reports');
    if (!res || !res.ok) return;
    const reports = await res.json();
    
    // Dashboard Preview (max 5 pending)
    const pending = reports.filter(r => r.status !== 'resolved').slice(0, 5);
    const dashboardTbody = document.getElementById('dashboardReportsPreview');
    if (dashboardTbody) {
        if (pending.length === 0) {
            dashboardTbody.innerHTML = '<tr><td class="p-8 text-center text-gray-400 text-xs font-bold uppercase tracking-widest">No hay alertas pendientes</td></tr>';
        } else {
            dashboardTbody.innerHTML = pending.map(r => `
                <tr onclick="openReportDetail(${JSON.stringify(r).replace(/"/g, '&quot;')})" class="hover:bg-white/5 transition-all cursor-pointer">
                    <td class="px-8 py-5">
                        <div class="flex items-center gap-3">
                            <div class="w-8 h-8 rounded-lg bg-red-500/10 text-red-500 flex items-center justify-center font-bold text-xs">${(r.userEmail || 'U').charAt(0).toUpperCase()}</div>
                            <div>
                                <div class="text-[10px] font-black uppercase tracking-tight text-white">${sanitize(r.title)}</div>
                                <div class="text-[9px] text-gray-500 font-bold">${sanitize(r.userEmail)}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-8 py-5 text-right">
                        <span class="text-[9px] font-black text-gray-600 uppercase tracking-widest">${new Date(r.createdAt).toLocaleDateString()}</span>
                    </td>
                </tr>
            `).join('');
        }
    }

    // Full List
    const fullTbody = document.getElementById('fullReportsTableBody');
    if (fullTbody) {
        if (reports.length === 0) {
            fullTbody.innerHTML = '<tr><td colspan="5" class="p-12 text-center text-gray-500 font-bold uppercase tracking-widest">Base de datos de reportes vacía</td></tr>';
        } else {
            fullTbody.innerHTML = reports.map(r => `
                <tr class="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
                    <td class="px-8 py-6">
                        <div class="flex items-center gap-4">
                            <div class="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center font-black text-xs text-white">${(r.userEmail || 'U').charAt(0).toUpperCase()}</div>
                            <div>
                                <div class="text-xs font-black text-white uppercase tracking-tight">${sanitize(r.userEmail)}</div>
                                <div class="text-[10px] text-gray-500 font-medium">Internal ID: #${r.id}</div>
                            </div>
                        </div>
                    </td>
                    <td class="px-8 py-6">
                        <div class="text-xs font-bold text-slate-200 truncate max-w-[250px]">${sanitize(r.title)}</div>
                    </td>
                    <td class="px-8 py-6 text-[10px] font-bold text-gray-500 uppercase tracking-widest">${new Date(r.createdAt).toLocaleString()}</td>
                    <td class="px-8 py-6">
                        ${r.status === 'resolved' 
                            ? '<span class="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg font-black text-[9px] uppercase tracking-widest">Resuelto</span>' 
                            : '<span class="px-3 py-1 bg-amber-500/10 text-amber-500 rounded-lg font-black text-[9px] uppercase tracking-widest">Pendiente</span>'}
                    </td>
                    <td class="px-8 py-6 text-right">
                        <button onclick="openReportDetail(${JSON.stringify(r).replace(/"/g, '&quot;')})" class="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-primary/50 text-gray-400 hover:text-primary transition-all">
                            <span class="material-symbols-outlined text-lg">visibility</span>
                        </button>
                    </td>
                </tr>
            `).join('');
        }
    }

    // Stats
    const pendingCount = reports.filter(r => r.status !== 'resolved').length;
    animateValue('stat-pending-reports', 0, pendingCount, 800);
}

function openReportDetail(report) {
    const modal = document.getElementById('reportDetailModal');
    const title = document.getElementById('modalReportTitle');
    const summary = document.getElementById('modalReportSummary');
    const date = document.getElementById('modalReportDate');
    const user = document.getElementById('modalReportUser');
    const imgCont = document.getElementById('modalReportScreenshotCont');
    const img = document.getElementById('modalReportScreenshot');
    const btn = document.getElementById('modalReportBtn');

    title.innerText = report.title;
    summary.innerText = report.summary;
    date.innerText = new Date(report.createdAt).toLocaleString();
    user.innerText = report.userEmail;

    if (report.screenshot_url) {
        img.src = report.screenshot_url;
        imgCont.classList.remove('hidden');
    } else {
        imgCont.classList.add('hidden');
    }

    const isResolved = report.status === 'resolved';
    btn.className = `flex-1 py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-widest transition-all ${isResolved ? 'bg-amber-500 hover:bg-amber-600' : 'bg-primary hover:bg-blue-600'} shadow-lg`;
    btn.innerText = isResolved ? 'Marcar como Pendiente' : 'Marcar como Resuelto';
    btn.onclick = () => updateReportStatus(report.id, report.status);

    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

function closeReportModal() {
    const modal = document.getElementById('reportDetailModal');
    modal.classList.remove('flex');
    modal.classList.add('hidden');
}

async function updateReportStatus(id, currentStatus) {
    const newStatus = currentStatus === 'resolved' ? 'pending' : 'resolved';
    showLoading('Actualizando estado...');
    const res = await apiFetch(`/admin/reports/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status: newStatus })
    });
    if (res && res.ok) {
        showSuccess('Reporte actualizado');
        closeReportModal();
        loadReports();
    } else {
        showError('No se pudo actualizar');
    }
}

async function loadPlans() {
    const [plansRes, discountsRes] = await Promise.all([
        apiFetch('/admin/plans'),
        apiFetch('/admin/discounts')
    ]);
    
    if (plansRes && plansRes.ok) {
        appPlans = await plansRes.json();
        renderPlans();
    }
    
    if (discountsRes && discountsRes.ok) {
        const discounts = await discountsRes.json();
        renderDiscounts(discounts);
    }
}

function renderPlans() {
    const container = document.getElementById('plansModuleContainer');
    if (!container) return;

    container.innerHTML = appPlans.map(p => {
        const promo = p.promo || {};
        return `
        <div class="glass-card rounded-[2.5rem] p-8 space-y-6 hover-lift border border-white/5 relative group">
            <div class="flex items-center justify-between">
                <input type="text" id="plan_${p.id}_name" value="${sanitize(p.name)}" class="bg-transparent text-2xl font-black italic tracking-tighter outline-none w-full text-white">
                <button onclick="deletePlan(${p.id})" class="p-2 opacity-0 group-hover:opacity-100 transition-all text-red-500 hover:bg-red-500/10 rounded-xl">
                    <span class="material-symbols-outlined text-xl">delete</span>
                </button>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div class="space-y-1">
                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Precio Mensual</label>
                    <div class="relative">
                        <span class="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                        <input type="number" id="plan_${p.id}_price" value="${p.price}" class="w-full pl-7 pr-3 py-3 rounded-xl bg-white/5 border border-white/5 text-sm font-bold outline-none focus:border-primary/30">
                    </div>
                </div>
                <div class="space-y-1">
                    <label class="text-[9px] font-black text-gray-500 uppercase tracking-widest">Sistemas Máx</label>
                    <input type="number" id="plan_${p.id}_systems" value="${p.max_systems}" class="w-full px-3 py-3 rounded-xl bg-white/5 border border-white/5 text-sm font-bold outline-none">
                </div>
            </div>

            <div class="space-y-4 pt-2 border-t border-white/5">
                <div class="flex items-center justify-between text-[11px] font-bold">
                    <span class="text-gray-400">Tablas x Sistema</span>
                    <input type="number" id="plan_${p.id}_tables" value="${p.max_tables_per_system}" class="bg-transparent w-12 text-right outline-none">
                </div>
                <div class="flex items-center justify-between text-[11px] font-bold">
                    <span class="text-gray-400">Storage (MB)</span>
                    <input type="number" id="plan_${p.id}_storage" value="${p.max_storage_mb}" class="bg-transparent w-20 text-right outline-none">
                </div>
                <div class="flex items-center justify-between text-[11px] font-bold">
                    <span class="text-gray-400">IA Habilitada</span>
                    <input type="checkbox" id="plan_${p.id}_ai" ${p.has_ai_assistant ? 'checked' : ''} class="w-4 h-4 rounded-md bg-primary/20 border-primary text-primary focus:ring-0">
                </div>
            </div>

            <button onclick="savePlan(${p.id})" class="w-full py-4 rounded-2xl bg-primary text-white font-black text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">Sincronizar Plan</button>
        </div>`;
    }).join('');
}

window.savePlan = async function(id) {
    const payload = {
        name: document.getElementById(`plan_${id}_name`).value,
        price: parseFloat(document.getElementById(`plan_${id}_price`).value || '0'),
        max_systems: parseInt(document.getElementById(`plan_${id}_systems`).value || '1'),
        max_tables_per_system: parseInt(document.getElementById(`plan_${id}_tables`).value || '3'),
        max_storage_mb: parseInt(document.getElementById(`plan_${id}_storage`).value || '1024'),
        max_records_per_table: 1000000, 
        max_fields_per_table: 200,
        is_active: true,
        has_ai_assistant: document.getElementById(`plan_${id}_ai`).checked,
        promo: {}
    };
    showLoading('Sincronizando con Core...');
    const res = await apiFetch(`/admin/plans/${id}`, { method: 'PUT', body: JSON.stringify(payload) });
    if (res && res.ok) { showSuccess('Plan Actualizado'); loadPlans(); } else { showError('Error en sincronización'); }
}

window.deletePlan = async function(id) {
    showConfirm('¿Destruir este plan? Perderás la configuración de precios.', async () => {
        const res = await apiFetch(`/admin/plans/${id}`, { method: 'DELETE' });
        if (res.ok) { showSuccess('Plan eliminado'); loadPlans(); }
    });
}

function renderDiscounts(discounts) {
    const container = document.getElementById('discountsModuleContainer');
    if (!container) return;
    
    if (discounts.length === 0) {
        container.innerHTML = '<div class="col-span-full p-8 text-center text-gray-500 font-bold uppercase tracking-widest text-xs glass-card rounded-2xl">No hay campañas de descuento activas</div>';
        return;
    }

    container.innerHTML = discounts.map(d => `
        <div class="glass-card rounded-2xl p-4 border border-white/5 space-y-3">
            <div class="flex items-center justify-between">
                <input id="discount_${d.id}_code" value="${sanitize(d.code)}" class="bg-transparent font-black text-white outline-none w-3/4">
                <button onclick="deleteDiscount(${d.id})" class="text-rose-500"><span class="material-symbols-outlined text-lg">delete</span></button>
            </div>
            <div class="flex items-center gap-3">
                <div class="relative flex-1">
                    <input id="discount_${d.id}_percentage" type="number" value="${d.percentage}" class="w-full px-3 py-2 rounded-xl bg-white/5 border border-white/10 text-xs font-bold outline-none">
                    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">%</span>
                </div>
                <button onclick="saveDiscount(${d.id})" class="p-2 rounded-xl bg-primary/20 text-primary hover:bg-primary hover:text-white transition-all">
                    <span class="material-symbols-outlined text-lg">save</span>
                </button>
            </div>
        </div>
    `).join('');
}

async function loadUsers() {
    const res = await apiFetch('/admin/users');
    if (!res || !res.ok) return;
    allUsers = await res.json();
    renderUsers(allUsers);
    animateValue('stat-total-users', 0, allUsers.length, 800);
}

function renderUsers(users) {
    const tbody = document.getElementById('fullUsersTableBody');
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-12 text-center text-gray-500 font-bold uppercase tracking-widest">No se encontraron usuarios</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(u => `
        <tr class="hover:bg-white/5 transition-colors border-b border-white/5 last:border-0">
            <td class="px-8 py-6">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center font-black text-xs text-white shadow-inner">${(u.name || 'U').charAt(0).toUpperCase()}</div>
                    <div>
                        <div class="text-xs font-black text-white uppercase tracking-tight">${sanitize(u.name || 'Sin nombre')}</div>
                        <div class="text-[10px] text-gray-500 font-medium tracking-wide">${sanitize(u.email)}</div>
                    </div>
                </div>
            </td>
            <td class="px-8 py-6">
                <span class="px-3 py-1 bg-primary/10 text-primary rounded-lg font-black text-[9px] uppercase tracking-widest">${u.role || 'User'} / ${u.plan || 'Free'}</span>
            </td>
            <td class="px-8 py-6 text-[10px] font-bold text-gray-500 uppercase tracking-widest">${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'Nexus Origin'}</td>
            <td class="px-8 py-6">
                ${u.is_suspended 
                    ? '<span class="px-3 py-1 bg-rose-500/10 text-rose-500 rounded-lg font-black text-[9px] uppercase tracking-widest italic">Bloqueado</span>' 
                    : '<span class="px-3 py-1 bg-emerald-500/10 text-emerald-500 rounded-lg font-black text-[9px] uppercase tracking-widest">Activo</span>'}
            </td>
            <td class="px-8 py-6 text-right">
                <button onclick="toggleUserStatus(${u.id}, ${u.is_suspended})" class="p-2.5 rounded-xl bg-white/5 border border-white/5 hover:border-${u.is_suspended ? 'emerald' : 'rose'}-500/50 text-gray-400 hover:text-${u.is_suspended ? 'emerald' : 'rose'}-500 transition-all" title="${u.is_suspended ? 'Habilitar' : 'Suspender'}">
                    <span class="material-symbols-outlined text-lg">${u.is_suspended ? 'check_circle' : 'block'}</span>
                </button>
            </td>
        </tr>
    `).join('');
}

window.toggleUserStatus = async function(id, curSuspended) {
    const action = curSuspended ? 'activate' : 'suspend';
    showConfirm(`¿Confirmas la ${curSuspended ? 'activación' : 'suspensión'} definitiva de este acceso?`, () => {
        promptAdminPassword(async () => {
            showLoading('Aplicando protocolos...');
            const res = await apiFetch(`/admin/users/${id}/action`, {
                method: 'POST',
                body: JSON.stringify({ action })
            });
            if (res.ok) {
                showSuccess('Estado actualizado');
                loadUsers();
            }
        });
    });
}

async function loadPolicies() {
    const res = await apiFetch('/admin/tyc');
    if (res && res.ok) {
        const data = await res.json();
        document.getElementById('policyEditor').value = data.content || data.terms || '';
        document.getElementById('policyVersionLabel').innerText = data.version || '1';
    }
}

window.savePolicies = async function() {
    const content = document.getElementById('policyEditor').value;
    if (!content) return;
    
    showConfirm('Esta acción incrementará la versión legal y requerirá que TODOS los usuarios acepten nuevamente al iniciar sesión. ¿Proceder?', async () => {
        showLoading('Actualizando Legal Core...');
        const res = await apiFetch('/admin/tyc', {
            method: 'POST',
            body: JSON.stringify({ content })
        });
        if (res.ok) {
            const data = await res.json();
            showSuccess(`Términos actualizados. Nueva versión: ${data.version}`);
            loadPolicies();
        }
    });
}

async function loadTrashCount() {
    const [resS, resU] = await Promise.all([
        apiFetch('/admin/trash/systems'),
        apiFetch('/systems/estadisticas')
    ]);
    
    if (resS && resS.ok) {
        const trash = await resS.json();
        animateValue('stat-trash-count', 0, trash.length, 800);
    }
    
    if (resU && resU.ok) {
        const stats = await resU.json();
        animateValue('stat-total-systems', 0, stats.totalSystems || 0, 800);
    }
}

function sanitize(str) {
    if(!str) return '';
    return str.toString().replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function animateValue(id, start, end, duration) {
    const obj = document.getElementById(id);
    if (!obj) return;
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start);
        if (progress < 1) window.requestAnimationFrame(step);
    };
    window.requestAnimationFrame(step);
}

async function promptAdminPassword(callback) {
    const pass = prompt("CONFIRMACIÓN DE KERNEL: Ingrese clave de administrador para ejecutar esta acción crítica:");
    if (!pass) return;
    showLoading('Verificando firma...');
    const res = await apiFetch('/user/verify-password', {
        method: 'POST',
        body: JSON.stringify({ password: pass })
    });
    if (res && res.ok) callback();
    else showError('Firma inválida. Acceso denegado.');
}

// Global Export UI
window.exportAudit = function(format = 'csv') {
    promptAdminPassword(async () => {
        showLoading(`Generando logs en ${format.toUpperCase()}...`);
        try {
            const res = await apiFetch(`/admin/trash/export?format=${format}`);
            if (!res) throw new Error('Error de conexión o sesión expirada');
            if (res.ok) {
                const blob = await res.blob();
                downloadBlob(blob, `Datium_Audit_Logs_${new Date().toISOString().slice(0, 10)}.${format === 'xlsx' ? 'xlsx' : format}`);
                showSuccess(`Audit exportado como ${format.toUpperCase()}`);
            } else {
                showError('Error al exportar logs');
            }
        } catch (e) {
            showError('Error de red al exportar');
        }
    });
}

window.exportUsers = function(format = 'csv') {
    promptAdminPassword(async () => {
        showLoading(`Exportando base de datos nexus en ${format.toUpperCase()}...`);
        try {
            const res = await apiFetch(`/admin/users/export?format=${format}`);
            if (!res) throw new Error('Error de conexión o sesión expirada');
            if (res.ok) {
                const blob = await res.blob();
                downloadBlob(blob, `Nexus_Users_${new Date().toISOString().slice(0, 10)}.${format === 'xlsx' ? 'xlsx' : format}`);
                showSuccess(`Usuarios exportados como ${format.toUpperCase()}`);
            } else {
                showError('Error al exportar usuarios');
            }
        } catch (e) {
            showError('Error de red al exportar');
        }
    });
}

window.exportReports = function(format = 'csv') {
    promptAdminPassword(async () => {
        showLoading(`Exportando reportes de inteligencia en ${format.toUpperCase()}...`);
        try {
            const res = await apiFetch(`/admin/reports/export?format=${format}`);
            if (!res) throw new Error('Error de conexión o sesión expirada');
            if (res.ok) {
                const blob = await res.blob();
                downloadBlob(blob, `Intelligence_Reports_${new Date().toISOString().slice(0, 10)}.${format === 'xlsx' ? 'xlsx' : format}`);
                showSuccess(`Reportes exportados como ${format.toUpperCase()}`);
            } else {
                showError('Error al exportar reportes');
            }
        } catch (e) {
            showError('Error de red al exportar');
        }
    });
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || "export_admin.xlsx";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => { URL.revokeObjectURL(url); }, 2000);
}

document.addEventListener('DOMContentLoaded', initAdmin);
