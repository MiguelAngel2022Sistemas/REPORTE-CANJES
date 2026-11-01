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
            const textBoleta = document.getElementById('textBoletaArchivo');
            if (textBoleta) textBoleta.textContent = ultimoArchivo;
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
        const textBoleta = document.getElementById('textBoletaArchivo');
        if (textBoleta) textBoleta.textContent = ultimoArchivo;
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
        Swal.fire({
            icon: 'warning',
            title: 'Sin información de lote',
            text: 'Producto probablemente nuevo. Consultar al DT del local o verificar bien la fecha de vencimiento.',
            confirmButtonColor: '#ffc107'
        });
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
            top: 30,
            left: marginLeft,
            bottom: 50
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
                const textBoleta = document.getElementById('textBoletaArchivo');
                if (textBoleta) textBoleta.textContent = file.name;
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

// ==================== BOLETA MANUAL (PUNTO DE VENTA) ====================

const BoletaManualState = {
    items: [],
    diferenciaEditadaManual: false,
    modalInstance: null
};

function sanitizarNumeroDecimal(val) {
    if (!val) return '';
    let limpio = val.toString().replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const partes = limpio.split('.');
    if (partes.length > 2) {
        limpio = partes[0] + '.' + partes.slice(1).join('');
    }
    return limpio;
}

function abrirModalBoletaManual() {
    const textArchivo = document.getElementById('textBoletaArchivo');
    if (textArchivo) {
        textArchivo.textContent = AppState.archivoActual ? AppState.archivoActual : 'Sin Excel cargado';
    }

    if (!BoletaManualState.modalInstance) {
        const modalEl = document.getElementById('modalBoletaManual');
        if (modalEl) {
            BoletaManualState.modalInstance = new bootstrap.Modal(modalEl);
        }
    }

    if (BoletaManualState.modalInstance) {
        BoletaManualState.modalInstance.show();
        setTimeout(() => {
            const inputCodigo = document.getElementById('boletaInputCodigo');
            if (inputCodigo) {
                inputCodigo.focus();
                inputCodigo.select();
            }
        }, 400);
    }
}

function buscarProductoBoleta() {
    const inputCodigo = document.getElementById('boletaInputCodigo');
    const codigo = limpiarTexto(inputCodigo.value);

    if (!codigo) {
        mostrarAlerta('Ingresa un código POSU o EAN para buscar.', 'warning');
        inputCodigo.focus();
        return;
    }

    if (!AppState.productos || AppState.productos.length === 0) {
        Swal.fire({
            title: 'Archivo no cargado',
            text: 'Aún no has cargado el Excel de políticas. ¿Deseas cargarlo ahora o ingresar los datos manualmente?',
            icon: 'info',
            showCancelButton: true,
            confirmButtonText: '<i class="fas fa-file-excel me-1"></i> Cargar Excel',
            cancelButtonText: 'Escribir manual',
            confirmButtonColor: '#0d6efd',
            cancelButtonColor: '#6c757d'
        }).then((res) => {
            if (res.isConfirmed) {
                fileModal.show();
            } else {
                document.getElementById('boletaDescripcion').focus();
            }
        });
        return;
    }

    const producto = AppState.productos.find(p =>
        limpiarTexto(p['COD POSU']) === codigo || limpiarTexto(p['EAN']) === codigo
    );

    if (!producto) {
        mostrarAlerta(`No se encontró el producto con código: ${codigo}`, 'error');
        document.getElementById('boletaDescripcion').focus();
        return;
    }

    document.getElementById('boletaDescripcion').value = producto['DESCRIPCION'] || '';
    document.getElementById('boletaLab').value = producto['LABORATORIO'] || '';

    mostrarAlerta(`Producto: ${producto['DESCRIPCION']}`, 'success');

    const inputCosto = document.getElementById('boletaCosto');
    inputCosto.focus();
    inputCosto.select();
}

function limpiarCamposBoleta() {
    document.getElementById('boletaInputCodigo').value = '';
    document.getElementById('boletaDescripcion').value = '';
    document.getElementById('boletaLab').value = '';
    document.getElementById('boletaPresentacion').value = 'CAJA';
    document.getElementById('boletaCosto').value = '';
    document.getElementById('boletaInputCodigo').focus();
}

