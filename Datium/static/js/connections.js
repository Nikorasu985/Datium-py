checkAuth();

// Elements
const domSysSelect = document.getElementById('viewerSystemSelect');
const domTabSelect = document.getElementById('viewerTableSelect');
const domBtnList = document.getElementById('btnViewList');
const domBtnGrid = document.getElementById('btnViewGrid');
const domEmptyState = document.getElementById('dataEmptyState');
const domLoader = document.getElementById('dataLoaderState');
const domListHeader = document.getElementById('dataListHeader');
const domContent = document.getElementById('dataContent');
const domCreateBtn = document.querySelector('a[href="table_form.html"]');
const domDiagramType = document.getElementById('diagramTypeSelect');

// State
let viewMode = 'list';
let currentSystemId = null;
let currentTableId = null;
let currentFields = [];
let currentRecords = [];
let currentTables = [];
let currentDiagramType = 'er';
let currentDiagramCode = '';
let zoomLevel = 1;
const relationCache = {};

async function init() {
    const theme = document.documentElement.classList.contains('dark') ? 'dark' : 'default';
    mermaid.initialize({ startOnLoad: false, theme: theme === 'dark' ? 'dark' : 'default', securityLevel: 'loose' });
    
    await fetchSystems();
    setupEventListeners();
    loadSidebarInfo();
}

function setupEventListeners() {
    if (domSysSelect) {
        domSysSelect.addEventListener('change', async (e) => {
            currentSystemId = e.target.value;
            if (currentSystemId) {
                if (domCreateBtn) domCreateBtn.href = `table_form.html?systemId=${currentSystemId}`;
                await fetchTables(currentSystemId);
                renderDiagram();
            } else {
                domTabSelect.innerHTML = '<option value="" disabled selected>Selecciona Tabla...</option>';
                domTabSelect.disabled = true;
                showEmptyState();
                clearDiagram();
            }
        });
    }

    if (domTabSelect) {
        domTabSelect.addEventListener('change', async (e) => {
            currentTableId = e.target.value;
            if (currentTableId) {
                await loadTableData(currentTableId);
            } else {
                showEmptyState();
            }
        });
    }

    if (domDiagramType) {
        domDiagramType.addEventListener('change', (e) => {
            currentDiagramType = e.target.value;
            renderDiagram();
        });
    }

    if (domBtnList) domBtnList.addEventListener('click', () => { viewMode = 'list'; updateViewToggles(); if (currentTableId) renderData(); });
    if (domBtnGrid) domBtnGrid.addEventListener('click', () => { viewMode = 'grid'; updateViewToggles(); if (currentTableId) renderData(); });

    // Zoom and Edit listeners
    const btnZoomIn = document.getElementById('btnZoomIn');
    const btnZoomOut = document.getElementById('btnZoomOut');
    const btnEdit = document.getElementById('btnEditDiagram');
    const editor = document.getElementById('diagramEditor');
    const mermaidArea = document.getElementById('mermaidCode');

    if (btnZoomIn) btnZoomIn.onclick = () => { zoomLevel += 0.1; updateZoom(); };
    if (btnZoomOut) btnZoomOut.onclick = () => { zoomLevel = Math.max(0.5, zoomLevel - 0.1); updateZoom(); };
    if (btnEdit) btnEdit.onclick = () => editor.classList.toggle('hidden');
    if (mermaidArea) {
        mermaidArea.oninput = (e) => {
            currentDiagramCode = e.target.value;
            renderDiagramFromCode(currentDiagramCode);
        };
    }

    // Scroll zoom
    const diagramContainer = document.getElementById('diagramContent');
    if (diagramContainer) {
        diagramContainer.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            zoomLevel = Math.max(0.1, Math.min(3, zoomLevel + delta));
            updateZoom();
        }, { passive: false });
    }
}

function updateZoom() {
    const wrapper = document.getElementById('diagramContainerWrapper');
    if (wrapper) {
        wrapper.style.transform = `scale(${zoomLevel})`;
        wrapper.style.transition = 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)';
    }
}

function clearDiagram() {
    const container = document.getElementById('diagramContent');
    if (container) {
        container.innerHTML = '<div class="text-center text-gray-400 text-xs"><span class="material-symbols-outlined text-3xl mb-2 opacity-20">hub</span><p>Diagrama no disponible</p></div>';
    }
}

