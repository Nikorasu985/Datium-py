checkAuth();

let profileData = null;
let availablePlans = [];

async function init() {
    await Promise.all([loadProfile(), loadPlans()]);
}

async function loadProfile() {
    const res = await apiFetch('/user/profile');
    if (res.ok) {
        const user = await res.json();
        profileData = user;

        if (document.getElementById('profileName')) document.getElementById('profileName').value = user.name || '';
        if (document.getElementById('profileEmail')) document.getElementById('profileEmail').value = user.email || '';
        if (document.getElementById('profilePhone')) document.getElementById('profilePhone').value = user.phone || '';

        const sidebarName = document.getElementById('userName');
        const sidebarEmail = document.getElementById('userEmail');
        const sidebarInitial = document.getElementById('userInitial');
        const sidebarAvatar = document.getElementById('userAvatar');
        if (sidebarName) sidebarName.innerText = user.name || 'Usuario';
        if (sidebarEmail) sidebarEmail.innerText = user.email || '...';

        if (document.getElementById('displayNameMain')) document.getElementById('displayNameMain').innerText = user.name || 'Sin nombre';
        if (document.getElementById('currentPlanName')) document.getElementById('currentPlanName').innerText = user.planName || 'Free';

        const avatarImg = document.getElementById('profileAvatar');
        if (user.avatarUrl) {
            if (avatarImg) avatarImg.src = user.avatarUrl;
            if (sidebarAvatar) {
                sidebarAvatar.src = user.avatarUrl;
                sidebarAvatar.classList.remove('hidden');
            }
            if (sidebarInitial) sidebarInitial.classList.add('hidden');
        } else {
            const initial = (user.name || 'U').charAt(0).toUpperCase();
            if (sidebarInitial) {
                sidebarInitial.innerText = initial;
                sidebarInitial.classList.remove('hidden');
            }
            if (sidebarAvatar) sidebarAvatar.classList.add('hidden');
        }

        renderPlans();
    }
}

async function loadPlans() {
    try {
        const res = await apiFetch('/admin/plans');
        if (!res.ok) return;
        availablePlans = await res.json();
        renderPlans();
    } catch (e) {
        console.error('Error loading plans', e);
    }
}

function getPlanTheme(planName, index) {
    const name = String(planName || '').toLowerCase();
    if (name.includes('pro')) return {
        wrapper: 'border-2 border-primary bg-white dark:bg-gray-900 shadow-2xl shadow-primary/20',
        header: 'bg-primary/5 dark:bg-primary/10',
        button: 'bg-primary text-white hover:bg-blue-600 shadow-lg shadow-primary/30',
        badge: '<span class="bg-primary text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Popular</span>'
    };
    if (name.includes('emp') || name.includes('corp')) return {
        wrapper: 'border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl',
        header: 'bg-gray-50/50 dark:bg-gray-800/50',
        button: 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:opacity-90',
        badge: '<span class="bg-gray-900 dark:bg-white dark:text-gray-900 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Premium</span>'
    };
    return {
        wrapper: 'border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 shadow-xl',
        header: 'bg-gray-50/50 dark:bg-gray-800/50',
        button: 'bg-gray-100 dark:bg-gray-800 text-[#111418] dark:text-white hover:bg-gray-200 dark:hover:bg-gray-700',
        badge: ''
    };
}

function renderPlans() {
    const container = document.getElementById('plansContainer');
    if (!container || !availablePlans.length) return;
    const currentPlanId = profileData?.planId;
    container.innerHTML = availablePlans.map((plan, index) => {
        const theme = getPlanTheme(plan.name, index);
        const isCurrent = String(plan.id) === String(currentPlanId);
        return `
        <div class="flex flex-col gap-6 rounded-2xl ${theme.wrapper} overflow-hidden hover-lift animate-on-scroll relative">
            <div class="px-6 py-8 ${theme.header}">
                <div class="flex justify-between items-start gap-3">
                    <h4 class="text-xl font-black text-[#111418] dark:text-white mb-1">${plan.name}</h4>
                    ${theme.badge || (isCurrent ? '<span class="bg-emerald-500 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest">Actual</span>' : '')}
                </div>
                <p class="flex items-baseline gap-1 text-[#111418] dark:text-white">
                    <span class="text-5xl font-black tracking-tighter">$${Number(plan.price || 0)}</span>
                    <span class="text-sm font-bold text-gray-500">/mes</span>
                </p>
            </div>
            <div class="px-6 pb-8 flex flex-col h-full">
                <div class="flex flex-col gap-4 mb-8">
                    <div class="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400"><span class="material-symbols-outlined text-green-500 font-bold">check_circle</span>${plan.max_systems >= 100 ? 'Sistemas ilimitados' : `${plan.max_systems} Sistemas`}</div>
                    <div class="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400"><span class="material-symbols-outlined text-green-500 font-bold">check_circle</span>${plan.max_tables_per_system >= 50 ? 'Tablas amplias por sistema' : `${plan.max_tables_per_system} Tablas por sistema`}</div>
                    <div class="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400"><span class="material-symbols-outlined text-green-500 font-bold">check_circle</span>${plan.max_storage_mb} GB/MB almacenamiento</div>
                    <div class="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400"><span class="material-symbols-outlined text-green-500 font-bold">check_circle</span>${plan.max_records_per_table} registros por tabla</div>
                    <div class="flex items-center gap-3 text-sm text-gray-600 dark:text-gray-400"><span class="material-symbols-outlined text-green-500 font-bold">check_circle</span>${plan.max_fields_per_table} campos por tabla</div>
                </div>
                <button onclick="changePlan('${plan.id}')" ${isCurrent ? 'disabled' : ''} class="mt-auto w-full py-4 rounded-xl font-bold text-center transition-all ${isCurrent ? 'bg-emerald-500 text-white cursor-default' : theme.button}">${isCurrent ? 'Actual' : 'Seleccionar'}</button>
            </div>
        </div>`;
    }).join('');
}