function actualizarTotalesBoleta() {
    const sumaCostos = BoletaManualState.items.reduce((acc, item) => acc + (parseFloat(item.costo) || 0), 0);

    const labelSuma = document.getElementById('boletaSumaCostos');
    if (labelSuma) {
        labelSuma.textContent = `S/ ${sumaCostos.toFixed(2)}`;
    }

    const badgeTotal = document.getElementById('boletaTotalItems');
    if (badgeTotal) {
        badgeTotal.textContent = BoletaManualState.items.length.toString();
    }

    const inputCliente = document.getElementById('boletaMontoCliente');
    const montoRaw = (inputCliente ? inputCliente.value : '0').toString().replace(/,/g, '.');
    const montoCliente = parseFloat(montoRaw) || 0;

    // Calcular diferencia en soles: Monto Cliente - Suma de Costos (Punto de Venta)
    const diferencia = montoCliente - sumaCostos;

    const inputDiferencia = document.getElementById('boletaDiferenciaSoles');
    const labelEtiqueta = document.getElementById('boletaDiferenciaEtiqueta');

    if (inputDiferencia && !BoletaManualState.diferenciaEditadaManual) {
        inputDiferencia.value = diferencia.toFixed(2);
    }

    if (labelEtiqueta) {
        if (diferencia > 0) {
            labelEtiqueta.innerHTML = `<span class="text-success"><i class="fas fa-arrow-down me-1"></i> Vuelto a favor del cliente: S/ ${diferencia.toFixed(2)}</span>`;
        } else if (diferencia === 0) {
            labelEtiqueta.innerHTML = `<span class="text-secondary"><i class="fas fa-check me-1"></i> Pago exacto / Sin diferencia</span>`;
        } else {
            labelEtiqueta.innerHTML = `<span class="text-danger"><i class="fas fa-arrow-up me-1"></i> Saldo pendiente por cobrar: S/ ${Math.abs(diferencia).toFixed(2)}</span>`;
        }
    }
}

