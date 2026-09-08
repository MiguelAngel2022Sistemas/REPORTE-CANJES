'use strict';

// ==================== ESTADO GLOBAL ====================
const AppState = {
    productos: [],
    listaCanjes: [],
    datosLote: [],
    itemCounter: 0,
    dataTable: null,
    archivoActual: null,
    productoActual: null,
    indexSeleccionado: -1,
    ultimoIndexInsertado: 0
};

// Variables para modales
let fileModal = null;
let deleteModal = null;
let exportModal = null;

// ==================== UTILIDADES ====================

function limpiarTexto(texto) {
    return texto ? texto.toString().trim().toUpperCase() : "";
}

function mostrarAlerta(mensaje, tipo) {
    const iconos = { success: 'success', error: 'error', warning: 'warning', info: 'info' };
    Swal.fire({
        icon: iconos[tipo] || 'info',
        title: tipo === 'error' ? 'Error' : 'Información',
        text: mensaje,
        toast: true,
        position: 'top-end',
        showConfirmButton: false,
        timer: 3000,
        timerProgressBar: true
    });
}

function calcularUrgente(fechaMmAaaa, estado) {
    if (!fechaMmAaaa || !/^\d{2}\/\d{4}$/.test(fechaMmAaaa) || !estado) return "";

    try {
        const [mes, anio] = fechaMmAaaa.split('/');
        const fecha = new Date(parseInt(anio), parseInt(mes) - 1, 1);

        const mesesRestar = {
            'POLÍTICA REGULAR': 4,
            'NO TIENE POLÍTICA': 1,
            'POLÍTICA EXCEPCIONAL': 1
        };

        const meses = mesesRestar[estado.trim().toUpperCase()] || 0;
        if (meses === 0) return "";

        fecha.setMonth(fecha.getMonth() - meses);
        const mesUrgente = (fecha.getMonth() + 1).toString().padStart(2, '0');
        const anioUrgente = fecha.getFullYear();

        return `${mesUrgente}/${anioUrgente}`;
    } catch (error) {
        console.error("Error calculando fecha urgente:", error);
        return "";
    }
}

function actualizarCampo(id, valor) {
    const campo = document.getElementById(id);
    if (!campo) return;

    campo.value = valor || '';
    campo.classList.toggle('campo-llenado', valor && valor.trim() !== '');
}

function formatoMmAaaa(input) {
    const valor = input.value;
    if (valor.length === 4) {
        const mes = valor.substring(0, 2);
        const anio = valor.substring(2, 4);

        if (parseInt(mes, 10) > 12 || parseInt(mes, 10) === 0) {
            mostrarAlerta('El mes ingresado es inválido (01-12).', 'warning');
        } else {
            input.value = `${mes}/20${anio}`;
        }
    }
}

// ==================== ALMACENAMIENTO LOCAL ====================

function guardarDatosLocales() {
    try {
        localStorage.setItem('canjesGuardados', JSON.stringify(AppState.listaCanjes));
        localStorage.setItem('itemCounter', AppState.itemCounter);
        localStorage.setItem('ultimoArchivo', AppState.archivoActual);
    } catch (error) {
        console.error('Error guardando datos en localStorage:', error);
    }
}

function cargarDatosLocales() {
    try {
        const canjesGuardados = localStorage.getItem('canjesGuardados');
        const counterGuardado = localStorage.getItem('itemCounter');
        const ultimoArchivo = localStorage.getItem('ultimoArchivo');

        if (canjesGuardados) AppState.listaCanjes = JSON.parse(canjesGuardados);
        if (counterGuardado) AppState.itemCounter = parseInt(counterGuardado);
        if (ultimoArchivo) {
            AppState.archivoActual = ultimoArchivo;
            document.getElementById('labelArchivo').textContent = `Archivo cargado: ${ultimoArchivo}`;
        }

        if (AppState.itemCounter > 0) {
            document.getElementById('itemCounter').textContent = `🧮 Ítems: ${AppState.itemCounter}`;
        }
    } catch (error) {
        console.error('Error cargando datos desde localStorage:', error);
    }
}

function verificarUltimoArchivo() {
    const ultimoArchivo = localStorage.getItem('ultimoArchivo');
    if (ultimoArchivo) {
        const btnUltimoArchivo = document.getElementById('btnUltimoArchivo');
        btnUltimoArchivo.textContent = `Usar último archivo: ${ultimoArchivo}`;
        btnUltimoArchivo.classList.remove('d-none');
        document.getElementById('labelArchivo').textContent = `Archivo cargado: ${ultimoArchivo}`;
        return true;
    }
    return false;
}

// ==================== PRODUCTOS ====================

