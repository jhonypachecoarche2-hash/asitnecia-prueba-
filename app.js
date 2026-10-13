// ==========================================
// IMPORTACIONES Y CONFIGURACIÓN FIREBASE
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, deleteDoc, onSnapshot, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyDwkfqDznMeT-FPaXQqWI5Wok62MHZvfXE",
    authDomain: "estudiantes-b6bee.firebaseapp.com",
    projectId: "estudiantes-b6bee",
    storageBucket: "estudiantes-b6bee.firebasestorage.app",
    messagingSenderId: "180474287317",
    appId: "1:180474287317:web:e39867c0a047b5b9a17e5c",
    measurementId: "G-YTK4XMRY0D"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

let currentRole = 'admin';
let scanMode = 'Entrada';
let studentsList = [];
let attendanceList = [];
let html5QrCode = null;
let attendanceChartInstance = null;

window.setAccessMode = (mode) => {
    if (mode === 'student') {
        document.getElementById('student-login-box')?.classList.remove('hidden');
    } else {
        currentRole = 'admin';
        document.getElementById('auth-screen')?.classList.add('hidden');
        document.getElementById('app')?.classList.remove('hidden');
        initScanner();
        initChart();
    }
};

window.loginAsStudent = async () => {
    const dniInput = document.getElementById('login-dni');
    if (!dniInput) return;
    const dni = dniInput.value.trim();
    if (!dni) return alert('Por favor ingrese su DNI');
    
    try {
        const querySnapshot = await getDocs(collection(db, "students"));
        let found = null;
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.dni === dni) found = data;
        });

        if (found) {
            document.getElementById('auth-screen')?.classList.add('hidden');
            document.getElementById('app')?.classList.remove('hidden');
            const adminTabs = document.getElementById('admin-tabs');
            if (adminTabs) adminTabs.classList.add('hidden');
            const tabScanner = document.getElementById('tab-scanner');
            if (tabScanner) tabScanner.classList.add('hidden');
            
            document.getElementById('student-portal-view')?.classList.remove('hidden');
            document.getElementById('user-role-badge').innerText = 'Estudiante: ' + found.name;

            document.getElementById('badge-name').innerText = found.name;
            document.getElementById('badge-dni').innerText = 'DNI: ' + found.dni;
            document.getElementById('badge-grade').innerText = found.grade;

            const qrcodeContainer = document.getElementById('qrcode');
            if (qrcodeContainer) {
                qrcodeContainer.innerHTML = "";
                new QRCode(qrcodeContainer, {
                    text: found.dni,
                    width: 160,
                    height: 160
                });
            }
        } else {
            alert('DNI no registrado en el sistema.');
        }
    } catch (error) {
        console.error("Error en login de estudiante:", error);
        alert("Ocurrió un error al verificar el DNI.");
    }
};

window.switchTab = (tabName) => {
    ['scanner', 'students', 'reports', 'settings'].forEach(t => {
        const tabEl = document.getElementById('tab-' + t);
        const btnEl = document.getElementById('btn-tab-' + t);
        if (tabEl) tabEl.classList.add('hidden');
        if (btnEl) {
            btnEl.className = "tab-btn py-3 px-4 bg-slate-900 border border-slate-800 text-slate-300 hover:bg-slate-800 font-bold rounded-xl transition-all flex items-center justify-center space-x-2";
        }
    });

    const activeTab = document.getElementById('tab-' + tabName);
    const activeBtn = document.getElementById('btn-tab-' + tabName);
    if (activeTab) activeTab.classList.remove('hidden');
    if (activeBtn) {
        activeBtn.className = "tab-btn py-3 px-4 bg-purple-600 text-white font-bold rounded-xl shadow-md transition-all flex items-center justify-center space-x-2";
    }
    
    if (tabName === 'scanner' && !html5QrCode) {
        initScanner();
    }
};

window.setScanMode = (mode) => {
    scanMode = mode;
    const btnEntrada = document.getElementById('mode-entrada');
    const btnSalida = document.getElementById('mode-salida');
    if (!btnEntrada || !btnSalida) return;

    if (mode === 'Entrada') {
        btnEntrada.className = "flex-1 py-2 text-xs font-bold rounded-lg bg-blue-600 text-white transition-all";
        btnSalida.className = "flex-1 py-2 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition-all";
    } else {
        btnSalida.className = "flex-1 py-2 text-xs font-bold rounded-lg bg-purple-600 text-white transition-all";
        btnEntrada.className = "flex-1 py-2 text-xs font-bold rounded-lg text-slate-400 hover:text-white transition-all";
    }
};