function renderTablaBoleta() {
    const tbody = document.getElementById('boletaTableBody');
    if (!tbody) return;

    if (BoletaManualState.items.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-muted py-4">
                    <i class="fas fa-info-circle me-1"></i> No se han agregado productos a la boleta aún.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = BoletaManualState.items.map((item, index) => {
        const badgeClass = item.presentacion === 'CAJA' ? 'badge-presentacion-caja' : 'badge-presentacion-blister';
        const icono = item.presentacion === 'CAJA' ? 'fa-box' : 'fa-tablets';
        return `
            <tr>
                <td class="fw-bold">${index + 1}</td>
                <td class="text-start fw-bold text-dark">${item.descripcion}</td>
                <td class="text-start">${item.laboratorio || '-'}</td>
                <td><span class="${badgeClass}"><i class="fas ${icono} me-1"></i>${item.presentacion}</span></td>
                <td class="fw-bold text-end pe-3">S/ ${item.costo.toFixed(2)}</td>
                <td>
                    <button type="button" class="btn btn-sm btn-outline-danger py-0 px-2 btn-eliminar-item-boleta" data-id="${item.id}" title="Eliminar ítem">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            </tr>
        `;
    }).join('');

    tbody.querySelectorAll('.btn-eliminar-item-boleta').forEach(btn => {
        btn.addEventListener('click', function () {
            const id = parseInt(this.dataset.id, 10);
            eliminarItemBoleta(id);
        });
    });
}

function agregarItemBoleta() {
    const descripcion = document.getElementById('boletaDescripcion').value.trim();
    const laboratorio = document.getElementById('boletaLab').value.trim();
    const presentacion = document.getElementById('boletaPresentacion').value;
    const inputCosto = document.getElementById('boletaCosto');
    const costoRaw = (inputCosto ? inputCosto.value : '').trim().replace(/,/g, '.');
    const costoVal = parseFloat(costoRaw);

    if (!descripcion) {
        mostrarAlerta('Ingresa o busca la descripción del producto.', 'warning');
        document.getElementById('boletaDescripcion').focus();
        return;
    }

    if (isNaN(costoVal) || costoVal < 0) {
        mostrarAlerta('Ingresa un costo numérico válido mayor o igual a 0.', 'warning');
        if (inputCosto) inputCosto.focus();
        return;
    }

    const nuevoItem = {
        id: Date.now() + Math.floor(Math.random() * 1000),
        descripcion: descripcion,
        laboratorio: laboratorio || '-',
        presentacion: presentacion, // 'CAJA' o 'BLÍSTER'
        costo: costoVal
    };

    BoletaManualState.items.push(nuevoItem);
    BoletaManualState.diferenciaEditadaManual = false; // re-evalúa la diferencia automáticamente

    renderTablaBoleta();
    actualizarTotalesBoleta();
    limpiarCamposBoleta();

    mostrarAlerta('Producto agregado a la boleta', 'success');
}

function eliminarItemBoleta(id) {
    BoletaManualState.items = BoletaManualState.items.filter(item => item.id !== id);
    BoletaManualState.diferenciaEditadaManual = false;
    renderTablaBoleta();
    actualizarTotalesBoleta();
    mostrarAlerta('Producto retirado de la boleta', 'info');
}

function vaciarBoleta() {
    if (BoletaManualState.items.length === 0) {
        mostrarAlerta('La boleta ya está vacía.', 'info');
        return;
    }

    Swal.fire({
        title: '¿Vaciar la boleta?',
        text: 'Se eliminarán todos los productos agregados a esta boleta.',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Sí, vaciar',
        cancelButtonText: 'Cancelar',
        confirmButtonColor: '#d33',
        cancelButtonColor: '#6c757d'
    }).then((result) => {
        if (result.isConfirmed) {
            BoletaManualState.items = [];
            BoletaManualState.diferenciaEditadaManual = false;
            document.getElementById('boletaMontoCliente').value = '0.00';
            document.getElementById('boletaDiferenciaSoles').value = '0.00';
            renderTablaBoleta();
            actualizarTotalesBoleta();
            limpiarCamposBoleta();
            mostrarAlerta('Boleta vaciada correctamente', 'success');
        }
    });
}

// ==================== GENERACIÓN DE BOLETA / TICKET ====================

function calcularAlturaTicket80mm(items, archivoNombre) {
    const printableWidth = 72;
    const testDoc = new (window.jspdf.jsPDF)({ unit: 'mm', format: [80, 800] });
    testDoc.setFont('helvetica');

    let y = 6; // margen superior
    y += 4.5; // FARMACIAS PERUANAS
    y += 3.8; // GESTOR DE CANJES TECNICOS
    y += 3.2; // CONTROL OPERATIVO - PUNTO DE VENTA
    y += 3.5; // BOLETA MANUAL / TICKET DE CANJE
    y += 3.0; // separador
    y += 3.5; // TICKET N°
    y += 3.5; // FECHA / HORA
    
    testDoc.setFontSize(7);
    const archLines = testDoc.splitTextToSize(`POLÍTICA: ${archivoNombre || 'Manual'}`, printableWidth);
    y += (archLines.length * 3.2) + 1.5;

    y += 3.0; // separador
    y += 3.5; // Encabezado columnas
    y += 2.5; // línea sólida

    // Items
    items.forEach((item, index) => {
        testDoc.setFontSize(7.5);
        const itemTitulo = `${index + 1}. ${item.descripcion.toUpperCase()}`;
        const descLines = testDoc.splitTextToSize(itemTitulo, printableWidth);
        y += (descLines.length * 3.3);

        testDoc.setFontSize(7);
        const labText = `[${item.presentacion}] ${item.laboratorio || '-'}`;
        const labLines = testDoc.splitTextToSize(labText, 48);
        y += Math.max(labLines.length * 3.0, 3.5) + 1.8;
    });

    y += 2.0; // separador
    y += 3.5; // TOTAL PRODUCTOS
    y += 3.0; // separador
    y += 4.5; // TOTAL COSTOS
    y += 4.0; // MONTO CLIENTE
    y += 2.5; // línea
    y += 4.5; // DIFERENCIA / VUELTO
    y += 3.5; // Nota explicativa vuelto / saldo
    y += 3.5; // separador

    // Firmas
    y += 4.5; // FIRMAS DE CONFORMIDAD
    y += 12.0; // Espacio firma DT
    y += 3.0; // Línea firma DT
    y += 2.8; // Texto firma DT
    y += 11.0; // Espacio firma cliente
    y += 3.0; // Línea firma cliente
    y += 2.8; // DNI
    y += 4.0; // separador

    // Pie
    y += 3.0; // Doc interno
    y += 2.8; // Sistema Gestor
    y += 3.0; // Gracias
    y += 10.0; // Margen para corte de la ticketera NCR

    return Math.max(Math.ceil(y), 130);
}

function imprimirBoletaTicket80mm() {
    if (BoletaManualState.items.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Boleta vacía',
            text: 'Debes agregar al menos un producto a la boleta antes de imprimir el ticket.',
            confirmButtonColor: '#0d6efd'
        });
        return;
    }

    const { jsPDF } = window.jspdf;

    const sumaCostos = BoletaManualState.items.reduce((acc, item) => acc + (parseFloat(item.costo) || 0), 0);
    const montoRaw = (document.getElementById('boletaMontoCliente')?.value || '0').toString().replace(/,/g, '.');
    const montoCliente = parseFloat(montoRaw) || 0;
    const difRaw = (document.getElementById('boletaDiferenciaSoles')?.value || '').toString().replace(/,/g, '.');
    const diferencia = difRaw !== '' ? (parseFloat(difRaw) || 0) : (montoCliente - sumaCostos);

    const ahora = new Date();
    const fechaStr = ahora.toLocaleDateString('es-PE');
    const horaStr = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const correlativo = `BM-${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, '0')}${String(ahora.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 900) + 100)}`;
    const archivoNombre = AppState.archivoActual ? AppState.archivoActual : 'Ingreso Manual / Sin archivo';

    // Medidas solicitadas para ticketera térmica NCR:
    // Ancho papel: 80mm | Ancho útil: 72mm (4mm márgenes) | Alto continuo variable
    const margin = 4;
    const printableWidth = 72;
    const rightMargin = 76;
    const centerX = 40;

    const alturaTotalMm = calcularAlturaTicket80mm(BoletaManualState.items, archivoNombre);

    const doc = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [80, alturaTotalMm]
    });

    function dibujarSeparador(posY, dashed = true) {
        doc.setDrawColor(0, 0, 0);
        doc.setLineWidth(0.25);
        if (dashed) {
            doc.setLineDashPattern([1.5, 1], 0);
        } else {
            doc.setLineDashPattern([], 0);
        }
        doc.line(margin, posY, rightMargin, posY);
        doc.setLineDashPattern([], 0);
    }

    let curY = 6;

    // === ENCABEZADO TÉRMICO NCR ===
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.text('FARMACIAS PERUANAS', centerX, curY, { align: 'center' });
    curY += 4.5;

    doc.setFontSize(8);
    doc.text('GESTOR DE CANJES TECNICOS', centerX, curY, { align: 'center' });
    curY += 3.8;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.text('CONTROL OPERATIVO - PUNTO DE VENTA', centerX, curY, { align: 'center' });
    curY += 3.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.text('BOLETA MANUAL / TICKET DE CANJE', centerX, curY, { align: 'center' });
    curY += 3.0;

    dibujarSeparador(curY, true);
    curY += 3.5;

    // Datos del Ticket
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('TICKET N°:', margin, curY);
    doc.setFont('helvetica', 'normal');
    doc.text(correlativo, margin + 17, curY);
    curY += 3.5;

    doc.setFont('helvetica', 'bold');
    doc.text('FECHA:', margin, curY);
    doc.setFont('helvetica', 'normal');
    doc.text(fechaStr, margin + 11, curY);

    doc.setFont('helvetica', 'bold');
    doc.text('HORA:', margin + 37, curY);
    doc.setFont('helvetica', 'normal');
    doc.text(horaStr, margin + 46, curY);
    curY += 3.5;

    doc.setFont('helvetica', 'bold');
    doc.text('POLÍTICA:', margin, curY);
    doc.setFont('helvetica', 'normal');
    const archLines = doc.splitTextToSize(archivoNombre, printableWidth - 17);
    doc.text(archLines, margin + 17, curY);
    curY += (archLines.length * 3.2) + 1.5;

    dibujarSeparador(curY, true);
    curY += 3.5;

    // Encabezado de columnas
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('CANT / DESCRIPCIÓN', margin, curY);
    doc.text('COSTO (S/.)', rightMargin, curY, { align: 'right' });
    curY += 2.0;
    dibujarSeparador(curY, false); // línea sólida
    curY += 3.5;

    // Lista de productos
    BoletaManualState.items.forEach((item, index) => {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        const itemTitulo = `${index + 1}. ${item.descripcion.toUpperCase()}`;
        const descLines = doc.splitTextToSize(itemTitulo, printableWidth);
        doc.text(descLines, margin, curY);
        curY += (descLines.length * 3.3);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        const labText = `[${item.presentacion}] ${item.laboratorio || '-'}`;
        const labLines = doc.splitTextToSize(labText, 48);
        doc.text(labLines, margin + 2.5, curY);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.text(`S/ ${item.costo.toFixed(2)}`, rightMargin, curY, { align: 'right' });
        curY += Math.max(labLines.length * 3.0, 3.5) + 2.0;
    });

    dibujarSeparador(curY, true);
    curY += 3.5;

    // Resumen de cantidad
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('TOTAL PRODUCTOS:', margin, curY);
    doc.text(`${BoletaManualState.items.length}`, rightMargin, curY, { align: 'right' });
    curY += 3.0;

    dibujarSeparador(curY, true);
    curY += 4.0;

    // === RESUMEN FINANCIERO ===
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('TOTAL COSTOS:', margin, curY);
    doc.text(`S/ ${sumaCostos.toFixed(2)}`, rightMargin, curY, { align: 'right' });
    curY += 4.5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.text('MONTO DEL CLIENTE:', margin, curY);
    doc.text(`S/ ${montoCliente.toFixed(2)}`, rightMargin, curY, { align: 'right' });
    curY += 2.5;

    dibujarSeparador(curY, false); // línea sólida
    curY += 4.5;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    if (diferencia >= 0) {
        doc.text('DIFERENCIA / VUELTO:', margin, curY);
        doc.text(`S/ ${diferencia.toFixed(2)}`, rightMargin, curY, { align: 'right' });
        curY += 3.5;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(7);
        doc.text('(Vuelto a favor del cliente)', margin, curY);
    } else {
        doc.text('SALDO POR COBRAR:', margin, curY);
        doc.text(`S/ ${Math.abs(diferencia).toFixed(2)}`, rightMargin, curY, { align: 'right' });
        curY += 3.5;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7);
        doc.text('** SALDO PENDIENTE A COBRAR', margin, curY);
    }
    curY += 3.5;

    dibujarSeparador(curY, true);
    curY += 4.5;

    // === FIRMAS DE CONFORMIDAD ===
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text('FIRMAS DE CONFORMIDAD', centerX, curY, { align: 'center' });
    curY += 12.0;

    // Firma 1: DT / Farmacéutico
    doc.setLineWidth(0.25);
    doc.line(14, curY, 66, curY);
    curY += 3.0;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('ENTREGADO POR / DT', centerX, curY, { align: 'center' });
    curY += 2.8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('Firma y Sello de Farmacia', centerX, curY, { align: 'center' });
    curY += 11.0;

    // Firma 2: Cliente
    doc.line(14, curY, 66, curY);
    curY += 3.0;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('CONFORMIDAD DEL CLIENTE', centerX, curY, { align: 'center' });
    curY += 2.8;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('DNI: _______________________', centerX, curY, { align: 'center' });
    curY += 4.5;

    dibujarSeparador(curY, true);
    curY += 3.5;

    // === PIE DEL TICKET ===
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6.5);
    doc.text('Documento emitido para control interno.', centerX, curY, { align: 'center' });
    curY += 2.8;
    doc.text('Sistema Gestor de Canjes - Mifarma / Inkafarma', centerX, curY, { align: 'center' });
    curY += 3.0;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.text('*** GRACIAS POR SU ATENCIÓN ***', centerX, curY, { align: 'center' });
    curY += 8.0;

    // Descarga y vista previa
    const nombrePdf = `Ticket_NCR80mm_${correlativo}_${fechaStr.replace(/\//g, '-')}.pdf`;
    doc.save(nombrePdf);

    try {
        const blobUrl = doc.output('bloburl');
        window.open(blobUrl, '_blank');
    } catch (e) {
        console.warn('No se pudo abrir automáticamente en nueva pestaña:', e);
    }

    Swal.fire({
        icon: 'success',
        title: '¡Ticket 80mm Generado!',
        html: `
            <div style="font-size: 13.5px; text-align: left;">
                <p class="mb-1"><strong>Medidas de Ticketera Térmica (NCR POS):</strong></p>
                <ul class="mb-2 ps-3">
                    <li>Ancho del papel: <strong>80 mm</strong></li>
                    <li>Ancho útil de texto: <strong>72 mm</strong> (4 mm margen lateral)</li>
                    <li>Alto de papel: <strong>Continuo variable (${alturaTotalMm} mm)</strong></li>
                </ul>
                <p class="text-muted small mb-0">Se descargó <code>${nombrePdf}</code> y se abrió la vista previa lista para enviar a imprimir a tu ticketera NCR.</p>
            </div>
        `,
        confirmButtonColor: '#10b981'
    });
}