function buscarProducto() {
    const codigo = limpiarTexto(document.getElementById('inputCodigo').value);

    if (!codigo || !AppState.productos || AppState.productos.length === 0) {
        mostrarAlerta('Ingresa un código válido y asegúrate de haber cargado un archivo de políticas', 'warning');
        return;
    }

    const producto = AppState.productos.find(p =>
        limpiarTexto(p['COD POSU']) === codigo || limpiarTexto(p['EAN']) === codigo
    );

    if (!producto) {
        mostrarAlerta(`No se encontró el producto con código: ${codigo}`, 'error');
        limpiarCamposProducto();
        return;
    }

    actualizarCampo('labelDescripcion', producto['DESCRIPCION']);
    actualizarCampo('labelLab', producto['LABORATORIO']);
    actualizarCampo('labelLif', producto['LIF Condicional']);
    actualizarCampo('labelEstado', producto['POLITICA']);

    // Verificar similitud en el JSON de lotes usando el código POSU General
    const posuGeneral = limpiarTexto(producto['COD POSU']);

    // Elementos de la UI
    const labelPosu = document.getElementById('labelPosuGeneral');
    const labelProveedor = document.getElementById('labelProveedorLote');
    const labelLote = document.getElementById('labelLecturaLote');
    const labelVida = document.getElementById('labelTiempoVida');

    // Mostramos explícitamente el código POSU General que se está usando
    if (labelPosu) labelPosu.textContent = posuGeneral;

    const productoLote = AppState.datosLote.find(p => {
        if (!p['COD FARMAVENTA']) return false;
        const codJson = p['COD FARMAVENTA'].toString().trim().toUpperCase();
        return codJson === posuGeneral || parseInt(codJson, 10) === parseInt(posuGeneral, 10);
    });

    if (productoLote) {
        actualizarEstadoBotonLote(true);
        labelProveedor.textContent = productoLote['PRODUCTO'] || 'Dato no especificado';
        labelProveedor.className = 'mb-2 mb-md-0 fw-bold text-dark';

        labelVida.textContent = productoLote['TIEMPO DE VIDA UTIL'] || 'Dato no especificado';
        labelVida.className = 'mb-2 mb-md-0 fw-bold text-dark';

        labelLote.textContent = productoLote['LECTURA DE LOTE'] || 'Dato no especificado';
        labelLote.className = 'mb-0 fw-bold text-dark';
    } else {
        actualizarEstadoBotonLote(false);
        labelProveedor.textContent = 'Datos no encontrados';
        labelProveedor.className = 'mb-2 mb-md-0 text-danger fst-italic';

        labelVida.textContent = 'Datos no encontrados';
        labelVida.className = 'mb-2 mb-md-0 text-danger fst-italic';

        labelLote.textContent = 'Datos no encontrados';
        labelLote.className = 'mb-0 text-danger fst-italic';
    }


    const condicionLabel = document.getElementById('labelCondicionPolitica');
    const condicionPanel = document.getElementById('panelCondicionPolitica');
    const alerta = document.getElementById('alertCondicion');

    const condicionCanje = (producto['Condición para Canje Entero'] || '').toString().trim();

    if (condicionLabel && condicionPanel && alerta) {
        condicionLabel.textContent = condicionCanje;
        alerta.className = 'alert alert-info fw-bold shadow-sm';
        condicionPanel.style.display = condicionCanje ? 'block' : 'none';
    }
    AppState.productoActual = producto;
    document.getElementById('inputFecha').focus();
}


function actualizarEstadoBotonLote(tieneDatos) {
    const btn = document.getElementById('btnToggleLote');
    if (!btn) return;
    if (tieneDatos) {
        btn.classList.remove('btn-danger');
        btn.classList.add('btn-success');
        btn.innerHTML = '🟢 Ver información de Lote y Vida Útil (F2) Verifica productos sin fecha vencimiento por lote';
    } else {
        btn.classList.remove('btn-success');
        btn.classList.add('btn-danger');
        btn.innerHTML = '🔴 Sin información de lote (F2) Verifica productos sin fecha vencimiento por lote';
    }
}

function togglePanelLote() {
    const panel = document.getElementById('panelLote');
    const btn = document.getElementById('btnToggleLote');
    if (!panel || !btn) return;
    if (btn.classList.contains('btn-danger')) {
        mostrarAlerta('No hay información de lote disponible.', 'warning');
        return;
    }
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

function limpiarCamposProducto() {
    document.getElementById('inputCodigo').value = '';
    actualizarCampo('labelDescripcion', '');
    actualizarCampo('labelLab', '');
    actualizarCampo('labelLif', '');
    actualizarCampo('labelEstado', '');

    const labelPosu = document.getElementById('labelPosuGeneral');
    const labelProveedor = document.getElementById('labelProveedorLote');
    const labelLote = document.getElementById('labelLecturaLote');
    const labelVida = document.getElementById('labelTiempoVida');

    if (labelPosu) {
        labelPosu.textContent = 'Esperando búsqueda...';
    }
    if (labelProveedor) {
        labelProveedor.textContent = 'Esperando búsqueda...';
        labelProveedor.className = 'mb-2 mb-md-0';
    }
    if (labelLote) {
        labelLote.textContent = 'Esperando búsqueda...';
        labelLote.className = 'mb-0';
    }
    actualizarEstadoBotonLote(false);
    document.getElementById('panelLote').style.display = 'none';
    if (labelVida) {
        labelVida.textContent = 'Esperando búsqueda...';
        labelVida.className = 'mb-2 mb-md-0';
    }


    const condicionLabel2 = document.getElementById('labelCondicionPolitica');
    const condicionPanel2 = document.getElementById('panelCondicionPolitica');
    if (condicionLabel2) condicionLabel2.textContent = '';
    if (condicionPanel2) condicionPanel2.style.display = 'none';
    AppState.productoActual = null;
}

function limpiarFormulario() {
    document.getElementById('inputCodigo').value = '';
    document.getElementById('inputFecha').value = '';
    document.getElementById('inputEntero').value = '0';
    document.getElementById('inputFraccion').value = '0';
    limpiarCamposProducto();
    AppState.indexSeleccionado = -1;
    document.getElementById('inputCodigo').focus();
}

function guardarProducto() {
    if (!AppState.productoActual) {
        mostrarAlerta('Primero busca un producto', 'warning');
        return;
    }

    const responsable = document.getElementById('inputResponsable').value.trim();
    const fechaVenc = document.getElementById('inputFecha').value.trim();
    const entero = document.getElementById('inputEntero').value.trim();
    const fraccion = document.getElementById('inputFraccion').value.trim();

    if (!responsable || !fechaVenc) {
        mostrarAlerta('Los campos "Responsable" y "F-V" son obligatorios.', 'warning');
        return;
    }

    if (!/^\d{2}\/\d{4}$/.test(fechaVenc)) {
        mostrarAlerta('El formato de fecha es incorrecto. Debe ser MM/AAAA.', 'warning');
        return;
    }

    const enteroNum = parseInt(entero || '0', 10);
    const fraccionNum = parseInt(fraccion || '0', 10);

    if (enteroNum === 0 && fraccionNum === 0) {
        mostrarAlerta('No puedes guardar E = 0 y F = 0 al mismo tiempo. Debe existir stock entero o fracción.', 'error');
        return;
    }

    if (enteroNum < 0 || fraccionNum < 0) {
        mostrarAlerta('No se permiten valores negativos en Entero o Fracción.', 'warning');
        return;
    }

    const estado = AppState.productoActual['POLITICA'] || '';
    const urgente = calcularUrgente(fechaVenc, estado);

    const nuevoCanje = {
        RESPONSABLE: responsable,
        'COD POSU': AppState.productoActual['COD POSU'],
        'DESCRIPCION': AppState.productoActual['DESCRIPCION'],
        'LABORATORIO': AppState.productoActual['LABORATORIO'],
        'ESTADO': estado,
        'F-V': fechaVenc,
        'E': entero || '0',
        'F': fraccion || '0',
        'URGENTE': urgente
    };

    if (AppState.indexSeleccionado >= 0) {
        AppState.listaCanjes[AppState.indexSeleccionado] = nuevoCanje;
        AppState.indexSeleccionado = -1;
        mostrarAlerta('Producto actualizado correctamente', 'success');
    } else {
        AppState.listaCanjes.unshift(nuevoCanje);
        AppState.ultimoIndexInsertado = 0;
        AppState.itemCounter++;
        mostrarAlerta('Producto guardado correctamente', 'success');
    }

    document.getElementById('itemCounter').textContent = `🧮 Ítems: ${AppState.itemCounter}`;
    actualizarTabla();
    limpiarFormulario();

    setTimeout(() => {
        const primeraFila = document.querySelector('#productosTable tbody tr');

        if (primeraFila) {
            primeraFila.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });

            primeraFila.classList.add('fila-reciente');

            setTimeout(() => {
                primeraFila.classList.remove('fila-reciente');
            }, 3000);
        }
    }, 350);

    guardarDatosLocales();
}

