checkAuth();

const sysSelect = document.getElementById('statsSystemSelect');
const tabSelect = document.getElementById('statsTableSelect');
const exportMainBtn = document.getElementById('exportMainBtn');
const exportDropdown = document.getElementById('exportDropdown');
const emptyState = document.getElementById('statsEmptyState');
const cards = ['cardTotalRecords', 'cardFieldTypes', 'cardTableInfo', 'cardTopValues', 'cardAdvancedStats', 'cardDistributionStats'];
let statsData = { tables: [], fields: {}, records: {} };

async function initStats() {
    await fetchSystems();
    sysSelect.addEventListener('change', onSystemChange);
    tabSelect.addEventListener('change', onTableChange);
    
    // Export Dropdown Logic
    exportMainBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        exportDropdown.classList.toggle('hidden');
    });

    document.addEventListener('click', () => {
        exportDropdown.classList.add('hidden');
    });
}

async function fetchSystems() {
    try {
        const res = await apiFetch('/systems');
        if (res && res.ok) {
            const systems = await res.json();
            sysSelect.innerHTML = '<option value="" disabled selected>Selecciona Sistema...</option>';
            systems.forEach(s => {
                const o = document.createElement('option');
                o.value = s.id; o.textContent = s.name;
                sysSelect.appendChild(o);
            });
        }
    } catch (e) { }
}

async function onSystemChange() {
    const sysId = sysSelect.value;
    if (!sysId) return;
    tabSelect.disabled = true;
    tabSelect.innerHTML = '<option value="" selected>Todas las Tablas</option>';
    statsData = { tables: [], fields: {}, records: {} };

    try {
        const res = await apiFetch(`/systems/${sysId}/tables`);
        if (res && res.ok) {
            statsData.tables = await res.json();
            statsData.tables.forEach(t => {
                const o = document.createElement('option');
                o.value = t.id; o.textContent = t.name;
                tabSelect.appendChild(o);
            });
            tabSelect.disabled = false;

            for (const t of statsData.tables) {
                const fRes = await apiFetch(`/tables/${t.id}/fields`);
                if (fRes && fRes.ok) statsData.fields[t.id] = await fRes.json();
                const rRes = await apiFetch(`/tables/${t.id}/records`);
                if (rRes && rRes.ok) statsData.records[t.id] = await rRes.json();
            }

            renderStats();
            exportMainBtn.disabled = false;
        }
    } catch (e) { }
}

function onTableChange() {
    renderStats(tabSelect.value || null);
}

