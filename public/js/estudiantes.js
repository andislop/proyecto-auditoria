// Variables globales
let allEstudiantesData = [];
let allCarrerasData = [];
const rowsPerPage = 10;
let currentEstudiantesPage = 1;

// Referencias a los elementos del DOM
const estudiantesTableBody = document.getElementById('estudiantesTableBody');
const searchEstudiantesInput = document.getElementById('searchEstudiantes');
const dataModal = $('#dataModal');
const dataForm = document.getElementById('dataForm');
const dataModalLabel = document.getElementById('dataModalLabel');
const saveButton = document.getElementById('saveButton');
const nombreCompletoInput = document.getElementById('nombre_completo');
const cedulaInput = document.getElementById('cedula');
const carreraSelect = document.getElementById('carreraSelect');

// Función para mostrar el modal personalizado
async function showCustomAlert(title, message) {
    const customAlert = document.getElementById('customAlert');
    document.getElementById('customAlertTitle').textContent = title;
    document.getElementById('customAlertMessage').textContent = message;
    customAlert.style.display = 'flex';
    return new Promise(resolve => {
        document.getElementById('customAlertCloseBtn').onclick = () => {
            customAlert.style.display = 'none';
            resolve();
        };
    });
}

// Función para cargar las carreras desde la API
async function loadCarreras() {
    try {
        const response = await fetch('/api/carreras');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        allCarrerasData = await response.json();
        renderCarrerasSelect();
    } catch (error) {
        console.error('Error al cargar las carreras:', error);
        await showCustomAlert('Error', 'No se pudieron cargar las carreras.');
    }
}

// Función para renderizar el select de carreras
function renderCarrerasSelect() {
    carreraSelect.innerHTML = '<option value="">Seleccione una carrera...</option>';
    allCarrerasData.forEach(carrera => {
        const option = document.createElement('option');
        option.value = carrera.id_carrera;
        option.textContent = carrera.carrera;
        carreraSelect.appendChild(option);
    });
}

// Cargar estudiantes desde la API
async function loadEstudiantesFromAPI() {
    try {
        const response = await fetch('/api/estudiantes');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        allEstudiantesData = await response.json();
        updateEstudiantesTable();
    } catch (error) {
        console.error('Error al cargar los estudiantes:', error);
        await showCustomAlert('Error', 'No se pudieron cargar los estudiantes.');
    }
}