// ==================== TABLA ====================

function actualizarTabla() {
    if (AppState.dataTable) {
        AppState.dataTable.destroy();
    }

    const tbody = document.querySelector('#productosTable tbody');
    tbody.innerHTML = '';

    AppState.listaCanjes.forEach((canje, index) => {
        const estado = canje.ESTADO || '';
        const badgeClass = {
            'TIENE POLÍTICA': 'badge-tiene',
            'NO TIENE POLÍTICA': 'badge-no-tiene',
            'POLÍTICA EXCEPCIONAL': 'badge-excepcional'
        }[estado] || '';

        const tr = document.createElement('tr');
        tr.innerHTML = `
                <td>${canje.RESPONSABLE || ''}</td>
                <td>${canje['COD POSU'] || ''}</td>
                <td>${canje['DESCRIPCION'] || ''}</td>
                <td>${canje['LABORATORIO'] || ''}</td>
                <td><span class="badge-policy ${badgeClass}">${estado}</span></td>
                <td>${canje['F-V'] || ''}</td>
                <td>${canje.E || ''}</td>
                <td>${canje.F || ''}</td>
                <td>${canje.URGENTE || ''}</td>
                <td class="table-actions">
                    <button class="btn btn-sm btn-outline-primary btn-editar" data-index="${index}" title="Editar">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger btn-eliminar" data-index="${index}" title="Eliminar">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            `;
        tbody.appendChild(tr);
    });

    AppState.dataTable = new DataTable('#productosTable', {
        language: { url: 'https://cdn.datatables.net/plug-ins/1.13.7/i18n/es-ES.json' },
        responsive: true,
        order: []
    });

    document.querySelectorAll('.btn-editar').forEach(btn => {
        btn.addEventListener('click', () => editarFila(parseInt(btn.dataset.index)));
    });
    document.querySelectorAll('.btn-eliminar').forEach(btn => {
        btn.addEventListener('click', () => confirmarEliminar(parseInt(btn.dataset.index)));
    });
}

function editarFila(index) {
    const canje = AppState.listaCanjes[index];
    AppState.indexSeleccionado = index;

    document.getElementById('inputCodigo').value = canje['COD POSU'];
    buscarProducto();

    document.getElementById('inputResponsable').value = canje.RESPONSABLE || '';
    document.getElementById('inputFecha').value = canje['F-V'] || '';
    document.getElementById('inputEntero').value = canje.E || '0';
    document.getElementById('inputFraccion').value = canje.F || '0';

    document.querySelector('.form-container').scrollIntoView({ behavior: 'smooth' });
}

function confirmarEliminar(index) {
    const canje = AppState.listaCanjes[index];
    document.getElementById('deleteItemCode').textContent = canje['COD POSU'];
    document.getElementById('deleteItemDesc').textContent = canje['DESCRIPCION'];
    AppState.indexSeleccionado = index;
    deleteModal.show();
}

function eliminarFila() {
    if (AppState.indexSeleccionado < 0) return;

    AppState.listaCanjes.splice(AppState.indexSeleccionado, 1);
    AppState.indexSeleccionado = -1;
    AppState.itemCounter--;

    document.getElementById('itemCounter').textContent = `🧮 Ítems: ${AppState.itemCounter}`;
    actualizarTabla();
    deleteModal.hide();
    guardarDatosLocales();
    mostrarAlerta('Producto eliminado correctamente', 'success');
}

