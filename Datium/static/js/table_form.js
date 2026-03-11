checkAuth();

const urlParams = new URLSearchParams(window.location.search);
const systemId = urlParams.get('systemId');
const tableId = urlParams.get('tableId');

let systemTables = [];

async function init() {
    if (!systemId) {
        showError('ID de sistema no proporcionado');
        setTimeout(() => window.location.href = 'dashboard.html', 1500);
        return;
    }

    await loadSystemTablesForRelations();

    if (tableId) {
        document.title = "Editar Tabla - Datium";
        document.querySelector('h1').innerText = "Editar Tabla";
        const submitBtn = document.getElementById('btnSubmit');
        if (submitBtn) {
            submitBtn.innerHTML = '<span class="material-symbols-outlined">save</span> Actualizar Tabla';
        }
        await loadTableData();
    } else {
        addNewFieldRow();
    }

    loadSidebarInfo();
}

function goBack() {
    window.location.href = `system.html?id=${systemId}`;
}

async function loadSystemTablesForRelations() {
    const res = await apiFetch(`/systems/${systemId}/tables`);
    if (res.ok) {
        systemTables = await res.json();
    }
}

async function loadTableData() {
    const res = await apiFetch(`/tables/${tableId}`);
    if (res.ok) {
        const table = await res.json();
        document.getElementById('newTableName').value = table.name;
        document.getElementById('newTableDesc').value = table.description || '';
    }

    const fieldsRes = await apiFetch(`/tables/${tableId}/fields`);
    if (fieldsRes.ok) {
        const fields = await fieldsRes.json();
        if (fields.length === 0) {
            addNewFieldRow();
        } else {
            for (const f of fields) {
                addNewFieldRow(f);
            }
        }
    }
}

function addNewFieldRow(fieldData = null) {
    const container = document.getElementById('newFieldsContainer');
    const div = document.createElement('div');
    div.className = 'bg-gray-50 dark:bg-gray-900/50 p-3 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 flex flex-wrap gap-3 items-end animate-fade-in';

    div.innerHTML = `
        <div class="flex-1 min-w-[150px]">
            <input type="text" class="new-field-name w-full px-3 py-2 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-black/20 text-sm focus:ring-2 focus:ring-primary/50 dark:text-white" placeholder="Nombre Campo" required>
        </div>
        <div class="w-[140px]">
            <select class="new-field-type w-full px-3 py-2 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-black/20 text-sm focus:ring-2 focus:ring-primary/50 dark:text-white">
                <option value="text">Texto</option>
                <option value="number">Número</option>
                <option value="date">Fecha</option>
                <option value="boolean">Si/No</option>
                <option value="select">Lista (Select)</option>
                <option value="relation">Relación</option>
            </select>
        </div>
        
        <div class="flex-1 min-w-[200px] flex gap-2" >
             <div class="field-options-container flex-1 hidden">
                <input type="text" class="new-field-options w-full px-3 py-2 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-black/20 text-sm dark:text-white" placeholder="Opciones: A, B, C">
            </div>
            <div class="field-relation-container flex-1 hidden gap-2">
                 <select class="new-field-rel-table w-1/2 px-2 py-2 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-black/20 text-xs dark:text-white">
                    <option value="">Tabla Destino...</option>
                    ${systemTables.map(t => `<option value="${t.id}">${t.name}</option>`).join('')}
                </select>
                 <select class="new-field-rel-display w-1/2 px-2 py-2 rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-black/20 text-xs dark:text-white" disabled>
                    <option value="">Campo Display...</option>
                </select>
            </div>
        </div>

        <div class="flex items-center gap-2 h-10">
            <label class="flex items-center cursor-pointer">
                <input type="checkbox" class="new-field-required form-checkbox rounded text-primary border-gray-300 dark:border-gray-600 bg-transparent focus:ring-0 w-4 h-4">
                <span class="ml-2 text-xs text-gray-500 font-medium">Req.</span>
            </label>
            </label>
            <button type="button" onclick="const row = this.closest('.bg-gray-50'); row.style.opacity = '0'; setTimeout(() => row.remove(), 300);" class="p-2 text-gray-400 hover:text-red-500 transition-colors" title="Eliminar campo">
                <span class="material-symbols-outlined text-lg">delete</span>
            </button>
        </div>
    `;

    const select = div.querySelector('.new-field-type');
    const optionsDiv = div.querySelector('.field-options-container');
    const relationDiv = div.querySelector('.field-relation-container');
    const relTableSelect = div.querySelector('.new-field-rel-table');
    const relDisplaySelect = div.querySelector('.new-field-rel-display');
    const optionsInput = div.querySelector('.new-field-options');
    const nameInput = div.querySelector('.new-field-name');
    const requiredCheck = div.querySelector('.new-field-required');

    const toggleType = (type) => {
        optionsDiv.classList.add('hidden');
        relationDiv.classList.add('hidden');
        relationDiv.classList.remove('flex');

        if (type === 'select') {
            optionsDiv.classList.remove('hidden');
        }
        if (type === 'relation') {
            relationDiv.classList.remove('hidden');
            relationDiv.classList.add('flex');
        }
    };

    select.addEventListener('change', (e) => toggleType(e.target.value));

    const loadRelFields = async (tId, selectedFieldId = null) => {
        if (!tId) return;
        relDisplaySelect.innerHTML = '<option value="">Cargando...</option>';
        relDisplaySelect.disabled = true;

        const res = await apiFetch(`/tables/${tId}/fields`);
        if (res.ok) {
            const fields = await res.json();
            relDisplaySelect.innerHTML = fields.map(f => `<option value="${f.id}">${f.name}</option>`).join('');
            relDisplaySelect.disabled = false;

            if (selectedFieldId) {
                relDisplaySelect.value = selectedFieldId;
            }
        }
    };

    relTableSelect.addEventListener('change', async (e) => {
        loadRelFields(e.target.value);
    });

    container.appendChild(div);

    if (fieldData) {
        nameInput.value = fieldData.name;
        select.value = fieldData.type;
        requiredCheck.checked = fieldData.required;

        toggleType(fieldData.type);

        if (fieldData.type === 'select' && fieldData.options) {
            optionsInput.value = fieldData.options.join(', ');
        }

        if (fieldData.type === 'relation' && fieldData.relatedTableId) {
            relTableSelect.value = fieldData.relatedTableId;

            loadRelFields(fieldData.relatedTableId, fieldData.relatedDisplayFieldId)
                .then(() => {
                    if (!fieldData.relatedDisplayFieldId && fieldData.relatedFieldName) {
                        const options = Array.from(relDisplaySelect.options);
                        const match = options.find(opt => opt.text === fieldData.relatedFieldName);
                        if (match) relDisplaySelect.value = match.value;
                    }
                });
        }

        const idInput = document.createElement('input');
        idInput.type = 'hidden';
        idInput.className = 'new-field-id';
        idInput.value = fieldData.id;
        div.appendChild(idInput);
    }
}

