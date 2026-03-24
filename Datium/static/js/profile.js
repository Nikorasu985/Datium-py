checkAuth();

async function init() {
    await loadProfile();
}

async function loadProfile() {
    const res = await apiFetch('/user/profile');
    if (res.ok) {
        const user = await res.json();

        document.getElementById('profileName').value = user.name || '';
        document.getElementById('profileEmail').value = user.email || '';
        document.getElementById('profileNameDisplay').innerText = user.name || 'Sin nombre';
        document.getElementById('profileEmailDisplay').innerText = user.email;

        const avatarImg = document.getElementById('pageUserAvatar');
        const initialEl = document.getElementById('pageUserInitial');

        if (user.avatarUrl) {
            avatarImg.src = user.avatarUrl;
            avatarImg.classList.remove('hidden');
            if (initialEl) initialEl.classList.add('hidden');
        } else {
            if (initialEl) {
                initialEl.innerText = (user.name || 'U').charAt(0).toUpperCase();
                initialEl.classList.remove('hidden');
            }
            avatarImg.classList.add('hidden');
        }

        const plans = { 1: 'Free', 2: 'Pro', 3: 'Corporate' };
        document.getElementById('currentPlanName').innerText = user.planName || 'Gratuito';

        updatePlanButtons(user.planId);
    }
}

function updatePlanButtons(currentPlanId) {
    const btns = document.querySelectorAll('#plansContainer button');
    btns.forEach((btn, index) => {
        const planId = index + 1;
        if (planId === currentPlanId) {
            btn.disabled = true;
            btn.innerText = 'Actual';
            btn.classList.remove('btn-outline-secondary', 'btn-primary', 'btn-dark');
            btn.classList.add('btn-success');
        } else {
            btn.disabled = false;
            btn.innerText = 'Seleccionar';
        }
    });
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

                avatarImg.src = newAvatarUrl;
                avatarImg.classList.remove('hidden');
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
    const name = document.getElementById('profileName').value;

    showLoading('Guardando perfil...');

    const res = await apiFetch('/user/profile', {
        method: 'PUT',
        body: JSON.stringify({ name })
    });

    if (res.ok) {
        showSuccess('Perfil actualizado exitosamente', () => loadProfile());
    } else {
        showError('Error actualizando perfil');
    }
}

async function changePassword() {
    const currentPassword = document.getElementById('currentPassword').value;
    const newPassword = document.getElementById('newPassword').value;

    if (!currentPassword || !newPassword) return showError('Ambos campos son requeridos');

    showLoading('Actualizando contraseña...');

    const res = await apiFetch('/user/password', {
        method: 'PUT',
        body: JSON.stringify({ currentPassword, newPassword })
    });

    if (res.ok) {
        showSuccess('Contraseña actualizada correctamente');
        document.getElementById('currentPassword').value = '';
        document.getElementById('newPassword').value = '';
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
                showSuccess('Plan actualizado exitosamente', () => loadProfile());
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