// Renderizar la tabla de estudiantes
function renderEstudiantesTable(data) {
    estudiantesTableBody.innerHTML = '';
    data.forEach(estudiante => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${estudiante.id_estudiante}</td>
            <td>${estudiante.nombre_completo}</td>
            <td>${estudiante.cedula}</td>
            <td>${estudiante.carreras?.carrera || 'N/A'}</td>
            <td>
                <button class="btn btn-warning btn-edit-estudiante" data-id="${estudiante.id_estudiante}" data-type="estudiante"><i class="zmdi zmdi-edit"></i></button>
                <button class="btn btn-danger btn-delete-estudiante" data-id="${estudiante.id_estudiante}" data-type="estudiante"><i class="zmdi zmdi-delete"></i></button>
            </td>
        `;
        estudiantesTableBody.appendChild(row);
    });
}

// Actualizar la tabla de estudiantes y paginación
function updateEstudiantesTable() {
    const searchTerm = searchEstudiantesInput.value.toLowerCase();
    const filteredData = allEstudiantesData.filter(estudiante =>
        estudiante.nombre_completo.toLowerCase().includes(searchTerm) ||
        estudiante.cedula.toLowerCase().includes(searchTerm)
    );

    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    const start = (currentEstudiantesPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedData = filteredData.slice(start, end);

    renderEstudiantesTable(paginatedData);
    renderPagination('paginationEstudiantes', totalPages, currentEstudiantesPage, (page) => {
        currentEstudiantesPage = page;
        updateEstudiantesTable();
    });
}

// Manejar los eventos de la tabla de estudiantes
estudiantesTableBody.addEventListener('click', async (e) => {
    const target = e.target.closest('button');
    if (!target) return;

    const id = target.dataset.id;

    if (target.classList.contains('btn-edit-estudiante')) {
        const estudiante = allEstudiantesData.find(est => est.id_estudiante == id);
        if (estudiante) {
            openDataModal('estudiante', 'Editar Estudiante', estudiante);
        }
    } else if (target.classList.contains('btn-delete-estudiante')) {
        const confirmDelete = await showCustomAlert('Confirmar', '¿Estás seguro de que quieres eliminar este estudiante?');
        if (confirmDelete) {
            deleteData('estudiante', id);
        }
    }
});

searchEstudiantesInput.addEventListener('input', () => {
    currentEstudiantesPage = 1;
    updateEstudiantesTable();
});

// Renderizar la paginación
function renderPagination(containerId, totalPages, currentPage, onPageChange) {
    const container = document.getElementById(containerId);
    container.innerHTML = '';

    const createLink = (page, text, isDisabled) => {
        const link = document.createElement('a');
        link.href = '#';
        link.textContent = text;
        if (isDisabled) {
            link.classList.add('disabled');
        } else {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                onPageChange(page);
            });
        }
        return link;
    };

    if (currentPage > 1) {
        container.appendChild(createLink(currentPage - 1, 'Anterior', false));
    }
    for (let i = 1; i <= totalPages; i++) {
        const link = createLink(i, i, false);
        if (i === currentPage) {
            link.classList.add('active');
        }
        container.appendChild(link);
    }
    if (currentPage < totalPages) {
        container.appendChild(createLink(currentPage + 1, 'Siguiente', false));
    }
}

// Abrir el modal para agregar/editar
function openDataModal(type, title, data = null) {
    dataModalLabel.textContent = title;
    dataForm.dataset.type = type;
    dataForm.dataset.id = data ? data[`id_${type}`] : '';

    // Rellenar el formulario si se está editando
    if (data) {
        nombreCompletoInput.value = data.nombre_completo;
        cedulaInput.value = data.cedula;
        carreraSelect.value = data.carreras.id_carrera;
    } else {
        dataForm.reset();
    }
    
    dataModal.modal('show');
    $.material.init(); // Reinicializar Material Design
}

// Manejar el envío del formulario
dataForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = dataForm.dataset.id;
    const url = `/api/estudiantes${id ? '/' + id : ''}`;
    const method = id ? 'PUT' : 'POST';

    const payload = {
        nombre_completo: nombreCompletoInput.value,
        cedula: cedulaInput.value,
        id_carrera: carreraSelect.value
    };

    try {
        const response = await fetch(url, {
            method: method,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error en la operación');
        }

        dataModal.modal('hide');
        await showCustomAlert('Éxito', 'Estudiante guardado con éxito.');
        loadEstudiantesFromAPI();

    } catch (error) {
        console.error('Error al guardar estudiante:', error);
        await showCustomAlert('Error', `Ocurrió un error al guardar. Mensaje: ${error.message}`);
    }
});

// Función para eliminar (lógicamente)
async function deleteData(type, id) {
    try {
        const response = await fetch(`/api/${type}s/${id}`, { method: 'DELETE' });
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Error al eliminar');
        }
        await showCustomAlert('Éxito', 'Estudiante eliminado con éxito.');
        loadEstudiantesFromAPI();
    } catch (error) {
        console.error('Error al eliminar estudiante:', error);
        await showCustomAlert('Error', `Ocurrió un error al eliminar. Mensaje: ${error.message}`);
    }
}

// Evento para abrir el modal
document.querySelector('.btn-add-estudiante').addEventListener('click', () => {
    openDataModal('estudiante', 'Agregar Estudiante');
});

// Cargar datos al iniciar
$(document).ready(function() {
    loadEstudiantesFromAPI();
    loadCarreras();
    $.material.init();
});
