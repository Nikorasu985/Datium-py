checkAuth();
const urlParams = new URLSearchParams(window.location.search);
const tableId = urlParams.get('id');
let currentSystemId = null;
let currentFields = [];
let allRecords = [];
const relationCache = {};

function goBack() {
    window.history.back();
}

async function init() {
    await getSystemId();
    await loadData();
    loadSidebarInfo();
}

async function getSystemId() {
    if (currentSystemId) return currentSystemId;
    try {
        const res = await apiFetch(`/tables/${tableId}`);
        if (res.ok) {
            const table = await res.json();
            currentSystemId = table.systemId;

            const sysRes = await apiFetch(`/systems/${currentSystemId}`);
            if (sysRes.ok) {
                const sys = await sysRes.json();

                const logoEl = document.getElementById('systemLogo');
                if (logoEl) {
                    logoEl.src = sys.imageUrl || 'img/Isotipo modo claro.jpeg';
                    logoEl.onerror = () => { logoEl.src = 'img/Isotipo modo claro.jpeg'; };
                }

                document.getElementById('tableName').innerText = table.name;
                document.getElementById('tableDesc').innerText = table.description || 'Sin descripción';
                document.title = `${table.name} - Datium`;
            }
            return currentSystemId;
        }
    } catch (e) { console.error(e); }
    return null;
}

async function loadData() {
    await getSystemId();

    const fieldsRes = await apiFetch(`/tables/${tableId}/fields`);
    if (fieldsRes.ok) {
        currentFields = await fieldsRes.json();
        renderTableHead();
    }

    const recordsRes = await apiFetch(`/tables/${tableId}/records`);
    if (recordsRes.ok) {
        allRecords = await recordsRes.json();
        const countEl = document.getElementById('recordCount');
        if (countEl) countEl.innerText = allRecords.length;
        await resolveForeignKeys(allRecords);
        renderTableBody(allRecords);
    }
}

function filterRecords() {
    const term = document.getElementById('recordSearch').value.toLowerCase();
    const filtered = allRecords.filter(r => {
        if (String(r.id).includes(term)) return true;
        return Object.values(r.fieldValues).some(v => String(v).toLowerCase().includes(term));
    });
    renderTableBody(filtered);
}

document.getElementById('recordSearch').addEventListener('input', filterRecords);

async function resolveForeignKeys(records) {
    const relationFields = currentFields.filter(f => f.relatedTableId);

    for (const field of relationFields) {
        if (!relationCache[field.relatedTableId]) {
            const res = await apiFetch(`/tables/${field.relatedTableId}/records`);
            if (res.ok) {
                const relatedRecords = await res.json();
                const map = {};
                relatedRecords.forEach(r => {
                    const displayVal = field.relatedFieldName ? r.fieldValues[field.relatedFieldName] : r.id;
                    map[r.id] = displayVal;
                });
                relationCache[field.relatedTableId] = map;
            }
        }
    }
    renderTableBody(records);
}

function renderTableHead() {
    const thead = document.getElementById('tableHead');
    thead.innerHTML = `
        <tr>
            <th class="px-6 py-3 font-bold text-gray-500 dark:text-gray-400">ID</th>
            ${currentFields.map(f => `<th class="px-6 py-3 font-bold text-gray-500 dark:text-gray-400">${f.name}</th>`).join('')}
            <th class="px-6 py-3 font-bold text-gray-500 dark:text-gray-400">Acciones</th>
        </tr>
    `;
}

let editingRecordId = null;
let currentRecords = [];