function eliminarTodo() {
    if (AppState.listaCanjes.length === 0) {
        mostrarAlerta('La tabla ya está vacía.', 'info');
        return;
    }

    Swal.fire({
        title: '¿Eliminar todos los productos?',
        text: 'Esta acción eliminará todos los productos agregados.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, eliminar todo',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#009739'
    }).then((result) => {
        if (result.isConfirmed) {
            AppState.listaCanjes = [];
            AppState.itemCounter = 0;
            guardarDatosLocales();
            document.getElementById('itemCounter').textContent = `🧮 Ítems: 0`;
            actualizarTabla();

            Swal.fire({
                icon: 'success',
                title: 'Eliminado',
                text: 'Todos los productos han sido eliminados.',
                confirmButtonColor: '#009739'
            });
        }
    });
}

// ==================== FILTROS ====================

function aplicarFiltros() {
    if (!AppState.dataTable) return;

    const filtroEstado = document.getElementById('filtroEstado').value;

    AppState.dataTable
        .column(1).search(limpiarTexto(document.getElementById('filtroCodigoPosu').value))
        .column(3).search(limpiarTexto(document.getElementById('filtroLaboratorio').value))
        .column(4).search(filtroEstado ? '^' + filtroEstado + '$' : '', true, false)
        .column(5).search(document.getElementById('filtroFecha').value)
        .column(8).search(document.getElementById('filtroUrgente').value)
        .draw();
}

function limpiarFiltros() {
    if (!AppState.dataTable) return;

    document.getElementById('filtroCodigoPosu').value = '';
    document.getElementById('filtroEstado').value = '';
    document.getElementById('filtroLaboratorio').value = '';
    document.getElementById('filtroFecha').value = '';
    document.getElementById('filtroUrgente').value = '';

    AppState.dataTable.columns().search('').draw();
}
// ==================== EXPORTACIÓN PDF ====================

function parseFechaUrgente(fecha) {
    if (!fecha || typeof fecha !== 'string') return 999999;
    const partes = fecha.trim().split('/');
    if (partes.length === 2) {
        const mes = parseInt(partes[0], 10);
        const anio = parseInt(partes[1], 10);
        if (!isNaN(mes) && !isNaN(anio)) {
            return anio * 100 + mes;
        }
    }
    return 999999;
}