async function saveTable() {
    const name = document.getElementById('newTableName').value;
    const description = document.getElementById('newTableDesc').value;
    if (!name) return showError('El nombre es requerido');

    const fieldRows = document.getElementById('newFieldsContainer').children;
    let validationError = null;

    const fields = Array.from(fieldRows).map(row => {
        const nameInput = row.querySelector('.new-field-name');
        if (!nameInput) return null;

        const idInput = row.querySelector('.new-field-id');
        // Fix: Use ternary to check if idInput exists and has value
        const fieldId = (idInput && idInput.value) ? parseInt(idInput.value) : null;

        const type = row.querySelector('.new-field-type').value;
        let options = [];
        let relatedTableId = null;
        let relatedDisplayFieldId = null;

        if (type === 'select') {
            const optsStr = row.querySelector('.new-field-options').value;
            if (optsStr) options = optsStr.split(',').map(s => s.trim()).filter(s => s);
        } else if (type === 'relation') {
            const tId = row.querySelector('.new-field-rel-table').value;
            const fId = row.querySelector('.new-field-rel-display').value;

            if (!tId) validationError = 'Debe seleccionar una Tabla Destino para los campos de tipo Relación.';
            if (tId) relatedTableId = parseInt(tId);
            if (fId) relatedDisplayFieldId = parseInt(fId);
        }

        return {
            id: fieldId,
            name: nameInput.value,
            type: type,
            required: row.querySelector('.new-field-required').checked,
            orderIndex: 0,
            options: options,
            relatedTableId: relatedTableId,
            relatedDisplayFieldId: relatedDisplayFieldId
        };
    }).filter(f => f && f.name);

    if (validationError) return showError(validationError);

    const btn = document.getElementById('btnSubmit');
    const originalBtnContent = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined animate-spin">progress_activity</span> Guardando...';
    btn.disabled = true;

    if (tableId) {
        const res = await apiFetch(`/systems/${systemId}/tables/${tableId}`, {
            method: 'PUT',
            body: JSON.stringify({ name, description, fields })
        });

        if (res.ok) {
            showSuccessModal(
                '¡Tabla Actualizada!',
                'La estructura de la tabla ha sido modificada correctamente.',
                [
                    {
                        text: 'Volver al Sistema',
                        primary: true,
                        onClick: () => window.location.href = `system.html?id=${systemId}`
                    },
                    {
                        text: 'Seguir Editando',
                        primary: false,
                        onClick: () => {
                            const modal = document.getElementById('success-modal');
                            modal.classList.add('opacity-0');
                            setTimeout(() => modal.remove(), 300);
                        }
                    }
                ]
            );
        } else {
            btn.innerHTML = originalBtnContent;
            btn.disabled = false;
            try {
                const errorData = await res.json();
                showError(errorData.message || errorData.error || 'Error actualizando tabla');
            } catch (e) {
                showError('Error actualizando tabla');
            }
        }
    } else {
        const res = await apiFetch(`/systems/${systemId}/tables`, {
            method: 'POST',
            body: JSON.stringify({ name, description, fields })
        });

        if (res.ok) {
            const savedTable = await res.json();
            showSuccessModal(
                '¡Tabla Exitos!',
                'La tabla se ha creado correctamente. Ahora puedes definir sus campos o volver al sistema.',
                [
                    {
                        text: 'Volver al Sistema',
                        primary: true,
                        onClick: () => window.location.href = `system.html?id=${systemId}`
                    },
                    {
                        text: 'Editar esta Tabla',
                        primary: false,
                        onClick: () => window.location.href = `table_form.html?systemId=${systemId}&tableId=${savedTable.id}`
                    }
                ]
            );
        } else {
            btn.innerHTML = originalBtnContent;
            btn.disabled = false;
            try {
                const errorData = await res.json();
                showError(errorData.message || 'Error creando tabla');
            } catch (e) {
                showError('Error creando tabla');
            }
        }
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
