checkAuth();

let allSystems = [];

async function init() {
    await loadSystems();
}

async function loadSystems() {
    showLoading('Cargando sistemas...');
    try {
        const res = await apiFetch('/systems');
        if (res.ok) {
            allSystems = await res.json();
            populateSystemSelects();
        } else {
            showError('Error cargando sistemas');
        }
    } catch (e) {
        showError('Error de conexión');
    } finally {
        hideLoading();
    }
}

function populateSystemSelects() {
    const sourceSelect = document.getElementById('sourceSystemSelect');
    const targetSelect = document.getElementById('targetSystemSelect');

    sourceSelect.innerHTML = '<option value="">Seleccionar Sistema...</option>';
    targetSelect.innerHTML = '<option value="">Seleccionar Sistema...</option>';

    allSystems.forEach(sys => {
        const option = `<option value="${sys.id}">${sys.name}</option>`;
        sourceSelect.innerHTML += option;
        targetSelect.innerHTML += option;
    });
}

async function loadSourceTables() {
    const sourceSystemId = document.getElementById('sourceSystemSelect').value;
    const container = document.getElementById('tableSelectContainer');
    const tableInfo = document.getElementById('tableInfo');
    const moveButton = document.getElementById('moveButton');

    container.innerHTML = '<p class="text-sm text-gray-400 p-2 text-center mt-10">Cargando tablas...</p>';
    tableInfo.classList.add('hidden');
    moveButton.disabled = true;

    if (!sourceSystemId) {
        container.innerHTML = '<p class="text-sm text-gray-400 p-2 text-center mt-10">Primero selecciona un sistema...</p>';
        return;
    }

    try {
        const res = await apiFetch(`/systems/${sourceSystemId}/tables`);
        if (res.ok) {
            const tables = await res.json();

            if (tables.length === 0) {
                container.innerHTML = '<p class="text-sm text-gray-400 p-2 text-center mt-10">Sin tablas disponibles</p>';
            } else {
                container.innerHTML = '';
                tables.forEach(table => {
                    const div = document.createElement('div');
                    div.className = 'flex items-center p-3 hover:bg-white dark:hover:bg-gray-800 rounded-lg transition-colors cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700 mb-1';
                    div.innerHTML = `
                        <input type="checkbox" id="chk_table_${table.id}" value="${table.id}" data-name="${table.name}"
                            class="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                            onchange="checkMoveButtonState()">
                        <label for="chk_table_${table.id}" class="ml-3 text-sm font-medium text-gray-700 dark:text-gray-200 cursor-pointer flex-1 select-none">
                            ${table.name}
                        </label>
                    `;
                    container.appendChild(div);
                });
            }
        } else {
            showError('Error cargando tablas');
            container.innerHTML = '<p class="text-sm text-red-500 p-2 text-center mt-10">Error carga</p>';
        }
    } catch (e) {
        showError('Error de conexión');
        container.innerHTML = '<p class="text-sm text-red-500 p-2 text-center mt-10">Error</p>';
    }
}

// Enable button when all defined
document.getElementById('sourceSystemSelect').addEventListener('change', checkMoveButtonState);
document.getElementById('targetSystemSelect').addEventListener('change', checkMoveButtonState);

function getSelectedTableCount() {
    return document.querySelectorAll('#tableSelectContainer input[type="checkbox"]:checked').length;
}

function checkMoveButtonState() {
    const s = document.getElementById('sourceSystemSelect').value;
    const t = document.getElementById('targetSystemSelect').value;
    const selectedCount = getSelectedTableCount();
    const btn = document.getElementById('moveButton');

    // Prevent moving to same system
    if (s && t && s === t) {
        btn.disabled = true;
        return;
    }

    btn.disabled = !(s && t && selectedCount > 0);

    updateVisuals();
}

