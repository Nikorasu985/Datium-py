checkAuth();

const sysSelect = document.getElementById('statsSystemSelect');
const tabSelect = document.getElementById('statsTableSelect');
const exportMainBtn = document.getElementById('exportMainBtn');
const exportDropdown = document.getElementById('exportDropdown');
const emptyState = document.getElementById('statsEmptyState');
const cards = ['cardTotalRecords', 'cardFieldTypes', 'cardTableInfo', 'cardTopValues', 'cardAdvancedStats', 'cardDistributionStats'];
let statsData = { tables: [], fields: {}, records: {} };
let chartInstances = {};

function destroyChart(id) {
    if (chartInstances[id]) { chartInstances[id].destroy(); }
}

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
    
    el.innerHTML = '<div class="relative w-full h-full p-2"><canvas></canvas></div>';
    const ctx = el.querySelector('canvas').getContext('2d');
    destroyChart(containerId);
    
    const isDark = document.documentElement.classList.contains('dark');
    const color = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDark ? '#9ca3af' : '#4b5563';

    chartInstances[containerId] = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: recData.map(d => d.name.length > 8 ? d.name.slice(0,8)+'…' : d.name),
            datasets: [{
                label: 'Registros Totales',
                data: recData.map(d => d.count),
                backgroundColor: 'rgba(19, 127, 236, 0.2)',
                borderColor: '#137fec',
                pointBackgroundColor: '#137fec',
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                r: {
                    angleLines: { color: color },
                    grid: { color: color },
                    pointLabels: { color: textColor, font: { size: 10 } },
                    ticks: { display: false } // hide numbers radially
                }
            }
        }
    });
}

function renderBarChart(containerId, data) {
    const el = document.getElementById(containerId);
    if (data.length === 0) { el.innerHTML = '<p class="text-sm text-gray-400 text-center mt-10">Sin datos</p>'; return; }
    
    el.innerHTML = '<div class="relative w-full h-full pb-4"><canvas></canvas></div>';
    const ctx = el.querySelector('canvas').getContext('2d');
    destroyChart(containerId);

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#9ca3af' : '#4b5563';
    const gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';

    chartInstances[containerId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(d => d.name.length > 10 ? d.name.slice(0, 10)+'…' : d.name),
            datasets: [{
                label: 'Registros',
                data: data.map(d => d.count),
                backgroundColor: 'rgba(19, 127, 236, 0.8)',
                borderRadius: 6,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
                y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: textColor } },
                x: { grid: { display: false }, ticks: { color: textColor } }
            }
        }
    });
}

function renderPieChart(containerId, data) {
    const el = document.getElementById(containerId);
    const entries = Object.entries(data);
    if (entries.length === 0) { el.innerHTML = '<p class="text-sm text-gray-400 text-center mt-10">Sin datos</p>'; return; }
    
    el.innerHTML = '<div class="relative w-full h-full pb-4"><canvas></canvas></div>';
    const ctx = el.querySelector('canvas').getContext('2d');
    destroyChart(containerId);

    const isDark = document.documentElement.classList.contains('dark');
    const textColor = isDark ? '#d1d5db' : '#374151';

    chartInstances[containerId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: entries.map(e => e[0].toUpperCase()),
            datasets: [{
                data: entries.map(e => e[1]),
                backgroundColor: ['#137fec', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444'],
                borderWidth: isDark ? 2 : 1,
                borderColor: isDark ? '#151f2b' : '#ffffff'
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            cutout: '70%',
            plugins: {
                legend: { position: 'right', labels: { color: textColor, font: { size: 10 } } }
            }
        }
    });
}

function renderPolarChart(containerId, data) {
    const el = document.getElementById(containerId);
    if (!el) return;
    const entries = Object.entries(data);
    if (entries.length === 0) { el.innerHTML = '<p class="text-sm text-gray-400 text-center mt-10">Sin datos de distribución</p>'; return; }
    
    el.innerHTML = '<div class="relative w-full h-full p-2"><canvas></canvas></div>';
    const ctx = el.querySelector('canvas').getContext('2d');
    destroyChart(containerId);

    const isDark = document.documentElement.classList.contains('dark');
    const color = isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDark ? '#d1d5db' : '#374151';

    chartInstances[containerId] = new Chart(ctx, {
        type: 'polarArea',
        data: {
            labels: entries.map(e => e[0].toUpperCase()),
            datasets: [{
                data: entries.map(e => e[1]),
                backgroundColor: [
                    'rgba(19, 127, 236, 0.5)', 
                    'rgba(139, 92, 246, 0.5)', 
                    'rgba(16, 185, 129, 0.5)', 
                    'rgba(245, 158, 11, 0.5)', 
                    'rgba(239, 68, 68, 0.5)'
                ],
                borderColor: isDark ? '#151f2b' : '#ffffff',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: textColor, font: { size: 10 } } }
            },
            scales: {
                r: {
                    grid: { color: color },
                    ticks: { display: false }
                }
            }
        }
    });
}

initStats();
