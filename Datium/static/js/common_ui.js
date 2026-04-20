/**
 * common_ui.js - Datium Universal UI Components
 */

document.addEventListener('DOMContentLoaded', () => {
    injectReportButton();
});

function injectReportButton() {
    if (document.getElementById('universalReportBtn')) return;

    const btn = document.createElement('button');
    btn.id = 'universalReportBtn';
    btn.className = 'fixed bottom-6 right-6 w-14 h-14 bg-red-500 text-white rounded-full shadow-2xl flex items-center justify-center hover:bg-red-600 transition-all z-50 hover:scale-110 active:scale-90 group';
    btn.innerHTML = `
        <span class="material-symbols-outlined text-[10px]">report</span>
        <span class="text-[10px] font-black uppercase tracking-widest">Reportar</span>
    `;
    btn.onclick = openReportModal;
    document.body.appendChild(btn);

    // Inject Modal
    const modal = document.createElement('div');
    modal.id = 'reportModal';
    modal.className = 'fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] hidden flex items-center justify-center p-4';
    modal.innerHTML = `
        <div class="bg-white dark:bg-[#151f2b] w-full max-w-md rounded-[2.5rem] shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden animate-zoom-in">
            <div class="p-8">
                <div class="flex items-center gap-4 mb-8">
                    <div class="w-12 h-12 bg-red-500/10 rounded-2xl flex items-center justify-center text-red-500">
                        <span class="material-symbols-outlined text-3xl">bug_report</span>
                    </div>
                    <div>
                        <h3 class="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">Reportar Problema</h3>
                        <p class="text-xs text-gray-500 font-bold uppercase tracking-widest">Ayúdanos a mejorar Datium</p>
                    </div>
                </div>

                <div class="space-y-6">
                    <div>
                        <label class="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">Asunto</label>
                        <input type="text" id="reportTitle" placeholder="Ej: Error al exportar PDF" 
                            class="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl text-sm focus:ring-4 focus:ring-red-500/10 outline-none transition-all dark:text-white font-bold">
                    </div>
                    <div>
                        <label class="block text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 mb-2 ml-1">Descripción del Fallo</label>
                        <textarea id="reportSummary" rows="4" placeholder="Describe brevemente qué sucedió..."
                            class="w-full px-6 py-4 bg-gray-50 dark:bg-gray-900/50 border border-gray-200 dark:border-gray-800 rounded-2xl text-sm focus:ring-4 focus:ring-red-500/10 outline-none transition-all dark:text-white font-bold resize-none"></textarea>
                    </div>
                    
                    <div class="flex items-center gap-3 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-2xl border border-dashed border-gray-300 dark:border-gray-700">
                        <span class="material-symbols-outlined text-gray-400">add_a_photo</span>
                        <p class="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Se adjuntará una captura de pantalla automáticamente</p>
                    </div>
                </div>

                <div class="flex gap-3 mt-10">
                    <button onclick="closeReportModal()" class="flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">Cancelar</button>
                    <button onclick="submitReport()" class="flex-[2] py-4 bg-red-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-red-600 transition-all shadow-xl shadow-red-500/20 active:scale-95">Enviar Reporte</button>
                </div>
            </div>
        </div>
    `;
    document.body.appendChild(modal);
}

function openReportModal() {
    document.getElementById('reportModal').classList.remove('hidden');
    document.getElementById('reportModal').classList.add('flex');
}

function closeReportModal() {
    document.getElementById('reportModal').classList.add('hidden');
    document.getElementById('reportModal').classList.remove('flex');
}

// Helper function to get CSRF token from cookies
function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            // Does this cookie string begin with the name we want?
            if (cookie.substring(0, name.length + 1) === (name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

async function submitReport() {
    const title = document.getElementById('reportTitle').value;
    const summary = document.getElementById('reportSummary').value;
    
    if (!title || !summary) {
        alert("Por favor completa todos los campos");
        return;
    }

    const reportText = `Asunto: ${title}\nDescripción: ${summary}`;

    try {
        // En un entorno productivo usaríamos html2canvas aquí
        const res = await fetch('/api/user/reports', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify({
                title: 'Reporte de Usuario',
                summary: reportText,
                screenshotUrl: '' // Potentially implement screenshot capture later
            })
        });

        if (res.ok) {
            alert("Reporte enviado correctamente. ¡Gracias!");
            closeReportModal();
            document.getElementById('reportTitle').value = '';
            document.getElementById('reportSummary').value = '';
        }
    } catch (e) {
        console.error(e);
        alert("Error al enviar reporte");
    }
}