async function handleAvatarChange(input) {
    if (input.files && input.files[0]) {
        const file = input.files[0];
        const formData = new FormData();
        formData.append('file', file);

        showLoading('Subiendo nueva imagen...');

        try {
            const token = localStorage.getItem('token');
            const res = await fetch(`${API_URL}/upload/image`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (res.ok) {
                const data = await res.json();
                const newAvatarUrl = data.url;

                await updateAvatarUrl(newAvatarUrl);

                const avatarImg = document.getElementById('pageUserAvatar');
                const initialEl = document.getElementById('pageUserInitial');

                if (avatarImg) {
                    avatarImg.src = newAvatarUrl;
                    avatarImg.classList.remove('hidden');
                }
                if (initialEl) initialEl.classList.add('hidden');

                showSuccess('Imagen actualizada correctamente');
            } else {
                showError('Error subiendo imagen');
            }
        } catch (e) {
            console.error(e);
            showError('Error de conexión al subir imagen');
        }
    }
}

async function updateAvatarUrl(url) {
    const res = await apiFetch('/user/avatar', {
        method: 'PUT',
        body: JSON.stringify({ avatarUrl: url })
    });
    if (!res.ok) showError('Error guardando avatar en perfil');
}

async function updateProfile() {
    const nameInput = document.getElementById('profileName');
    const phoneInput = document.getElementById('profilePhone');
    
    const name = nameInput ? nameInput.value : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';

    if (!phone) {
        return showError('El número de teléfono es obligatorio');
    }

    showLoading('Guardando perfil...');

    const res = await apiFetch('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ name, phone })
    });

    if (res.ok) {
        showSuccess('Perfil actualizado exitosamente', () => loadProfile());
    } else {
        const err = await res.json();
        showError(err.error || 'Error actualizando perfil');
    }
}

async function changePassword() {
    const currentPasswordInput = document.getElementById('currentPassword');
    const newPasswordInput = document.getElementById('newPassword');
    
    const currentPassword = currentPasswordInput ? currentPasswordInput.value : '';
    const newPassword = newPasswordInput ? newPasswordInput.value : '';

    if (!currentPassword || !newPassword) return showError('Ambos campos son requeridos');

    showLoading('Actualizando contraseña...');

    const res = await apiFetch('/user/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword })
    });

    if (res.ok) {
        showSuccess('Contraseña actualizada correctamente');
        if (currentPasswordInput) currentPasswordInput.value = '';
        if (newPasswordInput) newPasswordInput.value = '';
    } else {
        const err = await res.json();
        showError(err.error || 'Error cambiando contraseña');
    }
}

async function changePlan(planId) {
    showConfirm('¿Estás seguro de que deseas cambiar de plan?', async () => {
        showLoading('Actualizando plan...');
        try {
            const res = await apiFetch('/user/plan', {
                method: 'PUT',
                body: JSON.stringify({ newPlanId: planId })
            });
            if (res.ok) {
                showSuccess('Plan actualizado exitosamente', async () => {
                    await loadProfile();
                    await loadPlans();
                });
            } else {
                const err = await res.json();
                showError(err.error || 'Error cambiando plan');
            }
        } catch (e) {
            showError('Error de conexión al cambiar plan');
        }
    });
}

init();

async function openPoliciesModal() {
    showLoading('Cargando políticas...');
    const res = await apiFetch('/admin/policies');
    let termsText = 'No hay políticas definidas actualmente.';
    if (res && res.ok) {
        const data = await res.json();
        if (data.terms) termsText = data.terms;
    }
    hideLoading();

    const textToHtml = termsText.replace(/\n/g, '<br>');

    const modalHtml = `
        <div id="policiesModal" class="fixed inset-0 bg-black/50 backdrop-blur-sm z-[100] flex flex-col items-center justify-center p-4">
            <div class="bg-white dark:bg-[#151f2b] rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-gray-100 dark:border-gray-800">
                <div class="p-6 md:p-8 flex items-center justify-between border-b border-gray-100 dark:border-gray-800 bg-gray-50/50 dark:bg-gray-900/50">
                    <div class="flex items-center gap-4">
                        <div class="p-3 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-2xl">
                            <span class="material-symbols-outlined font-bold text-2xl">gavel</span>
                        </div>
                        <h2 class="text-2xl font-black text-gray-900 dark:text-white">Términos y Condiciones</h2>
                    </div>
                    <button onclick="document.getElementById('policiesModal').remove()" class="p-2 rounded-xl text-gray-400 hover:text-gray-600 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                <div class="p-6 md:p-8 overflow-y-auto flex-1 text-gray-600 dark:text-gray-300 space-y-4 max-w-none dark:prose-invert">
                    ${textToHtml}
                </div>
                <div class="p-6 md:p-8 border-t border-gray-100 dark:border-gray-800 flex justify-end bg-gray-50/50 dark:bg-gray-900/50">
                    <button onclick="document.getElementById('policiesModal').remove()" class="px-8 py-4 rounded-2xl bg-primary text-white font-black tracking-widest uppercase hover:-translate-y-1 shadow-lg shadow-primary/20 transition-all">
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    `;
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}
