let editingSystemId = null;

document.addEventListener('DOMContentLoaded', () => {
    initDropZone();

    const urlParams = new URLSearchParams(window.location.search);
    const sysId = urlParams.get('id');

    if (sysId) {
        loadSystemFromApi(sysId);
    }

    window.addEventListener('message', (event) => {
        if (event.data.type === 'editSystem') {
            loadSystemData(event.data.payload);
        } else if (event.data.type === 'resetForm') {
            resetForm();
        }
    });

    if (window.parent !== window) {
        window.parent.postMessage({ type: 'iframeReady' }, '*');
    }
});

async function loadSystemFromApi(id) {
    try {
        const allRes = await apiFetch('/systems');
        if (allRes.ok) {
            const systems = await allRes.json();
            const sys = systems.find(s => s.id == id);
            if (sys) {
                loadSystemData(sys);
                document.querySelector('h1').innerText = 'Editar Sistema';
            }
        }
    } catch (e) {
        console.error(e);
    }
}

function switchTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`content-${tabId}`).classList.remove('hidden');

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active-tab', 'border-primary', 'text-primary');
        btn.classList.add('border-transparent');
    });

    const activeBtn = document.getElementById(`tab-${tabId}`);
    activeBtn.classList.add('active-tab', 'border-primary', 'text-primary');
    activeBtn.classList.remove('border-transparent', 'text-gray-500', 'dark:text-gray-400');
}

function toggleSecurityFields() {
    const mode = document.getElementById('securityMode').value;
    const pwdContainer = document.getElementById('generalPasswordContainer');

    if (mode === 'general') {
        pwdContainer.classList.remove('hidden');
    } else {
        pwdContainer.classList.add('hidden');
        document.getElementById('generalPassword').value = '';
    }
}

function initDropZone() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const removeBtn = document.getElementById('removeImageBtn');

    dropZone.addEventListener('click', (e) => {
        if (e.target !== removeBtn && !removeBtn.contains(e.target)) {
            fileInput.click();
        }
    });

    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('border-primary', 'bg-primary/5', 'scale-[1.02]');
    });

    dropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-primary', 'bg-primary/5', 'scale-[1.02]');
    });

    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('border-primary', 'bg-primary/5', 'scale-[1.02]');
        const files = e.dataTransfer.files;
        if (files.length > 0) handleFileUpload(files[0]);
    });

    fileInput.addEventListener('change', () => {
        if (fileInput.files.length > 0) handleFileUpload(fileInput.files[0]);
    });

    removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeImage();
    });
}

function removeImage() {
    document.getElementById('newSystemImage').value = '';
    document.getElementById('imagePreview').classList.add('hidden');
    document.getElementById('removeImageBtn').classList.add('hidden');
    document.getElementById('fileInput').value = '';

    document.getElementById('uploadPlaceholder').classList.remove('opacity-0');
}

async function handleFileUpload(file) {
    if (!file.type.startsWith('image/')) return showError('Solo se permiten imágenes');

    const formData = new FormData();
    formData.append('file', file);

    const uploadPlaceholder = document.getElementById('uploadPlaceholder');
    const originalContent = uploadPlaceholder.innerHTML;

    uploadPlaceholder.innerHTML = '<span class="material-symbols-outlined animate-spin text-3xl text-primary">progress_activity</span>';

    try {
        // Need token for upload usually, but this fetch was http://localhost:8080... hardcoded
        // Ideally use apiFetch or add header. 
        // existing code used explicit fetch.
        // Assuming public upload or token not needed for this temp upload?
        // Actually, let's try to add token if it exists just in case.
        const token = localStorage.getItem('token');
        const headers = {};
        if (token) headers['Authorization'] = 'Bearer ' + token;

        const res = await fetch('/api/upload/image', {
            method: 'POST',
            credentials: 'include',
            headers: headers,
            body: formData
        });

        if (res.ok) {
            const data = await res.json();
            const imageUrl = data.url.startsWith('http') ? data.url : `http://localhost:8080${data.url}`;

            document.getElementById('newSystemImage').value = imageUrl;

            const imgPreview = document.getElementById('imagePreview');
            imgPreview.src = imageUrl;
            imgPreview.classList.remove('hidden');
            document.getElementById('removeImageBtn').classList.remove('hidden');

            uploadPlaceholder.classList.add('opacity-0');
            setTimeout(() => { uploadPlaceholder.innerHTML = originalContent; }, 500);

        } else {
            throw new Error('Upload failed');
        }
    } catch (e) {
        showError('Error al subir imagen');
        uploadPlaceholder.innerHTML = originalContent;
    }
}