// Formato alternativo en Hoja A4 estándar
function imprimirBoletaA4() {
    if (BoletaManualState.items.length === 0) {
        Swal.fire({
            icon: 'warning',
            title: 'Boleta vacía',
            text: 'Debes agregar al menos un producto a la boleta antes de imprimir.',
            confirmButtonColor: '#0d6efd'
        });
        return;
    }

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();

    const sumaCostos = BoletaManualState.items.reduce((acc, item) => acc + (parseFloat(item.costo) || 0), 0);
    const montoRaw = (document.getElementById('boletaMontoCliente')?.value || '0').toString().replace(/,/g, '.');
    const montoCliente = parseFloat(montoRaw) || 0;
    const difRaw = (document.getElementById('boletaDiferenciaSoles')?.value || '').toString().replace(/,/g, '.');
    const diferencia = difRaw !== '' ? (parseFloat(difRaw) || 0) : (montoCliente - sumaCostos);

    const ahora = new Date();
    const fechaStr = ahora.toLocaleDateString('es-PE');
    const horaStr = ahora.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const correlativo = `BM-${ahora.getFullYear()}${String(ahora.getMonth() + 1).padStart(2, '0')}${String(ahora.getDate()).padStart(2, '0')}-${String(Math.floor(Math.random() * 900) + 100)}`;

    doc.setFillColor(13, 110, 253);
    doc.rect(14, 12, pageWidth - 28, 5, 'F');

    doc.setTextColor(15, 23, 42);
    doc.setFont(undefined, 'bold');
    doc.setFontSize(15);
    doc.text('FARMACIAS PERUANAS - GESTIÓN DE CANJES', pageWidth / 2, 24, { align: 'center' });

    doc.setFontSize(11);
    doc.setTextColor(13, 110, 253);
    doc.text('COMPROBANTE DE CANJE / BOLETA MANUAL', pageWidth / 2, 30, { align: 'center' });

    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.setFont(undefined, 'normal');
    doc.text('Control Operativo de Canjes y Devoluciones de Productos Farmacéuticos', pageWidth / 2, 35, { align: 'center' });

    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.5);
    doc.line(14, 38, pageWidth - 14, 38);

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(14, 41, pageWidth - 28, 16, 2, 2, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(14, 41, pageWidth - 28, 16, 2, 2, 'D');

    doc.setFontSize(8);
    doc.setTextColor(30, 41, 59);

    doc.setFont(undefined, 'bold');
    doc.text('N° COMPROBANTE:', 18, 47);
    doc.setFont(undefined, 'normal');
    doc.text(correlativo, 50, 47);

    doc.setFont(undefined, 'bold');
    doc.text('FECHA Y HORA:', 18, 53);
    doc.setFont(undefined, 'normal');
    doc.text(`${fechaStr} ${horaStr}`, 50, 53);

    const archivoNombre = AppState.archivoActual ? AppState.archivoActual : 'Ingreso Manual / Sin archivo';
    doc.setFont(undefined, 'bold');
    doc.text('ARCHIVO POLÍTICA:', 110, 47);
    doc.setFont(undefined, 'normal');
    doc.text(doc.splitTextToSize(archivoNombre, 70), 143, 47);

    doc.setFont(undefined, 'bold');
    doc.text('TOTAL ÍTEMS:', 110, 53);
    doc.setFont(undefined, 'normal');
    doc.text(`${BoletaManualState.items.length} producto(s)`, 143, 53);

    const bodyRows = BoletaManualState.items.map((item, index) => [
        (index + 1).toString(),
        item.descripcion.toUpperCase(),
        (item.laboratorio || '-').toUpperCase(),
        item.presentacion.toUpperCase(),
        `S/ ${item.costo.toFixed(2)}`
    ]);

    doc.autoTable({
        startY: 61,
        head: [['N°', 'DESCRIPCIÓN DEL PRODUCTO', 'LABORATORIO', 'PRESENTACIÓN', 'COSTO (S/.)']],
        body: bodyRows,
        theme: 'grid',
        headStyles: {
            fillColor: [13, 110, 253],
            textColor: [255, 255, 255],
            fontStyle: 'bold',
            fontSize: 8.5,
            halign: 'center',
            valign: 'middle'
        },
        styles: {
            fontSize: 8,
            cellPadding: 2,
            textColor: [30, 41, 59],
            valign: 'middle'
        },
        columnStyles: {
            0: { cellWidth: 10, halign: 'center' },
            1: { cellWidth: 80, halign: 'left' },
            2: { cellWidth: 46, halign: 'left' },
            3: { cellWidth: 26, halign: 'center' },
            4: { cellWidth: 20, halign: 'right', fontStyle: 'bold' }
        },
        alternateRowStyles: {
            fillColor: [248, 250, 252]
        },
        margin: { left: 14, right: 14 }
    });

    const finalY = doc.lastAutoTable.finalY + 6;
    const summaryBoxWidth = 85;
    const summaryBoxX = pageWidth - 14 - summaryBoxWidth;
    const summaryBoxY = finalY;

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(summaryBoxX, summaryBoxY, summaryBoxWidth, 28, 2, 2, 'F');
    doc.setDrawColor(203, 213, 225);
    doc.roundedRect(summaryBoxX, summaryBoxY, summaryBoxWidth, 28, 2, 2, 'D');

    doc.setFontSize(8.5);
    doc.setFont(undefined, 'bold');
    doc.setTextColor(51, 65, 85);

    doc.text('TOTAL COSTOS:', summaryBoxX + 5, summaryBoxY + 7);
    doc.text(`S/ ${sumaCostos.toFixed(2)}`, summaryBoxX + summaryBoxWidth - 5, summaryBoxY + 7, { align: 'right' });

    doc.text('MONTO DEL CLIENTE:', summaryBoxX + 5, summaryBoxY + 14);
    doc.text(`S/ ${montoCliente.toFixed(2)}`, summaryBoxX + summaryBoxWidth - 5, summaryBoxY + 14, { align: 'right' });

    doc.setDrawColor(203, 213, 225);
    doc.line(summaryBoxX + 4, summaryBoxY + 18, summaryBoxX + summaryBoxWidth - 4, summaryBoxY + 18);

    doc.setFontSize(9.5);
    if (diferencia >= 0) {
        doc.setTextColor(4, 120, 87);
        doc.text('DIFERENCIA / VUELTO:', summaryBoxX + 5, summaryBoxY + 24);
        doc.text(`S/ ${diferencia.toFixed(2)}`, summaryBoxX + summaryBoxWidth - 5, summaryBoxY + 24, { align: 'right' });
    } else {
        doc.setTextColor(220, 38, 38);
        doc.text('SALDO POR COBRAR:', summaryBoxX + 5, summaryBoxY + 24);
        doc.text(`S/ ${Math.abs(diferencia).toFixed(2)}`, summaryBoxX + summaryBoxWidth - 5, summaryBoxY + 24, { align: 'right' });
    }

    const firmasY = Math.max(summaryBoxY + 40, finalY + 40);
    if (firmasY < 265) {
        doc.setDrawColor(148, 163, 184);
        doc.setLineWidth(0.5);

        doc.line(25, firmasY, 85, firmasY);
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.setFont(undefined, 'bold');
        doc.text('ENTREGADO POR / DT', 55, firmasY + 5, { align: 'center' });
        doc.setFont(undefined, 'normal');
        doc.text('Firma y Sello de Farmacia', 55, firmasY + 9, { align: 'center' });

        doc.line(pageWidth - 85, firmasY, pageWidth - 25, firmasY);
        doc.setFont(undefined, 'bold');
        doc.text('RECIBIDO / CONFORMIDAD', pageWidth - 55, firmasY + 5, { align: 'center' });
        doc.setFont(undefined, 'normal');
        doc.text('DNI / Firma del Cliente', pageWidth - 55, firmasY + 9, { align: 'center' });
    }

    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text('Documento emitido por el Sistema Gestor de Canjes - Boleta de Control Interno.', pageWidth / 2, 287, { align: 'center' });

    const nombrePdf = `Boleta_A4_${correlativo}_${fechaStr.replace(/\//g, '-')}.pdf`;
    doc.save(nombrePdf);

    try {
        const blobUrl = doc.output('bloburl');
        window.open(blobUrl, '_blank');
    } catch (e) {
        console.warn('No se pudo abrir automáticamente en nueva pestaña:', e);
    }

    Swal.fire({
        icon: 'success',
        title: '¡Boleta A4 Generada!',
        text: `Se descargó "${nombrePdf}" y se abrió la vista previa.`,
        confirmButtonColor: '#0d6efd'
    });
}