function generarPDF(data, titulo, ordenarAZ = true) {
    if (!data || data.length === 0) {
        mostrarAlerta('No hay datos para generar el reporte PDF.', 'warning');
        return;
    }

    let dataProcesada = [...data];

    if (ordenarAZ) {
        dataProcesada.sort((a, b) => {
            const urgA = parseFechaUrgente(a['URGENTE']);
            const urgB = parseFechaUrgente(b['URGENTE']);
            if (urgA !== urgB) {
                return urgA - urgB;
            }
            const labA = (a['LABORATORIO'] || '').toString().toUpperCase();
            const labB = (b['LABORATORIO'] || '').toString().toUpperCase();
            return labA.localeCompare(labB, 'es');
        });
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');

    const fechaHoy = new Date().toISOString().slice(0, 10);
    const pageWidth = doc.internal.pageSize.getWidth();

    // ==================== ENCABEZADO ====================

    doc.setTextColor(0, 0, 0);

    doc.setFontSize(14);
    doc.setFont(undefined, 'bold');

    doc.text(
        'GESTOR DE CANJES - REPORTE',
        pageWidth / 2,
        12,
        { align: 'center' }
    );

    doc.setFontSize(9);
    doc.setFont(undefined, 'normal');

    doc.text(
        `TIPO: ${titulo}`,
        pageWidth / 2,
        18,
        { align: 'center' }
    );

    const nombrePol = AppState.archivoActual ? AppState.archivoActual : 'Sin_Archivo';
    doc.text(
        `UTILIZAS EL ARCHIVO: ${nombrePol}`,
        pageWidth / 2,
        22,
        { align: 'center' }
    );

    doc.text(
        `FECHA: ${new Date().toLocaleString()}`,
        pageWidth / 2,
        26,
        { align: 'center' }
    );

    doc.text(
        `PRODUCTOS ENCONTRADOS: ${dataProcesada.length}`,
        pageWidth / 2,
        30,
        { align: 'center' }
    );

    // ==================== COLUMNAS ====================

    const columns = [
        { header: 'RESP.', dataKey: 'RESPONSABLE' },
        { header: 'COD_POSU', dataKey: 'COD POSU' },
        { header: 'DESCRIPCION', dataKey: 'DESCRIPCION' },
        { header: 'LABORATORIO', dataKey: 'LABORATORIO' },
        { header: 'ESTADO', dataKey: 'ESTADO' },
        { header: 'F-V', dataKey: 'F-V' },
        { header: 'E', dataKey: 'E' },
        { header: 'F', dataKey: 'F' },
        { header: 'URGENTE', dataKey: 'URGENTE' }
    ];

    // ==================== COLUMNAS COMPACTAS ====================

    const columnStyles = {
        0: { cellWidth: 18, halign: 'center' },
        1: { cellWidth: 18, halign: 'center' },
        2: { cellWidth: 50, halign: 'left' },
        3: { cellWidth: 30, halign: 'left' },
        4: { cellWidth: 28, halign: 'center' },
        5: { cellWidth: 14, halign: 'center' },
        6: { cellWidth: 8, halign: 'center' },
        7: { cellWidth: 8, halign: 'center' },
        8: { cellWidth: 18, halign: 'center' }
    };

    const totalWidth =
        18 + 18 + 50 + 30 + 28 + 14 + 8 + 8 + 18;

    const marginLeft = (pageWidth - totalWidth) / 2;

    // ==================== TABLA ====================

    doc.autoTable({
        startY: 34,
        columns: columns,
        body: dataProcesada,
        theme: 'grid',

        headStyles: {
            fillColor: [255, 255, 255],
            textColor: [0, 0, 0],
            fontStyle: 'bold',
            fontSize: 7.5,
            cellPadding: 1,
            halign: 'center',
            valign: 'middle',
            lineWidth: 0.6,
            lineColor: [0, 0, 0]
        },

        styles: {
            fontSize: 6.8,
            cellPadding: 0.8,
            textColor: [0, 0, 0],
            fillColor: [255, 255, 255],
            lineWidth: 0.3,
            lineColor: [0, 0, 0],
            valign: 'middle',
            overflow: 'linebreak'
        },

        bodyStyles: {
            lineWidth: 0.25
        },

        alternateRowStyles: {
            fillColor: [255, 255, 255]
        },

        columnStyles: columnStyles,

        didDrawCell: function (data) {
            if (data.section === 'head') {
                data.doc.setLineWidth(0.8);
                data.doc.setDrawColor(0, 0, 0);

                data.doc.line(
                    data.cell.x,
                    data.cell.y,
                    data.cell.x + data.cell.width,
                    data.cell.y
                );
            }
        },

        margin: {
            top: 5,
            left: marginLeft,
            bottom: 5
        },

        tableWidth: totalWidth
    });

    // ==================== EXPORTAR ====================

    // Obtenemos el nombre del archivo cargado desde el estado global (quitándole el .xlsx)
    let nombreArchivo = 'Sin_Archivo';
    if (AppState.archivoActual) {
        nombreArchivo = AppState.archivoActual.split('.').slice(0, -1).join('_').replace(/ /g, '_');
    }

    // Guardamos el PDF incluyendo el nombre del archivo en la estructura
    doc.save(
        `Reporte_${titulo.replace(/ /g, '_')}_${nombreArchivo}_${fechaHoy}.pdf`
    );

    exportModal.hide();
}

// ==================== FUNCIONES DE EXPORTACIÓN ====================

function exportarPdfExcepcional() {
    const datos = AppState.listaCanjes.filter(item =>
        limpiarTexto(item.ESTADO) === 'POLÍTICA EXCEPCIONAL'
    );
    generarPDF(datos, 'Política Excepcional', true);
}

function exportarPdfNoTiene() {
    const datos = AppState.listaCanjes.filter(item =>
        limpiarTexto(item.ESTADO) === 'NO TIENE POLÍTICA'
    );
    generarPDF(datos, 'No Tiene Política', true);
}

function exportarPdfCanje() {
    const input = document.getElementById('inputExportUrgente').value.trim();

    if (!/^\d{2}\/\d{4}$/.test(input)) {
        mostrarAlerta('Ingrese una fecha válida (MM/AAAA). Use el formato indicado.', 'warning');
        return;
    }

    const datos = AppState.listaCanjes.filter(item =>
        (item.URGENTE || '').trim() === input
    );

    if (datos.length === 0) {
        mostrarAlerta(`No se encontraron ítems con fecha URGENTE ${input}.`, 'info');
        return;
    }

    generarPDF(datos, `Canjes Urgentes ${input}`, true);
}

function exportarPdfTodo() {
    generarPDF(AppState.listaCanjes, 'Listado Completo', true);
}

// ==================== EXPORTACIÓN EXCEL ====================

function exportarExcel() {
    let bodyData = AppState.listaCanjes;

    if (bodyData.length === 0) {
        mostrarAlerta('No hay datos para exportar.', 'warning');
        return;
    }

    bodyData.sort((a, b) => {
        const urgA = parseFechaUrgente(a['URGENTE']);
        const urgB = parseFechaUrgente(b['URGENTE']);
        if (urgA !== urgB) {
            return urgA - urgB;
        }
        const labA = (a['LABORATORIO'] || '').toString().toUpperCase();
        const labB = (b['LABORATORIO'] || '').toString().toUpperCase();
        return labA.localeCompare(labB, 'es');
    });

    const fechaHoy = new Date().toISOString().slice(0, 10);
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(bodyData);

    XLSX.utils.book_append_sheet(wb, ws, "Canjes");
    XLSX.writeFile(wb, `Reporte_Canjes_${fechaHoy}.xlsx`);
}

// ==================== ARCHIVOS ====================

function procesarArchivoExcel(file) {
    if (!file) {
        mostrarAlerta('No se seleccionó ningún archivo', 'warning');
        return;
    }

    Swal.fire({
        title: 'Cargando archivo...',
        text: 'Esto puede tardar unos segundos',
        allowOutsideClick: false,
        didOpen: () => Swal.showLoading()
    });

    const reader = new FileReader();
    reader.onload = function (e) {
        setTimeout(() => {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });

                const posiblesNombres = ['DETALLE_POR_SKU', 'DETALLE POR SKU', 'Hoja1', 'Sheet1'];
                let hojaValida = posiblesNombres.find(n => workbook.SheetNames.includes(n)) || workbook.SheetNames[0];

                if (!hojaValida) {
                    throw new Error('No se encontró ninguna hoja válida en el archivo');
                }

                const worksheet = workbook.Sheets[hojaValida];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (!jsonData || jsonData.length === 0) {
                    throw new Error(`No se encontraron datos en la hoja "${hojaValida}"`);
                }

                AppState.productos = jsonData.map(row => ({
                    'EAN': limpiarTexto(row['EAN']),
                    'COD SAP': limpiarTexto(row['COD SAP']),
                    'COD POSU': limpiarTexto(row['COD POSU']),
                    'DESCRIPCION': row['DESCRIPCION'],
                    'COD PROV': limpiarTexto(row['COD PROV']),
                    'PROVEEDOR': row['PROVEEDOR'],
                    'COD LAB': limpiarTexto(row['COD LAB']),
                    'LABORATORIO': row['LABORATORIO'],
                    'POLITICA': row['POLITICA'],
                    'CAMBIO_POLITICA': row['CAMBIO_POLITICA'],
                    'Condición para Canje Entero': row['Condición para Canje Entero'],
                    'LIF Condicional': row['LIF Condicional'],
                    'Condición para LIF': row['Condición para LIF'],
                    'Observación': row['Observación']
                }));

                AppState.archivoActual = file.name;

                const btnUltimoArchivo = document.getElementById('btnUltimoArchivo');
                btnUltimoArchivo.textContent = `Usar último archivo: ${AppState.archivoActual}`;
                btnUltimoArchivo.classList.remove('d-none');
                document.getElementById('labelArchivo').textContent = `Archivo cargado: ${file.name}`;
                localStorage.setItem('ultimoArchivo', file.name);

                fileModal.hide();
                document.getElementById('welcomeScreen').classList.add('d-none');
                document.getElementById('mainApp').classList.remove('d-none');
                Swal.close();
                mostrarAlerta('Archivo cargado correctamente', 'success');

            } catch (error) {
                console.error('Error procesando archivo:', error);
                Swal.close();
                mostrarAlerta(`Error al procesar el archivo: ${error.message}`, 'error');
            }
        }, 100);
    };
    reader.readAsArrayBuffer(file);
}