function loadSystemData(sys) {
    editingSystemId = sys.id;
    document.getElementById('newSystemName').value = sys.name || '';
    document.getElementById('newSystemDesc').value = sys.description || '';
    document.getElementById('newSystemImage').value = sys.imageUrl || '';

    if (sys.securityMode) {
        document.getElementById('securityMode').value = sys.securityMode;
        toggleSecurityFields();
    }

    if (sys.imageUrl) {
        document.getElementById('imagePreview').src = sys.imageUrl;
        document.getElementById('imagePreview').classList.remove('hidden');
        document.getElementById('removeImageBtn').classList.remove('hidden');
        document.getElementById('uploadPlaceholder').classList.add('opacity-0');
    } else {
        removeImage();
    }

    document.getElementById('btnSave').innerHTML = '<span class="material-symbols-outlined">save</span> Actualizar';
}

function resetForm() {
    editingSystemId = null;
    document.getElementById('newSystemName').value = '';
    document.getElementById('newSystemDesc').value = '';
    document.getElementById('securityMode').value = 'none';
    document.getElementById('generalPassword').value = '';
    toggleSecurityFields();
    removeImage();

    switchTab('general');
    document.getElementById('btnSave').innerHTML = '<span class="material-symbols-outlined">check_circle</span> Guardar';
}

function cancelform() {
    if (window.parent === window) {
        window.location.href = 'dashboard.html';
    } else {
        window.parent.postMessage({ type: 'closeModal' }, '*');
    }
}

async function submitForm() {
    const name = document.getElementById('newSystemName').value.trim();
    const description = document.getElementById('newSystemDesc').value.trim();
    const imageUrl = document.getElementById('newSystemImage').value.trim();
    const securityMode = document.getElementById('securityMode').value;
    const generalPassword = document.getElementById('generalPassword').value;

    if (!name) {
        showError('El nombre del sistema es requerido');
        return;
    }

    if (securityMode === 'general' && !generalPassword && !editingSystemId) {
        showError('La contraseña es requerida para el modo de seguridad general');
        return;
    }

    if (window.parent !== window) {
        window.parent.postMessage({ type: 'startLoading' }, '*');
    } else {
        showLoading('Guardando sistema...');
    }

    const method = editingSystemId ? 'PUT' : 'POST';
    const url = editingSystemId ? `/systems/${editingSystemId}` : '/systems';

    const payload = {
        name,
        description: description || null,
        imageUrl: imageUrl || null,
        securityMode,
        generalPassword: securityMode === 'general' && generalPassword ? generalPassword : null
    };

    try {
        const res = await apiFetch(url, {
            method: method,
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            if (window.parent === window) {
                // Standalone mode
                const action = editingSystemId ? 'actualizado' : 'creado';
                showSuccess(`¡Sistema ${action} correctamente!`, () => {
                    window.location.href = 'dashboard.html';
                });
            } else {
                window.parent.postMessage({ type: 'systemSaved' }, '*');
                resetForm();
            }
        } else {
            const errorData = await res.json();
            showError(errorData.message || errorData.error || 'Error al guardar el sistema');
            if (window.parent !== window) {
                window.parent.postMessage({ type: 'stopLoading' }, '*');
            }
        }
    } catch (e) {
        console.error('Error:', e);
        showError('Error de conexión. Por favor intenta nuevamente.');
        if (window.parent !== window) {
            window.parent.postMessage({ type: 'stopLoading' }, '*');
        }
    }
}