async function renderDiagram() {
    if (!currentTables || currentTables.length === 0) {
        clearDiagram();
        return;
    }

    const wrapper = document.getElementById('diagramContainerWrapper');
    if (currentDiagramType === 'dictionary') {
        wrapper.style.transform = 'none';
        await renderDataDictionary();
        return;
    }

    try {
        let definition = '';
        if (currentDiagramType === 'er') {
            definition = 'erDiagram\n';
            const tableMap = {};
            const relationships = [];

            for (const table of currentTables) {
                const fRes = await apiFetch(`/tables/${table.id}/fields`);
                const fields = fRes.ok ? await fRes.json() : [];
                const safeName = table.name.replace(/[^a-zA-Z0-9]/g, '_');
                tableMap[table.id] = safeName;
                
                definition += `    ${safeName} {\n`;
                fields.forEach(f => {
                    const safeFName = f.name.replace(/[^a-zA-Z0-9]/g, '_');
                    let typeLabel = f.type.charAt(0).toUpperCase() + f.type.slice(1);
                    if (f.type === 'string') typeLabel = 'string';
                    if (f.type === 'number') typeLabel = 'number';
                    
                    let keyMarker = f.name.toLowerCase() === 'id' ? 'PK' : (f.relatedTableId ? 'FK' : '');
                    definition += `        ${typeLabel} ${safeFName} ${keyMarker}\n`;
                    
                    if (f.relatedTableId) {
                        relationships.push({ from: table.id, to: f.relatedTableId, label: f.name });
                    }
                });
                definition += '    }\n';
            }

            relationships.forEach(rel => {
                const fromName = tableMap[rel.from];
                const toName = tableMap[rel.to];
                if (fromName && toName) {
                    definition += `    ${fromName} ||--o{ ${toName} : "${rel.label}"\n`;
                }
            });

        } else if (currentDiagramType === 'flow') {
            definition = 'graph LR\n';
            definition += '    classDef table fill:#137fec,stroke:#fff,stroke-width:2px,color:#fff,rx:10px,ry:10px;\n';
            const tableMap = {};
            currentTables.forEach(t => {
                const safeName = t.name.replace(/[^a-zA-Z0-9_]/g, '');
                tableMap[t.id] = safeName;
                definition += `    T${t.id}["📚 ${t.name}"]:::table\n`;
            });
            
            for (const table of currentTables) {
                const fRes = await apiFetch(`/tables/${table.id}/fields`);
                const fields = fRes.ok ? await fRes.json() : [];
                fields.forEach(f => {
                    if (f.relatedTableId && tableMap[f.relatedTableId]) {
                        definition += `    T${table.id} -- ${f.name} --> T${f.relatedTableId}\n`;
                    }
                });
            }
        } else if (currentDiagramType === 'class') {
            definition = 'classDiagram\n';
            for (const table of currentTables) {
                const safeName = table.name.replace(/[^a-zA-Z0-9]/g, '_');
                definition += `    class ${safeName} {\n`;
                const fRes = await apiFetch(`/tables/${table.id}/fields`);
                const fields = fRes.ok ? await fRes.json() : [];
                fields.forEach(f => {
                    const safeFName = f.name.replace(/[^a-zA-Z0-9]/g, '_');
                    const typeLabel = f.type.charAt(0).toUpperCase() + f.type.slice(1);
                    definition += `        +${typeLabel} ${safeFName}\n`;
                    if (f.relatedTableId) {
                         const relatedTable = currentTables.find(t => t.id === f.relatedTableId);
                         if (relatedTable) {
                             const relSafeName = relatedTable.name.replace(/[^a-zA-Z0-9]/g, '_');
                             // Agregamos la relación fuera de la clase después
                         }
                    }
                });
                definition += `    }\n`;
                fields.forEach(f => {
                    if (f.relatedTableId) {
                        const relatedTable = currentTables.find(t => t.id === f.relatedTableId);
                        if (relatedTable) {
                            const relSafeName = relatedTable.name.replace(/[^a-zA-Z0-9]/g, '_');
                            definition += `    ${safeName} --|> ${relSafeName} : ${f.name}\n`;
                        }
                    }
                });
            }
        } else if (currentDiagramType === 'mindmap') {
            definition = 'mindmap\n';
            definition += `  root((Sistema))\n`;
            for (const table of currentTables) {
                const safeName = table.name.replace(/[^a-zA-Z0-9 ]/g, '');
                definition += `    ${safeName}\n`;
                const fRes = await apiFetch(`/tables/${table.id}/fields`);
                const fields = fRes.ok ? await fRes.json() : [];
                fields.forEach(f => {
                    const safeFName = f.name.replace(/[^a-zA-Z0-9 ]/g, '');
                    definition += `      ${safeFName}\n`;
                });
            }
        }

        currentDiagramCode = definition;
        const mermaidArea = document.getElementById('mermaidCode');
        if (mermaidArea) mermaidArea.value = definition;

        await renderDiagramFromCode(definition);
    } catch (e) {
        console.error("Mermaid error:", e);
    }
}