// La función principal por defecto genera el Ticket Térmico de 80mm
function imprimirBoletaPDF() {
    imprimirBoletaTicket80mm();
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

    const fileModalEl = document.getElementById('fileModal');
    if (fileModalEl) {
        // Al abrir: Si ya hay otro modal abierto (como Boleta Manual), elevar z-index del modal y backdrop
        fileModalEl.addEventListener('show.bs.modal', function () {
            const modalBoleta = document.getElementById('modalBoletaManual');
            if (modalBoleta && modalBoleta.classList.contains('show')) {
                fileModalEl.style.zIndex = '1070';
                setTimeout(() => {
                    const backdrops = document.querySelectorAll('.modal-backdrop');
                    if (backdrops.length > 1) {
                        backdrops[backdrops.length - 1].style.zIndex = '1065';
                    }
                }, 15);
            }
        });

        // Al cerrar: Restaurar scroll y estado de modal previo
        fileModalEl.addEventListener('hidden.bs.modal', function () {
            fileModalEl.style.zIndex = '';
            const modalBoleta = document.getElementById('modalBoletaManual');
            if (modalBoleta && modalBoleta.classList.contains('show')) {
                document.body.classList.add('modal-open');
                modalBoleta.focus();
            }
        });

        // Validar cierre obligatorio solo si no hay ningún archivo cargado y está en bienvenida
        fileModalEl.addEventListener('hide.bs.modal', function (e) {
            const fileInput = document.getElementById('fileInput');
            const enBienvenida = !document.getElementById('welcomeScreen').classList.contains('d-none');
            if (enBienvenida && !AppState.archivoActual && (!fileInput || !fileInput.files.length)) {
                e.preventDefault();
                Swal.fire({
                    icon: 'warning',
                    title: 'Archivo requerido',
                    text: 'Debes seleccionar tu archivo Excel para continuar.',
                    confirmButtonColor: '#009739'
                });
            }
        });
    }

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
        if (AppState.listaCanjes.length > 0 || AppState.archivoActual || BoletaManualState.items.length > 0) {
            const mensaje = "¿Estás seguro de salir o recargar? Se perderán los datos no guardados.";
            e.preventDefault();
            e.returnValue = mensaje;
            return mensaje;
        }
    });

    // === EVENT LISTENERS PARA BOLETA MANUAL ===

    document.getElementById('btnBoletaManualWelcome')?.addEventListener('click', abrirModalBoletaManual);
    document.getElementById('btnBoletaManualHeader')?.addEventListener('click', abrirModalBoletaManual);
    document.getElementById('btnBoletaManualBarra')?.addEventListener('click', abrirModalBoletaManual);

    document.getElementById('btnBoletaCargarExcel')?.addEventListener('click', () => {
        fileModal.show();
    });

    document.getElementById('btnBoletaBuscar')?.addEventListener('click', buscarProductoBoleta);

    document.getElementById('boletaInputCodigo')?.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            buscarProductoBoleta();
        }
    });

    document.getElementById('btnBoletaLimpiarCampos')?.addEventListener('click', limpiarCamposBoleta);
    document.getElementById('btnBoletaAgregar')?.addEventListener('click', agregarItemBoleta);
    document.getElementById('btnBoletaVaciar')?.addEventListener('click', vaciarBoleta);
    document.getElementById('btnImprimirBoletaPdf')?.addEventListener('click', imprimirBoletaPDF);
    document.getElementById('btnImprimirBoletaA4')?.addEventListener('click', imprimirBoletaA4);

    // Sanitización numérica estricta y cálculo en vivo
    ['boletaCosto', 'boletaMontoCliente', 'boletaDiferenciaSoles'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('input', function () {
                this.value = sanitizarNumeroDecimal(this.value);
                if (id === 'boletaMontoCliente') {
                    BoletaManualState.diferenciaEditadaManual = false;
                    actualizarTotalesBoleta();
                } else if (id === 'boletaDiferenciaSoles') {
                    BoletaManualState.diferenciaEditadaManual = true;
                }
            });
        }
    });

    document.getElementById('boletaDescripcion')?.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('boletaLab')?.focus();
        }
    });

    document.getElementById('boletaLab')?.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            document.getElementById('boletaCosto')?.focus();
        }
    });

    document.getElementById('boletaCosto')?.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            e.preventDefault();
            agregarItemBoleta();
        }
    });

    // === INICIALIZACIÓN FINAL ===

    localStorage.clear();
    localStorage.removeItem("archivoPolitica");
    verificarUltimoArchivo();
    actualizarTabla();
});