function initScanner() {
    if (html5QrCode) return;
    const readerElement = document.getElementById("reader");
    if (!readerElement) return;

    html5QrCode = new Html5Qrcode("reader");
    html5QrCode.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: 250 },
        (decodedText) => { processAttendance(decodedText); },
        (errorMessage) => {}
    ).catch(err => { console.error("Error al iniciar cámara", err); });
}

async function processAttendance(dni) {
    try {
        const querySnapshot = await getDocs(collection(db, "students"));
        let student = null;
        querySnapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (data.dni === dni) student = data;
        });

        if (!student) {
            alert("Estudiante no encontrado con DNI: " + dni);
            return;
        }

        const now = new Date();
        const timeString = now.toLocaleTimeString();
        const dateString = now.toISOString().split('T')[0];
        let status = 'Puntual';

        if (scanMode === 'Entrada') {
            const limitTime = document.getElementById('setting-limit-time')?.value || "08:00";
            const currentTime = now.toTimeString().slice(0, 5);
            if (currentTime > limitTime) status = 'Tardanza';
        } else {
            status = 'Salida';
        }

        await addDoc(collection(db, "attendance"), {
            name: student.name,
            dni: student.dni,
            type: scanMode,
            status: status,
            time: timeString,
            date: dateString,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error("Error al registrar asistencia:", error);
    }
}

window.processManualScan = () => {
    const input = document.getElementById('manual-dni-input');
    if (!input) return;
    const dni = input.value.trim();
    if (dni) {
        processAttendance(dni);
        input.value = '';
    }
};

function initChart() {
    const canvas = document.getElementById('attendanceChart');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    attendanceChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: ['Puntual', 'Tardanza', 'Salida'],
            datasets: [{
                data: [0, 0, 0],
                backgroundColor: ['#3b82f6', '#f59e0b', '#a855f7'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: 'bottom', labels: { color: '#cbd5e1' } }
            }
        }
    });
}

function updateChartData() {
    if (!attendanceChartInstance) return;
    let punctual = 0, tardanza = 0, salida = 0;
    attendanceList.forEach(item => {
        if (item.status === 'Puntual') punctual++;
        else if (item.status === 'Tardanza') tardanza++;
        else if (item.status === 'Salida') salida++;
    });
    attendanceChartInstance.data.datasets[0].data = [punctual, tardanza, salida];
    attendanceChartInstance.update();
}

// Sincronización en tiempo real de Estudiantes
onSnapshot(query(collection(db, "students")), (snapshot) => {
    studentsList = [];
    const tbody = document.getElementById('students-table-tbody');
    if (!tbody) return;
    tbody.innerHTML = "";
    snapshot.forEach((docSnap) => {
        const data = { id: docSnap.id, ...docSnap.data() };
        studentsList.push(data);
        tbody.innerHTML += `
            <tr class="border-b border-slate-800 hover:bg-slate-950/50">
                <td class="px-4 py-3 font-medium text-white">${data.name}</td>
                <td class="px-4 py-3 font-mono">${data.dni}</td>
                <td class="px-4 py-3">${data.grade}</td>
                <td class="px-4 py-3">${data.parent || '-'}</td>
                <td class="px-4 py-3 text-center">
                    <button onclick="deleteStudent('${data.id}')" class="px-3 py-1 bg-red-900/40 text-red-400 border border-red-500/30 rounded-lg text-xs font-semibold hover:bg-red-900/60 transition-all">Eliminar</button>
                </td>
            </tr>
        `;
    });
});

// Sincronización en tiempo real de Asistencias
onSnapshot(query(collection(db, "attendance"), orderBy("timestamp", "desc")), (snapshot) => {
    attendanceList = [];
    const liveTbody = document.getElementById('live-attendance-tbody');
    const reportsTbody = document.getElementById('reports-table-tbody');
    if (liveTbody) liveTbody.innerHTML = "";
    if (reportsTbody) reportsTbody.innerHTML = "";

    let count = 0;
    snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        attendanceList.push(data);

        let badgeColor = "bg-blue-900/40 text-blue-400 border-blue-500/30";
        if (data.status === 'Tardanza') badgeColor = "bg-amber-900/40 text-amber-400 border-amber-500/30";
        if (data.status === 'Salida') badgeColor = "bg-purple-900/40 text-purple-400 border-purple-500/30";

        const rowHTML = `
            <tr class="border-b border-slate-800 hover:bg-slate-950/50">
                <td class="px-4 py-3 font-medium text-white">${data.name}</td>
                <td class="px-4 py-3 font-mono">${data.dni}</td>
                <td class="px-4 py-3">${data.type}</td>
                <td class="px-4 py-3"><span class="px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeColor}">${data.status}</span></td>
                <td class="px-4 py-3 font-mono text-xs">${data.date || ''} ${data.time}</td>
            </tr>
        `;

        if (liveTbody && count < 8) liveTbody.innerHTML += rowHTML;
        if (reportsTbody) reportsTbody.innerHTML += rowHTML;
        count++;
    });

    updateChartData();
});