async function renderDataDictionary() {
    const wrapper = document.getElementById('diagramContainerWrapper');
    if (!wrapper) return;

    let html = `
        <div class="w-full max-w-4xl mx-auto space-y-8 animate-fade-in p-4">
            <div class="text-center mb-10">
                <h2 class="text-2xl font-black text-primary uppercase tracking-tighter mb-2">Diccionario de Datos</h2>
                <p class="text-xs text-gray-500 font-bold uppercase tracking-widest leading-relaxed">Estructura detallada y definiciones técnica del sistema</p>
            </div>
    `;

    for (const table of currentTables) {
        const fRes = await apiFetch(`/tables/${table.id}/fields`);
        const fields = fRes.ok ? await fRes.json() : [];
        
        html += `
            <div class="bg-white dark:bg-gray-900 shadow-2xl rounded-[2rem] border border-gray-100 dark:border-gray-800 p-8 hover:shadow-primary/5 transition-all">
                <div class="flex items-center gap-4 mb-6">
                    <div class="p-3 bg-primary/10 rounded-2xl">
                        <span class="material-symbols-outlined text-primary">analytics</span>
                    </div>
                    <div>
                        <h3 class="text-lg font-black text-[#111418] dark:text-white uppercase tracking-tight">${table.name}</h3>
                        <p class="text-[10px] text-gray-500 font-bold uppercase tracking-widest">${table.description || 'Sin descripción técnica'}</p>
                    </div>
                </div>
                
                <div class="overflow-x-auto">
                    <table class="w-full text-left text-[11px]">
                        <thead>
                            <tr class="border-b border-gray-100 dark:border-gray-800">
                                <th class="pb-3 font-black text-gray-400 uppercase tracking-widest">Campo</th>
                                <th class="pb-3 font-black text-gray-400 uppercase tracking-widest">Tipo</th>
                                <th class="pb-3 font-black text-gray-400 uppercase tracking-widest">Atributos</th>
                                <th class="pb-3 font-black text-gray-400 uppercase tracking-widest">Relación</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-gray-50 dark:divide-gray-800/50">
        `;

        fields.forEach(f => {
            const attrs = [];
            if (f.name.toLowerCase() === 'id') attrs.push('PRIMARY KEY');
            if (f.required) attrs.push('NOT NULL');
            if (f.type === 'number') attrs.push('NUMERIC');
            
            const rel = f.relatedTableId ? `Refers to Table ID: ${f.relatedTableId}` : '-';

            html += `
                <tr class="hover:bg-gray-50 dark:hover:bg-gray-800/30 transition-colors">
                    <td class="py-4 font-bold text-[#111418] dark:text-gray-200">${f.name}</td>
                    <td class="py-4">
                        <span class="px-2 py-1 rounded-md bg-gray-100 dark:bg-gray-800 font-mono text-[9px] uppercase">${f.type}</span>
                    </td>
                    <td class="py-4">
                        ${attrs.map(a => `<span class="text-[9px] font-black text-gray-400 mr-2 opacity-60">${a}</span>`).join('') || '-'}
                    </td>
                    <td class="py-4 text-primary font-bold">${rel}</td>
                </tr>
            `;
        });

        html += `
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    html += `</div>`;
    wrapper.innerHTML = html;
}

async function renderDiagramFromCode(code) {
    const wrapper = document.getElementById('diagramContainerWrapper');
    if (!wrapper) return;
    try {
        const { svg } = await mermaid.render('mermaid-diag-' + Date.now(), code);
        wrapper.innerHTML = `<div class="animate-fade-in">${svg}</div>`;
    } catch (e) {
        console.error("Render failed", e);
    }
}

function updateViewToggles() {
    if (!domBtnList || !domBtnGrid) return;
    if (viewMode === 'list') {
        domBtnList.classList.add('bg-white', 'dark:bg-gray-700', 'text-primary', 'shadow-sm');
        domBtnList.classList.remove('bg-transparent', 'dark:bg-transparent', 'text-gray-500');
        domBtnGrid.classList.remove('bg-white', 'dark:bg-gray-700', 'text-primary', 'shadow-sm');
        domBtnGrid.classList.add('bg-transparent', 'dark:bg-transparent', 'text-gray-500');
    } else {
        domBtnGrid.classList.add('bg-white', 'dark:bg-gray-700', 'text-primary', 'shadow-sm');
        domBtnGrid.classList.remove('bg-transparent', 'dark:bg-transparent', 'text-gray-500');
        domBtnList.classList.remove('bg-white', 'dark:bg-gray-700', 'text-primary', 'shadow-sm');
        domBtnList.classList.add('bg-transparent', 'dark:bg-transparent', 'text-gray-500');
    }
}

function showEmptyState() {
    if (domListHeader) domListHeader.classList.add('hidden');
    if (domEmptyState) domEmptyState.classList.remove('opacity-0', 'pointer-events-none');
    if (domContent) domContent.innerHTML = '';
}

function hideEmptyState() {
    if (domEmptyState) domEmptyState.classList.add('opacity-0', 'pointer-events-none');
}

function showLoader() {
    if (domLoader) domLoader.classList.remove('opacity-0', 'pointer-events-none');
}

function hideLoader() {
    if (domLoader) domLoader.classList.add('opacity-0', 'pointer-events-none');
}

async function fetchSystems() {
    try {
        const res = await apiFetch('/systems');
        if (res.ok) {
            const systems = await res.json();
            if (domSysSelect) {
                domSysSelect.innerHTML = '<option value="" disabled selected>Selecciona Sistema...</option>';
                systems.forEach(sys => {
                    const opt = document.createElement('option');
                    opt.value = sys.id;
                    opt.innerText = sys.name;
                    domSysSelect.appendChild(opt);
                });
            }
        }
    } catch (e) {
        console.error("Error fetching systems", e);
    }
}

async function fetchTables(sysId) {
    if (domTabSelect) {
        domTabSelect.disabled = true;
        domTabSelect.innerHTML = '<option value="" disabled selected>Cargando...</option>';
    }
    try {
        const res = await apiFetch(`/systems/${sysId}/tables`);
        if (res.ok) {
            currentTables = await res.json();
            if (domTabSelect) {
                domTabSelect.innerHTML = '<option value="" disabled selected>Selecciona Tabla...</option>';
                if (currentTables.length === 0) {
                    domTabSelect.innerHTML += `<option value="" disabled>No hay tablas</option>`;
                } else {
                    currentTables.forEach(t => {
                        domTabSelect.innerHTML += `<option value="${t.id}">${t.name}</option>`;
                    });
                }
                domTabSelect.disabled = false;
            }
        }
    } catch (e) {
        console.error("Error fetching tables", e);
    }
}

async function loadTableData(tabId) {
    showLoader();
    hideEmptyState();
    try {
        const fieldsRes = await apiFetch(`/tables/${tabId}/fields`);
        if (fieldsRes.ok) currentFields = await fieldsRes.json();
        const recordsRes = await apiFetch(`/tables/${tabId}/records`);
        if (recordsRes.ok) currentRecords = await recordsRes.json();
        await resolveForeignKeys(currentRecords);
        renderData();
    } catch (e) {
        console.error("Error loading table data", e);
        showEmptyState();
    } finally {
        hideLoader();
    }
}

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
}

function getDisplayValue(field, value) {
    if (value === null || value === undefined || value === '') return '<span class="text-gray-300 italic">vacío</span>';
    if (field.type === 'boolean') {
        return value === 'true' || value === true ? '<span class="text-green-500 font-bold">Sí</span>' : '<span class="text-red-500 font-bold">No</span>';
    }
    if (field.type === 'relation') {
        const relatedMap = relationCache[field.relatedTableId] || {};
        const safeVal = relatedMap[value] || value;
        return `<span class="text-blue-500 underline">#${safeVal}</span>`;
    }
    return value;
}