function renderStats(filterTableId) {
    emptyState.classList.add('hidden');
    cards.forEach(id => document.getElementById(id).classList.remove('hidden'));

    let tables = statsData.tables;
    if (filterTableId) tables = tables.filter(t => String(t.id) === String(filterTableId));

    let totalRecords = 0;
    const recPerTable = [];
    const fieldTypeCounts = {};
    const topValues = {};

    tables.forEach(t => {
        const recs = statsData.records[t.id] || [];
        const fields = statsData.fields[t.id] || [];
        totalRecords += recs.length;
        recPerTable.push({ name: t.name, count: recs.length });

        fields.forEach(f => {
            fieldTypeCounts[f.type] = (fieldTypeCounts[f.type] || 0) + 1;

            if (f.type === 'text' || f.type === 'select') {
                const valueCounts = {};
                recs.forEach(r => {
                    const v = r.fieldValues[f.id];
                    if (v) valueCounts[v] = (valueCounts[v] || 0) + 1;
                });
                const sorted = Object.entries(valueCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
                if (sorted.length > 0) {
                    topValues[`${t.name} → ${f.name}`] = sorted;
                }
            }
        });
    });

    document.getElementById('totalRecordsCount').textContent = totalRecords;
    renderBarChart('recordsPerTableChart', recPerTable);
    renderPieChart('fieldTypesChart', fieldTypeCounts);
    renderRadarChart('advancedStatsChart', recPerTable, fieldTypeCounts);
    renderPolarChart('distributionStatsChart', fieldTypeCounts);
    renderTableDetail(tables);
    renderTopValues(topValues);
}

function renderRadarChart(containerId, recData, fieldData) {
    const el = document.getElementById(containerId);
    if (recData.length === 0) { el.innerHTML = '<p class="text-sm text-gray-400 text-center mt-10">Sin datos avanzados</p>'; return; }
    
    // Using a simple SVG implementation for Radar if we don't want to add another library dependency,
    // but the user expects "all kind of graphs possible". Chart.js is already in use for parts,
    // let's check if Chart.js is imported. The previous dev used custom HTML for bar/pie.
    // I will stick to custom high-premium CSS/SVG for consistency.
    
    const labels = recData.map(d => d.name);
    const values = recData.map(d => d.count);
    const max = Math.max(...values, 1);
    
    el.innerHTML = `<div class="flex flex-col gap-4 h-full py-4">
        <div class="flex-1 relative flex items-center justify-center">
             <svg viewBox="0 0 100 100" class="w-full h-full max-h-[180px]">
                <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" class="text-gray-100 dark:text-gray-800" stroke-width="0.5"/>
                <circle cx="50" cy="50" r="30" fill="none" stroke="currentColor" class="text-gray-100 dark:text-gray-800" stroke-width="0.5"/>
                <circle cx="50" cy="50" r="20" fill="none" stroke="currentColor" class="text-gray-100 dark:text-gray-800" stroke-width="0.5"/>
                ${recData.map((d, i) => {
                    const angle = (i / recData.length) * 2 * Math.PI - Math.PI / 2;
                    const r = (d.count / max) * 40;
                    const x = 50 + r * Math.cos(angle);
                    const y = 50 + r * Math.sin(angle);
                    return `<line x1="50" y1="50" x2="${50 + 40 * Math.cos(angle)}" y2="${50 + 40 * Math.sin(angle)}" stroke="currentColor" class="text-gray-100 dark:text-gray-800" stroke-width="0.5"/>
                            <circle cx="${x}" cy="${y}" r="2" class="fill-primary animate-pulse"/>`;
                }).join('')}
                <polygon points="${recData.map((d, i) => {
                    const angle = (i / recData.length) * 2 * Math.PI - Math.PI / 2;
                    const r = (d.count / max) * 40;
                    return `${50 + r * Math.cos(angle)},${50 + r * Math.sin(angle)}`;
                }).join(' ')}" fill="rgba(19, 127, 236, 0.2)" stroke="#137fec" stroke-width="1"/>
             </svg>
        </div>
    </div>`;
}

function renderBarChart(containerId, data) {
    const el = document.getElementById(containerId);
    if (data.length === 0) { el.innerHTML = '<p class="text-sm text-gray-400 text-center mt-10">Sin datos</p>'; return; }
    const max = Math.max(...data.map(d => d.count), 1);
    el.innerHTML = `<div class="flex items-end gap-4 h-full px-2 pb-6 pt-4">
        ${data.map((d, i) => {
        const h = Math.max(8, (d.count / max) * 100);
        const gradientClass = i % 2 === 0 ? 'from-primary to-blue-400' : 'from-purple-500 to-indigo-400';
        return `<div class="flex-1 flex flex-col items-center gap-2 group/bar">
                <div class="relative w-full flex flex-col items-center">
                    <span class="text-[10px] font-black text-gray-400 mb-1 opacity-0 group-hover/bar:opacity-100 transition-opacity">${d.count}</span>
                    <div style="height:${h}px; height:${h}%;min-height:8px;" 
                         class="w-full bg-gradient-to-t ${gradientClass} rounded-t-xl transition-all duration-500 hover:scale-x-105 hover:brightness-110 shadow-[0_0_15px_rgba(19,127,236,0.1)]"></div>
                </div>
                <span class="text-[9px] font-black text-gray-500 uppercase tracking-tighter truncate w-full text-center" title="${d.name}">${d.name.length > 8 ? d.name.slice(0, 8) + '…' : d.name}</span>
            </div>`;
    }).join('')}
    </div>`;
}

function renderPieChart(containerId, data) {
    const el = document.getElementById(containerId);
    const entries = Object.entries(data);
    if (entries.length === 0) { el.innerHTML = '<p class="text-sm text-gray-400 text-center mt-10">Sin datos</p>'; return; }
    const total = entries.reduce((s, e) => s + e[1], 0);
    const colors = ['#137fec', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];
    const gradients = [
        'bg-gradient-to-r from-blue-500 to-blue-400',
        'bg-gradient-to-r from-purple-500 to-purple-400',
        'bg-gradient-to-r from-emerald-500 to-emerald-400',
        'bg-gradient-to-r from-amber-500 to-amber-400',
        'bg-gradient-to-r from-rose-500 to-rose-400'
    ];
    el.innerHTML = `<div class="flex flex-col gap-4 h-full justify-center">
        ${entries.map((e, i) => {
        const pct = ((e[1] / total) * 100).toFixed(1);
        return `<div class="group/item">
                <div class="flex justify-between items-center mb-1.5 px-1">
                    <div class="flex items-center gap-2">
                        <div class="w-2 h-2 rounded-full ${gradients[i % gradients.length]}"></div>
                        <span class="text-[10px] font-black text-gray-600 dark:text-gray-300 uppercase tracking-widest">${e[0]}</span>
                    </div>
                    <span class="text-[10px] font-black text-primary bg-primary/5 px-2 py-0.5 rounded-lg border border-primary/10 transition-all group-hover/item:scale-110">${e[1]} (${pct}%)</span>
                </div>
                <div class="w-full bg-gray-100 dark:bg-gray-800/50 rounded-full h-1.5 overflow-hidden">
                    <div class="h-full rounded-full transition-all duration-1000 ${gradients[i % gradients.length]} shadow-[0_0_10px_rgba(19,127,236,0.1)]" style="width:${pct}%"></div>
                </div>
            </div>`;
    }).join('')}
    </div>`;
}

function renderTableDetail(tables) {
    const el = document.getElementById('tableDetailGrid');
    el.innerHTML = tables.map(t => {
        const recs = statsData.records[t.id] || [];
        const fields = statsData.fields[t.id] || [];
        return `<div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
            <div class="flex items-center gap-2 mb-3">
                <span class="material-symbols-outlined text-primary text-lg">table_rows</span>
                <span class="font-bold text-sm text-[#111418] dark:text-white truncate">${t.name}</span>
            </div>
            <div class="grid grid-cols-2 gap-3">
                <div class="text-center p-2 rounded-lg bg-white dark:bg-gray-900/50">
                    <div class="text-xl font-black text-primary">${recs.length}</div>
                    <div class="text-[10px] font-bold text-gray-400 uppercase">Registros</div>
                </div>
                <div class="text-center p-2 rounded-lg bg-white dark:bg-gray-900/50">
                    <div class="text-xl font-black text-purple-500">${fields.length}</div>
                    <div class="text-[10px] font-bold text-gray-400 uppercase">Campos</div>
                </div>
            </div>
        </div>`;
    }).join('');
}

function renderTopValues(topValues) {
    const el = document.getElementById('topValuesContainer');
    const entries = Object.entries(topValues);
    if (entries.length === 0) {
        el.innerHTML = '<p class="text-sm text-gray-400 col-span-full text-center py-4">No hay datos de texto suficientes para analizar</p>';
        return;
    }
    el.innerHTML = entries.slice(0, 6).map(([key, vals]) => {
        return `<div class="p-4 rounded-xl bg-gray-50 dark:bg-gray-800/50 border border-gray-100 dark:border-gray-700">
            <p class="text-xs font-bold text-gray-500 mb-3 truncate" title="${key}">${key}</p>
            <div class="space-y-2">
                ${vals.map(([v, c]) => `<div class="flex justify-between items-center"><span class="text-xs text-gray-700 dark:text-gray-300 truncate mr-2">${v}</span><span class="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">${c}</span></div>`).join('')}
            </div>
        </div>`;
    }).join('');
}

function exportData(format) {
    const filterTableId = tabSelect.value || null;
    let tables = statsData.tables;
    if (filterTableId) tables = tables.filter(t => String(t.id) === String(filterTableId));

    if (format === 'json') {
        const data = tables.map(t => ({
            tabla: t.name,
            descripcion: t.description || '',
            registros: (statsData.records[t.id] || []).length,
            campos: (statsData.fields[t.id] || []).map(f => ({ name: f.name, type: f.type })),
            datos: statsData.records[t.id] || []
        }));
        downloadFile(JSON.stringify(data, null, 2), `datium_stats_${Date.now()}.json`, 'application/json');
    } else if (format === 'csv') {
        let csv = 'Tabla,Registros,Campos,Tipo de Datos\n';
        tables.forEach(t => {
            const types = (statsData.fields[t.id] || []).map(f => f.type).join('|');
            csv += `"${t.name}",${(statsData.records[t.id] || []).length},${(statsData.fields[t.id] || []).length},"${types}"\n`;
        });
        downloadFile(csv, `datium_stats_${Date.now()}.csv`, 'text/csv');
    } else if (format === 'pdf') {
        // High premium: Hide sidebar and trigger print
        window.print();
    }
    showSuccess(`Estadísticas exportadas en ${format.toUpperCase()}`);
}

function downloadFile(content, fileName, contentType) {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
}

function renderPolarChart(containerId, data) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const entries = Object.entries(data);
    if (entries.length === 0) { el.innerHTML = '<p class="text-sm text-gray-400 text-center mt-10">Sin datos de distribución</p>'; return; }
    
    const max = Math.max(...entries.map(e => e[1]), 1);
    const colors = ['#137fec', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'];

    el.innerHTML = `<div class="flex items-center justify-center h-full py-4 relative">
        <svg viewBox="0 0 100 100" class="w-full h-full max-h-[180px] drop-shadow-2xl">
            <defs>
                ${entries.map((e, i) => `
                    <linearGradient id="polarGrad${i}" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:${colors[i % colors.length]};stop-opacity:0.8" />
                        <stop offset="100%" style="stop-color:${colors[i % colors.length]};stop-opacity:0.2" />
                    </linearGradient>
                `).join('')}
            </defs>
            ${entries.map((e, i) => {
                const angleStep = (2 * Math.PI) / entries.length;
                const startAngle = i * angleStep - Math.PI / 2;
                const endAngle = (i + 1) * angleStep - Math.PI / 2;
                const r = (e[1] / max) * 45;
                
                const x1 = 50 + r * Math.cos(startAngle);
                const y1 = 50 + r * Math.sin(startAngle);
                const x2 = 50 + r * Math.cos(endAngle);
                const y2 = 50 + r * Math.sin(endAngle);
                
                const largeArcFlag = angleStep > Math.PI ? 1 : 0;
                
                return `<path d="M 50 50 L ${x1} ${y1} A ${r} ${r} 0 ${largeArcFlag} 1 ${x2} ${y2} Z" 
                              fill="url(#polarGrad${i})" 
                              stroke="${colors[i % colors.length]}" 
                              stroke-width="0.5"
                              class="transition-all duration-500 hover:brightness-125 hover:scale-105 origin-center">
                            <title>${e[0]}: ${e[1]}</title>
                        </path>`;
            }).join('')}
        </svg>
    </div>`;
}

initStats();
