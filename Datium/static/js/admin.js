let appPlans = [];

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-link').forEach(el => {
        el.classList.remove('active-tab', 'text-red-600', 'dark:text-red-400', 'bg-red-50', 'dark:bg-red-900/10', 'font-bold');
        el.classList.add('text-gray-600', 'dark:text-gray-400', 'font-medium');
    });

    document.getElementById(`tab-${tabId}`).classList.remove('hidden');

    const activeLink = Array.from(document.querySelectorAll('.tab-link')).find(el => el.getAttribute('onclick') === `switchTab('${tabId}')`);
    if(activeLink) {
        activeLink.classList.remove('text-gray-600', 'dark:text-gray-400', 'font-medium');
        activeLink.classList.add('active-tab', 'text-red-600', 'dark:text-red-400', 'bg-red-50', 'dark:bg-red-900/10', 'font-bold');
    }
}

async function loadReports() {
    const res = await apiFetch('/admin/reports');
    if(!res || !res.ok) return;
    const reports = await res.json();
    
    const tbody = document.getElementById('reportsTableBody');
    if(reports.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-gray-500">No hay reportes.</td></tr>';
        return;
    }

    tbody.innerHTML = reports.map(r => `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <td class="p-4 font-bold text-gray-900 dark:text-white">${sanitize(r.userEmail)}</td>
            <td class="p-4 font-medium text-gray-700 dark:text-gray-300 max-w-[200px] truncate">${sanitize(r.title)}</td>
            <td class="p-4 text-gray-500 dark:text-gray-400">${new Date(r.createdAt).toLocaleString()}</td>
            <td class="p-4">
                ${r.status === 'resolved' 
                    ? '<span class="px-3 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 rounded-full font-bold text-xs">Resuelto</span>' 
                    : '<span class="px-3 py-1 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 rounded-full font-bold text-xs">Pendiente</span>'}
            </td>
            <td class="p-4 text-center space-x-2 flex justify-center">
                <button onclick="viewReportImage('${r.screenshot_url}', '${sanitize(r.summary).replace(/'/g, "\\'")}')" class="p-2 border border-gray-200 dark:border-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors" title="Ver Detalle y Evidencia">
                    <span class="material-symbols-outlined">image</span>
                </button>
                <button onclick="resolveReport(${r.id}, '${r.status}')" class="p-2 border border-green-200 dark:border-green-900/50 rounded-xl hover:bg-green-50 dark:hover:bg-green-900/20 text-green-600 dark:text-green-400 transition-colors" title="${r.status==='resolved'?'Marcar Pendiente':'Resolver'}">
                    <span class="material-symbols-outlined">${r.status==='resolved'?'unpublished':'check_circle'}</span>
                </button>
            </td>
        </tr>
    `).join('');
}

function sanitize(str) {
    if(!str) return '';
    return str.replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

window.viewReportImage = function(url, summary) {
    if(!url) {
        showError('Este reporte no incluye captura de pantalla.');
        return;
    }
    document.getElementById('reportScreenshotImage').src = url;
    document.getElementById('reportFullSummary').innerHTML = `<strong>Resumen del problema:</strong><br>${summary.replace(/\\n/g, '<br>')}`;
    const modal = document.getElementById('reportScreenshotModal');
    modal.classList.remove('hidden');
    modal.classList.add('flex');
}

window.closeReportImage = function() {
    const modal = document.getElementById('reportScreenshotModal');
    modal.classList.remove('flex');
    modal.classList.add('hidden');
    document.getElementById('reportScreenshotImage').src = '';
}

window.resolveReport = async function(id, currentStatus) {
    const newStatus = currentStatus === 'resolved' ? 'pending' : 'resolved';
    showLoading('Actualizando reporte...');
    const res = await apiFetch(`/admin/reports/${id}`, {
        method: 'PUT',
        body: JSON.stringify({status: newStatus})
    });
    if(res && res.ok){
        showSuccess('Reporte actualizado satisfactoriamente');
        loadReports();
    } else {
        showError('No se pudo actualizar el reporte');
    }
}

async function loadPlans() {
    const res = await apiFetch('/admin/plans');
    if(!res || !res.ok) return;
    appPlans = await res.json();
    renderPlans();
}

function renderPlans() {
    const container = document.getElementById('plansContainer');
    container.innerHTML = appPlans.map(p => `
        <div class="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-3xl p-6 transition-all hover:shadow-lg">
            <h3 class="text-xl font-black text-gray-900 dark:text-white uppercase tracking-widest mb-4">${p.name}</h3>
            
            <div class="space-y-4 text-sm font-medium">
                <div>
                    <label class="block text-[10px] text-gray-400 uppercase tracking-widest mb-1">Max Sistemas</label>
                    <input type="number" id="plan_${p.id}_systems" value="${p.max_systems}" class="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-white focus:ring-red-500 text-lg font-black">
                </div>
                <div>
                    <label class="block text-[10px] text-gray-400 uppercase tracking-widest mb-1">Max Tablas x Sistema</label>
                    <input type="number" id="plan_${p.id}_tables" value="${p.max_tables_per_system}" class="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-white focus:ring-red-500 text-lg font-black">
                </div>
                <div>
                    <label class="block text-[10px] text-gray-400 uppercase tracking-widest mb-1">Almacenamiento (MB)</label>
                    <input type="number" id="plan_${p.id}_storage" value="${p.max_storage_mb}" class="w-full p-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-900 dark:text-white focus:ring-red-500 text-lg font-black">
                </div>
            </div>
            
            <button onclick="savePlan(${p.id})" class="mt-6 w-full py-3 rounded-xl bg-gray-900 dark:bg-white text-white dark:text-gray-900 font-black hover:-translate-y-1 shadow-md transition-all">
                Actualizar Plan
            </button>
        </div>
    `).join('');
}

window.savePlan = async function(id) {
    const sys = document.getElementById(`plan_${id}_systems`).value;
    const tb = document.getElementById(`plan_${id}_tables`).value;
    const stor = document.getElementById(`plan_${id}_storage`).value;

    showLoading('Guardando plan...');
    const res = await apiFetch(`/admin/plans/${id}`, {
        method: 'PUT',
        body: JSON.stringify({
            max_systems: parseInt(sys),
            max_tables_per_system: parseInt(tb),
            max_storage_mb: parseInt(stor)
        })
    });

    if(res && res.ok){
        showSuccess('Plan actualizado');
        loadPlans();
    } else {
        showError('No se pudo actualizar el plan');
    }
}

async function loadPolicies() {
    const res = await apiFetch('/admin/policies');
    if(res && res.ok){
        const text = await res.json();
        document.getElementById('policyContentEditor').value = text.terms || '';
    }
}

window.savePolicies = async function() {
    const val = document.getElementById('policyContentEditor').value;
    showLoading('Actualizando Términos y Condiciones...');
    const res = await apiFetch('/admin/policies', {
        method: 'PUT',
        body: JSON.stringify({ terms: val })
    });
    if(res && res.ok) showSuccess('Políticas actualizadas');
    else showError('Error guardando políticas');
}

// Check admin auth before init
async function initAdmin() {
    showLoading('Verificando credenciales...');
    const res = await apiFetch('/user/profile');
    if(!res || !res.ok) return window.location.href = 'dashboard.html';
    
    const user = await res.json();
    if(user.role !== 'admin') {
        window.location.href = 'dashboard.html';
        return;
    }

    hideLoading();
    loadReports();
    loadPlans();
    loadPolicies();
}

document.addEventListener('DOMContentLoaded', initAdmin);