function renderData() {
    if (!domContent) return;
    if (currentRecords.length === 0) {
        if (domListHeader) domListHeader.classList.add('hidden');
        domContent.className = 'flex-1 overflow-y-auto p-4 flex items-center justify-center';
        domContent.innerHTML = `<div class="text-center text-gray-400">La tabla no tiene registros.</div>`;
        return;
    }
    if (viewMode === 'list') renderList(); else renderGrid();
}

function renderList() {
    domContent.className = 'flex-1 overflow-y-auto custom-scrollbar flex flex-col gap-3 p-3';
    if (domListHeader) domListHeader.classList.add('hidden'); 
    
    if (currentRecords.length === 0) {
        domContent.innerHTML = `<div class="flex flex-col items-center justify-center h-full opacity-40 py-10">
            <span class="material-symbols-outlined text-4xl mb-2">subtitles_off</span>
            <p class="text-[10px] font-bold uppercase tracking-widest">Sin registros</p>
        </div>`;
        return;
    }

    let rowsHtml = '';
    currentRecords.forEach(r => {
        let rowHtml = `<div class="bg-white dark:bg-gray-800/40 p-4 rounded-2xl border border-gray-100 dark:border-gray-800/60 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all cursor-default group relative overflow-hidden">
            <div class="flex items-center justify-between mb-3">
                <div class="flex items-center gap-2">
                    <span class="w-1.5 h-1.5 rounded-full bg-primary/40"></span>
                    <span class="text-[9px] font-black uppercase text-gray-400 tracking-wider">Registro #${r.id}</span>
                </div>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
                    <a href="table_form.html?systemId=${currentSystemId}&tableId=${currentTableId}" class="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20" title="Gestionar Tabla">
                        <span class="material-symbols-outlined text-[16px]">edit_square</span>
                    </a>
                    <button onclick="deleteRecordLocal(${r.id})" class="p-1.5 rounded-lg bg-red-50 dark:bg-red-900/10 text-red-500 hover:bg-red-100 transition-all" title="Eliminar Registro">
                        <span class="material-symbols-outlined text-[16px]">delete</span>
                    </button>
                </div>
            </div>
            <div class="space-y-3">`;
        
        currentFields.slice(0, 5).forEach(f => {
            const val = getDisplayValue(f, r.fieldValues[f.id]);
            rowHtml += `<div>
                <div class="text-[8px] font-black uppercase text-gray-400 tracking-widest mb-1 opacity-70">${f.name}</div>
                <div class="truncate text-[11px] font-semibold text-[#111418] dark:text-gray-200">${val}</div>
            </div>`;
        });
        rowHtml += `</div></div>`;
        rowsHtml += rowHtml;
    });
    domContent.innerHTML = rowsHtml;
}