function updateVisuals() {
    const sSelect = document.getElementById('sourceSystemSelect');
    const tSelect = document.getElementById('targetSystemSelect');

    // Update Systems visuals (same as before)
    const sId = sSelect.value;
    const tId = tSelect.value;
    const sSystem = allSystems.find(sys => String(sys.id) === String(sId));
    const tSystem = allSystems.find(sys => String(sys.id) === String(tId));

    // Source
    const sLogo = document.getElementById('visualSourceLogo');
    const sName = document.getElementById('visualSourceName');
    if (sSystem) {
        sLogo.src = sSystem.imageUrl || 'img/Isotipo modo claro.jpeg';
        sLogo.classList.remove('opacity-50', 'grayscale');
        sName.innerText = sSystem.name;
        sName.classList.remove('text-gray-400');
        sName.classList.add('text-[#111418]', 'dark:text-white');
    } else {
        sLogo.src = 'img/Isotipo modo claro.jpeg';
        sLogo.classList.add('opacity-50', 'grayscale');
        sName.innerText = 'Selecciona Origen';
        sName.classList.add('text-gray-400');
    }

    // Target
    const tLogo = document.getElementById('visualTargetLogo');
    const tName = document.getElementById('visualTargetName');
    if (tSystem) {
        tLogo.src = tSystem.imageUrl || 'img/Isotipo modo claro.jpeg';
        tLogo.classList.remove('opacity-50', 'grayscale');
        tName.innerText = tSystem.name;
        tName.classList.remove('text-gray-400');
        tName.classList.add('text-[#111418]', 'dark:text-white');
    } else {
        tLogo.src = 'img/Isotipo modo claro.jpeg';
        tLogo.classList.add('opacity-50', 'grayscale');
        tName.innerText = 'Selecciona Destino';
        tName.classList.add('text-gray-400');
    }

    // Update Tables Visual
    const tblContainer = document.getElementById('visualTableContainer');
    const tblName = document.getElementById('visualTableName');

    const checkboxes = document.querySelectorAll('#tableSelectContainer input[type="checkbox"]:checked');
    const count = checkboxes.length;

    if (count > 0) {
        if (count === 1) {
            tblName.innerText = checkboxes[0].dataset.name;
        } else {
            tblName.innerText = `${count} Tablas Seleccionadas`;
        }
        tblName.classList.remove('text-gray-500');
        tblName.classList.add('text-primary', 'font-bold');
        tblContainer.classList.remove('opacity-50');
        tblContainer.classList.add('bg-blue-50', 'dark:bg-blue-900/10', 'border-blue-200', 'dark:border-blue-800');
    } else {
        tblName.innerText = 'Ninguna tabla seleccionada';
        tblName.classList.add('text-gray-500');
        tblName.classList.remove('text-primary', 'font-bold');
        tblContainer.classList.add('opacity-50');
        tblContainer.classList.remove('bg-blue-50', 'dark:bg-blue-900/10', 'border-blue-200', 'dark:border-blue-800');
    }
}


function confirmMove() {
    const checkboxes = document.querySelectorAll('#tableSelectContainer input[type="checkbox"]:checked');
    const count = checkboxes.length;

    if (count === 0) return;

    showConfirm(`¿Estás seguro de copiar ${count} tablas? Se crearán copias independientes en el sistema destino.`, async () => {
        showLoading(`Copiando ${count} tablas...`);
        try {
            const targetSystemId = document.getElementById('targetSystemSelect').value;
            let successCount = 0;
            let errors = [];

            for (const chk of checkboxes) {
                const tableId = chk.value;
                const res = await apiFetch(`/tables/${tableId}/move?targetSystemId=${targetSystemId}`, {
                    method: 'PUT'
                });
                if (res.ok) {
                    successCount++;
                } else {
                    const err = await res.json();
                    errors.push(chk.dataset.name + ": " + (err.message || 'Error'));
                }
            }

            if (errors.length === 0) {
                showSuccess(`${successCount} tablas copiadas exitosamente`, () => {
                    loadSourceTables();
                    document.getElementById('targetSystemSelect').value = "";
                    checkMoveButtonState();
                });
            } else {
                let msg = `${successCount} copiadas. ${errors.length} errores:\n` + errors.join('\n');
                showError(msg);
                loadSourceTables(); // Reload to reflect partial success
            }

        } catch (e) {
            console.error(e);
            showError('Ocurrió un error inesperado');
        }
    });
}

async function moveTable() {
    const count = getSelectedTableCount();
    const targetSystemId = document.getElementById('targetSystemSelect').value;
    const sourceSystemId = document.getElementById('sourceSystemSelect').value;

    if (count === 0 || !targetSystemId) return;

    if (sourceSystemId === targetSystemId) {
        showError('El sistema destino no puede ser igual al origen');
        return;
    }

    confirmMove();
}

init();