function renderTableBody(records) {
    currentRecords = records;
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = records.map(r => `
        <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
            <td class="px-6 py-4 font-medium text-gray-900 dark:text-white">#${r.id}</td>
            ${currentFields.map(f => {
        let val = r.fieldValues[f.name] || '';
        if (f.relatedTableId && relationCache[f.relatedTableId]) {
            val = relationCache[f.relatedTableId][val] || val;
        }
        return `<td class="px-6 py-4">${val}</td>`;
    }).join('')}
            <td class="px-6 py-4">
                <div class="flex gap-2">
                    <button onclick="editRecord(${r.id})" class="text-blue-500 hover:text-blue-600 p-1 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
                        <span class="material-symbols-outlined text-lg">edit</span>
                    </button>
                    <button onclick="deleteRecord(${r.id})" class="text-red-500 hover:text-red-600 p-1 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors">
                        <span class="material-symbols-outlined text-lg">delete</span>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

function editRecord(id) {
    const record = allRecords.find(r => r.id === id);
    if (!record) return;

    editingRecordId = id;
    document.getElementById('modalTitle').innerText = 'Editar Registro #' + id;

    openRegisterModal(true);

    currentFields.forEach(f => {
        const el = document.getElementById(`modal_field_${f.id}`);
        const searchEl = document.getElementById(`search_modal_field_${f.id}`);

        const val = record.fieldValues[f.name];

        if (f.type === 'relation') {
            if (el) el.value = val;
            if (searchEl && relationCache[f.relatedTableId]) {
                searchEl.value = relationCache[f.relatedTableId][val] || val || '';
            }
        } else {
            if (el) el.value = val || '';
        }
    });
}

function openRegisterModal(isEditing = false) {
    document.getElementById('registerModal').classList.remove('hidden');
    if (!isEditing) {
        editingRecordId = null;
        document.getElementById('modalTitle').innerHTML = '<span class="material-symbols-outlined text-primary">post_add</span> Registrar Datos';
        document.getElementById('recordForm').reset();

        currentFields.forEach(f => {
            if (f.type === 'relation') {
                const el = document.getElementById(`modal_field_${f.id}`);
                if (el) el.value = '';
            }
        });
    }
    renderModalFields();
}

function closeRegisterModal() {
    document.getElementById('registerModal').classList.add('hidden');
    editingRecordId = null;
}

async function saveRecord() {
    const fieldValues = {};
    currentFields.forEach(f => {
        const el = document.getElementById(`modal_field_${f.id}`);
        const val = el ? el.value : null;
        fieldValues[f.id] = val;
    });

    const method = editingRecordId ? 'PUT' : 'POST';
    const url = editingRecordId
        ? `/tables/${tableId}/records/${editingRecordId}`
        : `/tables/${tableId}/records`;

    showLoading(editingRecordId ? 'Actualizando registro...' : 'Guardando registro...');

    const res = await apiFetch(url, {
        method: method,
        body: JSON.stringify({ values: fieldValues })
    });

    if (res.ok) {
        // showSuccess(editingRecordId ? 'Registro actualizado' : 'Registro guardado', () => {
        //     closeRegisterModal();
        //     loadData();
        // });

        const action = editingRecordId ? 'Actualizado' : 'Guardado';
        showSuccessModal(
            `¡Registro ${action}!`,
            'Los datos se han guardado correctamente en la tabla.',
            [
                {
                    text: 'Aceptar',
                    primary: true,
                    onClick: () => {
                        const modal = document.getElementById('success-modal');
                        modal.classList.add('opacity-0');
                        setTimeout(() => modal.remove(), 300);
                        closeRegisterModal();
                        loadData();
                    }
                }
            ]
        );
    } else {
        try {
            const errorData = await res.json();
            showError(errorData.message || errorData.error || await res.text());
        } catch (e) {
            showError('Error al guardar datos');
        }
    }
}

async function deleteRecord(id) {
    showConfirm('¿Eliminar registro?', () => {
        promptPassword(async () => {
            showLoading('Eliminando...');
            try {
                const res = await apiFetch(`/tables/${tableId}/records/${id}`, { method: 'DELETE' });
                if (res.ok) {
                    showSuccess('Registro eliminado', () => {
                        loadData();
                    });
                } else {
                    showError('Error eliminando registro');
                }
            } catch (e) {
                showError('Error de conexión');
            }
        });
    });
}

async function renderModalFields() {
    const container = document.getElementById('modalFieldsContainer');

    if (container.children.length > 0 && editingRecordId !== null) return;

    container.innerHTML = '';

    if (currentFields.length === 0) {
        container.innerHTML = '<div class="text-center text-gray-400 py-4">No hay campos variables definidos.</div>';
        return;
    }

    const htmlPromises = currentFields.map(async f => {
        let inputHtml = '';
        const baseInputClass = "w-full bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all dark:text-white placeholder-gray-400";

        if (f.type === 'select') {
            const opts = f.options || [];
            inputHtml = `
                <div class="relative">
                    <select id="modal_field_${f.id}" class="${baseInputClass} appearance-none cursor-pointer">
                        <option value="">Seleccionar...</option>
                        ${opts.map(opt => `<option value="${opt}">${opt}</option>`).join('')}
                    </select>
                    <div class="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                        <span class="material-symbols-outlined text-lg">expand_more</span>
                    </div>
                </div>
            `;
        } else if (f.type === 'boolean') {
            inputHtml = `
                <div class="relative">
                    <select id="modal_field_${f.id}" class="${baseInputClass} appearance-none cursor-pointer">
                        <option value="">Seleccionar...</option>
                        <option value="true">Sí</option>
                        <option value="false">No</option>
                    </select>
                    <div class="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-gray-500">
                        <span class="material-symbols-outlined text-lg">expand_more</span>
                    </div>
                </div>
            `;
        } else if (f.type === 'relation') {
            let options = [];
            if (f.relatedTableId) {
                if (!relationCache[f.relatedTableId]) {
                    try {
                        const res = await apiFetch(`/tables/${f.relatedTableId}/records`);
                        if (res.ok) {
                            const recs = await res.json();
                            const map = {};
                            recs.forEach(r => {
                                const val = f.relatedFieldName ? r.fieldValues[f.relatedFieldName] : r.id;
                                map[r.id] = val;
                            });
                            relationCache[f.relatedTableId] = map;
                            options = Object.entries(map).map(([id, val]) => ({ id, val }));
                        }
                    } catch (err) { console.error(err); }
                } else {
                    options = Object.entries(relationCache[f.relatedTableId]).map(([id, val]) => ({ id, val }));
                }
            }
            const safeOptions = JSON.stringify(options).replace(/"/g, '&quot;');

            const isEmpty = options.length === 0;
            const emptyMessage = isEmpty ? '<p class="text-xs text-red-500 mt-1">No hay registros en esta tabla.</p>' : '';
            const disabledAttr = isEmpty ? 'disabled' : '';
            const placeholder = isEmpty ? 'No hay opciones disponibles' : 'Buscar...';

            inputHtml = `
                <div class="relative relation-search-container">
                    <input type="text" class="${baseInputClass} ${isEmpty ? 'bg-gray-100 dark:bg-gray-800 cursor-not-allowed' : ''}" 
                           id="search_modal_field_${f.id}" placeholder="${placeholder}" ${disabledAttr}
                           autocomplete="off" onfocus="showRelationOptions(${f.id})" 
                           oninput="filterRelationOptions(${f.id})" 
                           onblur="setTimeout(() => hideRelationOptions(${f.id}), 200)">
                    <input type="hidden" id="modal_field_${f.id}">
                    <div id="list_modal_field_${f.id}" class="absolute w-full mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-auto z-50" 
                         style="max-height: 200px; display: none;" data-options="${safeOptions}"></div>
                    ${emptyMessage}
                </div>
            `;
        } else {
            inputHtml = `<input type="${getInputType(f.type)}" id="modal_field_${f.id}" class="${baseInputClass}" placeholder="${f.name}">`;
        }

        return `
            <div class="col-span-1">
                <label class="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-widest mb-1">${f.name}</label>
                ${inputHtml}
            </div>
        `;
    });

    const htmlParts = await Promise.all(htmlPromises);
    container.innerHTML = htmlParts.join('');
}

function showRelationOptions(fieldId) {
    const list = document.getElementById(`list_modal_field_${fieldId}`);
    const data = JSON.parse(list.dataset.options || '[]');
    renderRelationOptions(fieldId, data);
    list.style.display = 'block';
}

function hideRelationOptions(fieldId) {
    const list = document.getElementById(`list_modal_field_${fieldId}`);
    if (list) list.style.display = 'none';
}

function filterRelationOptions(fieldId) {
    const text = document.getElementById(`search_modal_field_${fieldId}`).value.toLowerCase();
    const list = document.getElementById(`list_modal_field_${fieldId}`);
    const data = JSON.parse(list.dataset.options || '[]');
    const filtered = data.filter(d => String(d.val).toLowerCase().includes(text) || String(d.id).includes(text));
    renderRelationOptions(fieldId, filtered);
    list.style.display = 'block';
}

function renderRelationOptions(fieldId, options) {
    const list = document.getElementById(`list_modal_field_${fieldId}`);
    if (options.length === 0) {
        list.innerHTML = '<div class="p-3 text-gray-500 text-sm">No se encontraron resultados</div>';
        return;
    }
    list.innerHTML = options.map(o => `
        <a href="javascript:void(0)" class="block px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" 
           onclick="selectRelationOption(${fieldId}, '${o.id}', '${o.val.replace(/'/g, "\\'")}')">
           ${o.val} <span class="text-xs text-gray-400 ml-2">#${o.id}</span>
        </a>
    `).join('');
}

function selectRelationOption(fieldId, id, val) {
    document.getElementById(`modal_field_${fieldId}`).value = id;
    document.getElementById(`search_modal_field_${fieldId}`).value = val;
    hideRelationOptions(fieldId);
}

function getInputType(type) {
    if (type === 'number') return 'number';
    if (type === 'date') return 'date';
    return 'text';
}

async function exportTable(format = 'csv') {
    try {
        const res = await apiFetch(`/tables/${tableId}/export?format=${format}`);
        if (res.ok) {
            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `tabla_${tableId}.${format}`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            a.remove();
            showSuccess('Tabla exportada correctamente');
        } else {
            showError('Error exportando tabla (' + format + ')');
        }
    } catch (e) {
        console.error(e);
        showError('Error exportando tabla');
    }
}

async function loadSidebarInfo() {
    const res = await apiFetch('/user/profile');
    if (res && res.ok) {
        const userProfile = await res.json();
        const nameEl = document.getElementById('userName');
        const emailEl = document.getElementById('userEmail');
        const initialEl = document.getElementById('userInitial');
        const avatarImg = document.getElementById('userAvatar');

        if (nameEl) nameEl.innerText = userProfile.name || 'Usuario';
        if (emailEl) emailEl.innerText = userProfile.email || '...';

        if (userProfile.avatarUrl) {
            if (avatarImg) {
                avatarImg.src = userProfile.avatarUrl;
                avatarImg.classList.remove('hidden');
            }
            if (initialEl) initialEl.classList.add('hidden');
        } else {
            if (initialEl) {
                initialEl.innerText = (userProfile.name || 'U').charAt(0).toUpperCase();
                initialEl.classList.remove('hidden');
            }
            if (avatarImg) avatarImg.classList.add('hidden');
        }
    }
}

init();