function renderGrid() {
    if (domListHeader) domListHeader.classList.add('hidden');
    domContent.className = 'grid grid-cols-1 sm:grid-cols-2 gap-4 p-6';
    let gridHtml = '';
    currentRecords.forEach(r => {
        let cardHtml = `<div class="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm"><div class="font-bold text-xs mb-2">Registro #${r.id}</div>`;
        currentFields.slice(0, 4).forEach(f => {
            cardHtml += `<div class="mb-2"><div class="text-[10px] text-gray-400 uppercase">${f.name}</div><div class="text-xs">${getDisplayValue(f, r.fieldValues[f.id])}</div></div>`;
        });
        cardHtml += `</div>`;
        gridHtml += cardHtml;
    });
    domContent.innerHTML = gridHtml;
}

async function deleteRecordLocal(id) {
    if (confirm('¿Estás seguro de que deseas eliminar este registro?')) {
        try {
            const res = await apiFetch(`/tables/${currentTableId}/records/${id}`, { method: 'DELETE' });
            if (res.ok) {
                // Immediate CRUD feedback: update local state
                currentRecords = currentRecords.filter(r => r.id !== id);
                renderData();
                showSuccess('Registro eliminado correctamente');
            } else {
                showError('Error al eliminar el registro');
            }
        } catch (e) {
            console.error("Delete error", e);
            showError('Error de conexión');
        }
    }
}

async function loadSidebarInfo() {
    const res = await apiFetch('/user/profile');
    if (res && res.ok) {
        const u = await res.json();
        const n = document.getElementById('userName');
        if (n) n.innerText = u.name;
    }
}

init();