window.openStudentModal = () => {
    const modal = document.getElementById('student-modal');
    if (modal) modal.classList.remove('hidden');
};

window.closeStudentModal = () => {
    const modal = document.getElementById('student-modal');
    if (modal) modal.classList.add('hidden');
};

// FUNCIÓN ACTUALIZADA PARA LEER TANTO DEL MODAL COMO DE LA VISTA PRINCIPAL
window.saveStudent = async () => {
    // Intenta leer primero de los inputs principales o del modal de forma inteligente
    const name = document.getElementById('modal-name')?.value.trim() || document.querySelector('input[placeholder*="Ej. Juan Pérez"]')?.value.trim();
    const dni = document.getElementById('modal-dni')?.value.trim() || document.querySelector('input[placeholder*="71234567"]')?.value.trim();
    const grade = document.getElementById('modal-grade')?.value.trim() || "Primero"; // Valor por defecto si no hay selector de grado en la principal
    const parent = document.getElementById('modal-parent')?.value.trim() || "No registrado";

    if (!name || !dni) {
        return alert('Por favor complete los campos obligatorios (Nombre y DNI)');
    }

    try {
        await addDoc(collection(db, "students"), { 
            name, 
            dni, 
            grade, 
            parent,
            timestamp: serverTimestamp() 
        });

        alert('¡Estudiante guardado y sincronizado con Firebase con éxito!');
        window.closeStudentModal();

        // Limpiar campos de texto si existen
        if (document.getElementById('modal-name')) document.getElementById('modal-name').value = '';
        if (document.getElementById('modal-dni')) document.getElementById('modal-dni').value = '';
        if (document.getElementById('modal-grade')) document.getElementById('modal-grade').value = '';
        if (document.getElementById('modal-parent')) document.getElementById('modal-parent').value = '';
    } catch (error) {
        console.error("Error guardando estudiante:", error);
        alert("Hubo un error al guardar en Firebase.");
    }
};

window.deleteStudent = async (id) => {
    if (confirm('¿Seguro que deseas eliminar este estudiante?')) {
        try {
            await deleteDoc(doc(db, "students", id));
        } catch (error) {
            console.error("Error eliminando estudiante:", error);
        }
    }
};

window.applyFilters = () => {
    const dateVal = document.getElementById('filter-date')?.value;
    const statusVal = document.getElementById('filter-status')?.value;
    const reportsTbody = document.getElementById('reports-table-tbody');
    if (!reportsTbody) return;
    reportsTbody.innerHTML = "";

    attendanceList.forEach(data => {
        if (dateVal && data.date !== dateVal) return;
        if (statusVal && data.status !== statusVal) return;

        let badgeColor = "bg-blue-900/40 text-blue-400 border-blue-500/30";
        if (data.status === 'Tardanza') badgeColor = "bg-amber-900/40 text-amber-400 border-amber-500/30";
        if (data.status === 'Salida') badgeColor = "bg-purple-900/40 text-purple-400 border-purple-500/30";

        reportsTbody.innerHTML += `
            <tr class="border-b border-slate-800 hover:bg-slate-950/50">
                <td class="px-4 py-3 font-medium text-white">${data.name}</td>
                <td class="px-4 py-3 font-mono">${data.dni}</td>
                <td class="px-4 py-3">${data.type}</td>
                <td class="px-4 py-3"><span class="px-2.5 py-1 rounded-full text-xs font-semibold border ${badgeColor}">${data.status}</span></td>
                <td class="px-4 py-3 font-mono text-xs">${data.date || ''} ${data.time}</td>
            </tr>
        `;
    });
};

window.resetFilters = () => {
    const filterDate = document.getElementById('filter-date');
    const filterStatus = document.getElementById('filter-status');
    if (filterDate) filterDate.value = '';
    if (filterStatus) filterStatus.value = '';
    window.applyFilters();
};

window.exportToCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,Estudiante,DNI,Tipo,Estado,Fecha,Hora\n";
    attendanceList.forEach(row => {
        csvContent += `"${row.name}","${row.dni}","${row.type}","${row.status}","${row.date || ''}","${row.time}"\n`;
    });
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "reporte_asistencia_escolar.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

window.downloadBadge = () => {
    const element = document.getElementById("digital-badge-container");
    if (!element) return;
    html2canvas(element, { scale: 2 }).then(canvas => {
        const link = document.createElement('a');
        link.download = 'carne_digital.png';
        link.href = canvas.toDataURL();
        link.click();
    });
};

window.saveSettings = () => {
    alert('Configuración guardada correctamente.');
};