// ==================== INICIALIZACIÓN ====================

document.addEventListener('DOMContentLoaded', function () {

    // Carga Automática de la BD de Lotes desde el archivo JS (bypass CORS offline local)
    if (window.datosLoteGlobal) {
        AppState.datosLote = window.datosLoteGlobal;
    } else {
        console.warn("Base de datos de lotes no encontrada automáticamente. Comprueba el archivo .js");
    }

    fileModal = new bootstrap.Modal(document.getElementById('fileModal'), {
        backdrop: 'static',
        keyboard: false
    });

    deleteModal = new bootstrap.Modal(document.getElementById('deleteModal'));

    exportModal = new bootstrap.Modal(document.getElementById('exportModal'));

    document.getElementById('fileModal').addEventListener('hide.bs.modal', function (e) {
        const fileInput = document.getElementById('fileInput');
        if (!fileInput.files.length) {
            e.preventDefault();
            Swal.fire({
                icon: 'warning',
                title: 'Archivo requerido',
                text: 'Debes seleccionar tu archivo Excel para continuar.',
                confirmButtonColor: '#009739'
            });
        }
    });

    document.getElementById('btnToggleLote')?.addEventListener('click', togglePanelLote);

    document.addEventListener('keydown', function (e) { if (e.key === 'F2') { e.preventDefault(); togglePanelLote(); } });

    // === NAVEGACIÓN ===

    document.getElementById('btnNuevoArchivo').addEventListener('click', function () {
        fileModal.show();
    });

    document.getElementById('btnUltimoArchivo').addEventListener('click', function () {
        cargarDatosLocales();
        actualizarTabla();
        document.getElementById('welcomeScreen').classList.add('d-none');
        document.getElementById('mainApp').classList.remove('d-none');
    });

    document.getElementById('btnVolverInicio').addEventListener('click', function () {
        Swal.fire({
            title: '¿Deseas volver al inicio?',
            text: 'Se perderán los cambios no guardados',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Sí, volver',
            cancelButtonText: 'Cancelar',
            confirmButtonColor: '#009739',
            cancelButtonColor: '#d33'
        }).then((result) => {
            if (result.isConfirmed) {
                document.getElementById('welcomeScreen').classList.remove('d-none');
                document.getElementById('mainApp').classList.add('d-none');
                limpiarFormulario();
                actualizarTabla();
            }
        });
    });

    document.getElementById('btnCambiarArchivo').addEventListener('click', function () {
        fileModal.show();
    });

    // === BÚSQUEDA Y GUARDADO ===

    document.getElementById('btnBuscar').addEventListener('click', buscarProducto);

    document.getElementById('inputCodigo').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            buscarProducto();
            e.preventDefault();
        }
    });

    document.getElementById('btnGuardar').addEventListener('click', guardarProducto);

    document.getElementById('btnCopiarFicha').addEventListener('click', function () {
        const descripcion = document.getElementById('labelDescripcion').value.trim();
        const laboratorio = document.getElementById('labelLab').value.trim();

        // ✅ VALIDACIÓN REAL
        if (!descripcion || !laboratorio || descripcion === 'Esperando búsqueda...') {
            Swal.fire({
                icon: 'warning',
                title: '⚠️ Sin producto seleccionado',
                text: 'Primero busca un producto válido para analizar.',
                confirmButtonColor: '#009739'
            });
            return; // 🚫 NO sigue
        }


        Swal.fire({
            title: '🧠 ¿Quieres profundizar la información?',
            html: `
        <div style="font-size:14px; text-align:left; line-height:1.5;">
            Se abrirá ChatGPT con el prompt listo.<br><br>

            <b>👉 Pasos:</b>
            <ol style="margin-top:5px; padding-left:18px;">
                <li>Haz clic en <b>“Sí, continuar”</b></li>
                <li>Presiona <b>Ctrl + V</b></li>
                <li>O clic izquierdo → <b>Pegar</b> en ChatGPT</li>
            </ol>
        </div>
    `,

            icon: 'question',
            showCancelButton: true,
            confirmButtonText: '✅ Sí, continuar',
            cancelButtonText: '❌ Cancelar',
            confirmButtonColor: '#009739',
            cancelButtonColor: '#d33'
        }).then((result) => {

            if (result.isConfirmed) {
                abrirChatGPTConPrompt();
            }

        });

    });
    function abrirChatGPTConPrompt() {

        const descripcion = document.getElementById('labelDescripcion').value.trim();
        const laboratorio = document.getElementById('labelLab').value.trim();

        if (!descripcion || !laboratorio) {
            Swal.fire({
                icon: 'warning',
                title: '⚠️ Falta información',
                text: 'Primero busca un producto'
            });
            return;
        }

        const prompt = `
Eres un PROFESIONAL FARMACÉUTICO DEL PERÚ, con formación técnica y científica, y experiencia en farmacia comunitaria y hospitalaria.

Tu función es EDUCAR y ORIENTAR sobre productos farmacéuticos en general, incluyendo:

• Medicamentos (éticos y OTC)
• Productos dermatológicos
• Higiene personal
• Fórmulas infantiles y nutricionales
• Pañales y productos para bebés
• Suplementos y vitaminas
• Dispositivos médicos simples

Te basas en:
• Vademécums
• Fichas técnicas oficiales
• Práctica farmacéutica en Perú y Latinoamérica

⚠️ RESTRICCIONES IMPORTANTES:
- NO realizas diagnóstico
- NO prescribes tratamientos personalizados
- NO reemplazas la evaluación médica
- NO fomentas la automedicación irresponsable

Tu enfoque es SIEMPRE el uso seguro, racional e informado.

═══════════════════════════════════════════════════════════════
🔍 REGLA CLAVE (CRÍTICA)
═══════════════════════════════════════════════════════════════

Antes de responder:
1. IDENTIFICA el tipo de producto:

- Si es medicamento → usa FORMATO FARMACOLÓGICO COMPLETO
- Si NO es medicamento → usa FORMATO ADAPTADO

NO mezclar formatos.

═══════════════════════════════════════════════════════════════
💊 FORMATO 1: MEDICAMENTOS
═══════════════════════════════════════════════════════════════

MEDICAMENTO:
${descripcion}

LABORATORIO:
${laboratorio}

GRUPO FARMACOLÓGICO:

¿PARA QUÉ SIRVE?

DOSIFICACIÓN ORIENTATIVA (USO CIENTÍFICO):

- Adultos:
  • Dosis habitual
  • Frecuencia
  • Dosis máxima diaria
  • Tiempo máximo de uso

- Adulto mayor:
  • Ajuste de dosis
  • Riesgos

- Adolescentes:
  • Uso permitido o no
  • Ajuste general

- Niños:
  • Dosis por peso (mg/kg)
  • Frecuencia
  • Dosis máxima

- Lactantes:
  • Indicar claramente si está permitido

⚠️ ADVERTENCIA DE DOSIS:
- Riesgos por sobredosis
- No acortar intervalos
- No duplicar dosis
- No combinar con mismo principio activo

REACCIONES ADVERSAS MÁS FRECUENTES:

CONTRAINDICACIONES:

USO EN GRUPOS ESPECIALES:
- Gestantes
- Lactancia
- Enfermedad renal
- Enfermedad hepática

GRUPOS DE RIESGO:
- Asmáticos
- Alérgicos a AINEs (si aplica)
- Otros

INTERACCIONES:
- Alimentos
- Alcohol
- Suplementos

RECOMENDACIONES FARMACÉUTICAS:
- Consejos prácticos
- Señales de alerta
- Prevención de errores

📢 AVISO:
"Esta información es educativa y no reemplaza la evaluación de un profesional de salud."

═══════════════════════════════════════════════════════════════
🧴 FORMATO 2: PRODUCTOS NO FARMACOLÓGICOS
═══════════════════════════════════════════════════════════════

PRODUCTO:
${descripcion}

LABORATORIO:
${laboratorio}

TIPO DE PRODUCTO:

¿QUÉ CONTIENE?
• Componentes principales
• Tecnología relevante

¿PARA QUÉ SIRVE?

MODO DE USO:
• Cantidad
• Frecuencia
• Aplicación correcta

ESPECIFICACIONES SEGÚN TIPO:

👶 PAÑALES:
• Peso
• Etapa
• Recomendación de cambio

🧴 DERMOCOSMÉTICOS:
• Tipo de piel
• Frecuencia

🍼 FÓRMULAS:
• Edad
• Cantidad
• Advertencias

⚠️ ADVERTENCIAS:

REACCIONES POSIBLES:

CONTRAINDICACIONES:

USO EN GRUPOS ESPECIALES:

INTERACCIONES (si aplica):

RECOMENDACIONES FARMACÉUTICAS:

📢 AVISO:
"Esta información es educativa y no reemplaza la evaluación de un profesional de salud."

═══════════════════════════════════════════════════════════════
🎯 OBJETIVO FINAL:
Brindar información CLARA, SEGURA, PRÁCTICA y basada en evidencia.
`;

        // Copiar automáticamente
        navigator.clipboard.writeText(prompt);

        // Abrir ChatGPT
        window.open('https://chat.openai.com/', '_blank');

        Swal.fire({
            icon: 'success',
            title: '✅ Prompt copiado',
            text: 'Ahora solo pega (Ctrl + V) en ChatGPT',
            timer: 2500,
            showConfirmButton: false
        });
    }

    // === COPIAR FICHA DEL MEDICAMENTO ===

    async function copiarFichaMedicamento() {
        const descripcion = document.getElementById('labelDescripcion').value.trim();
        const laboratorio = document.getElementById('labelLab').value.trim();

        if (!descripcion || !laboratorio) {
            Swal.fire({
                icon: 'warning',
                title: '⚠️ Faltan datos',
                text: 'Primero busca un producto para obtener la descripción y laboratorio.',
                confirmButtonColor: '#009739'
            });
            return;
        }


        try {
            await navigator.clipboard.writeText(promptFarmaceutico);

            Swal.fire({
                icon: 'success',
                title: '✅ ¡Copiado al portapapeles!',
                html: `
                        <div style="text-align: left; font-size: 14px;">
                            <p><strong>Producto:</strong> ${descripcion}</p>
                            <p><strong>Laboratorio:</strong> ${laboratorio}</p>
                            <hr>
                            <p style="color: #666;">Ahora puedes pegarlo (Ctrl+V) en ChatGPT u otra IA para obtener información farmacéutica completa (medicamentos, dermocosméticos, pañales, fórmulas, etc.).</p>
                        </div>
                    `,
                confirmButtonColor: '#009739',
                confirmButtonText: 'Entendido'
            });
        } catch (error) {
            console.error('Error al copiar:', error);
            mostrarAlerta('No se pudo copiar al portapapeles. Intenta de nuevo.', 'error');
        }
    }

    // === CARGA DE ARCHIVOS ===

    document.getElementById('btnCargarArchivo').addEventListener('click', function () {
        const fileInput = document.getElementById('fileInput');
        if (fileInput.files.length > 0) {
            procesarArchivoExcel(fileInput.files[0]);
        } else {
            mostrarAlerta('Selecciona un archivo', 'warning');
        }
    });

    document.getElementById('fileInput').addEventListener('change', function (e) {
        const file = e.target.files[0];
        if (file) {
            const allowedExtensions = ['xlsx', 'xls', 'xlsb', 'ods'];
            const extension = file.name.split('.').pop().toLowerCase();

            if (!allowedExtensions.includes(extension)) {
                mostrarAlerta('Solo se permiten archivos Excel (.xlsx, .xls, .ods)', 'error');
                e.target.value = '';
                return;
            }

            if (file.size > 5 * 1024 * 1024) {
                mostrarAlerta('El archivo es demasiado grande (máximo 5MB)', 'error');
                e.target.value = '';
            }
        }
    });

    // === ELIMINACIÓN ===

    document.getElementById('btnEliminarTodo').addEventListener('click', eliminarTodo);
    document.getElementById('btnConfirmDelete').addEventListener('click', eliminarFila);

    // === FILTROS ===

    document.getElementById('btnAplicarFiltro').addEventListener('click', aplicarFiltros);
    document.getElementById('btnLimpiarFiltros').addEventListener('click', limpiarFiltros);

    // === EXPORTACIÓN (Botones Principales) ===

    document.getElementById('btnExportarPdf').addEventListener('click', () => exportModal.show());
    document.getElementById('btnExportarPdf2').addEventListener('click', () => exportModal.show());

    document.getElementById('btnExportarExcel').addEventListener('click', exportarExcel);
    document.getElementById('btnExportarExcel2').addEventListener('click', exportarExcel);

    // === EXPORTACIÓN (Botones Dentro del Modal) ===

    document.getElementById('optPdfExcepcional').addEventListener('click', exportarPdfExcepcional);
    document.getElementById('optPdfNoTiene').addEventListener('click', exportarPdfNoTiene);
    document.getElementById('optPdfCanje').addEventListener('click', exportarPdfCanje);
    document.getElementById('optPdfTodo').addEventListener('click', exportarPdfTodo);

    // === FORMATO DE FECHAS (Inputs principales) ===

    ['inputFecha', 'filtroFecha', 'filtroUrgente'].forEach(function (id) {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', function () {
                el.value = el.value.replace(/\D/g, '').slice(0, 4);
            });
            el.addEventListener('blur', function () {
                formatoMmAaaa(el);
            });
        }
    });

    // === FORMATO INPUT EXPORTAR ===

    const inputExportUrgente = document.getElementById('inputExportUrgente');

    inputExportUrgente.addEventListener('input', function (e) {
        let value = this.value.replace(/\D/g, '');

        if (value.length >= 2) {
            let mes = parseInt(value.substring(0, 2));
            if (mes === 0 || mes > 12) {
                this.value = '';
                return;
            }
        }

        if (value.length === 4) {
            let mes = value.substring(0, 2);
            let anio = value.substring(2, 4);
            this.value = `${mes}/20${anio}`;
        } else {
            this.value = value;
        }
    });

    inputExportUrgente.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('optPdfCanje').click();
        }
    });

    // === NAVEGACIÓN CON ENTER (Formulario Principal) ===

    document.getElementById('inputFecha').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('inputResponsable').focus();
        }
    });

    document.getElementById('inputResponsable').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('inputEntero').focus();
        }
    });

    document.getElementById('inputEntero').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('inputFraccion').focus();
        }
    });

    document.getElementById('inputFraccion').addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('btnGuardar').click();
        }
    });

    // === SELECCIÓN AUTOMÁTICA ===

    ['inputCodigo', 'inputResponsable', 'inputEntero', 'inputFraccion'].forEach(function (id) {
        const campo = document.getElementById(id);
        if (campo) {
            campo.addEventListener('focus', function () {
                if (this.value && this.value.trim().length > 0) {
                    this.select();
                }
            });
        }
    });


    // === ATAJO F1 PARA ESCÁNER ===

    document.addEventListener('keydown', function (e) {
        if (e.key === 'F1') {
            e.preventDefault();

            const inputCodigo = document.getElementById('inputCodigo');

            inputCodigo.value = '';

            inputCodigo.scrollIntoView({
                behavior: 'smooth',
                block: 'center'
            });

            setTimeout(() => {
                inputCodigo.focus();
                inputCodigo.select();
            }, 350);

            mostrarAlerta('Listo para escanear producto', 'info');
        }
    });


    // === PREVENCIÓN DE CIERRE ===

    window.addEventListener('beforeunload', function (e) {
        if (AppState.listaCanjes.length > 0 || AppState.archivoActual) {
            const mensaje = "¿Estás seguro de salir o recargar? Se perderán los datos no guardados.";
            e.preventDefault();
            e.returnValue = mensaje;
            return mensaje;
        }
    });

    // === INICIALIZACIÓN FINAL ===

    localStorage.clear();
    localStorage.removeItem("archivoPolitica");
    verificarUltimoArchivo();
    actualizarTabla();
});
