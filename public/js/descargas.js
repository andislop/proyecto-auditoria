// ==========================
// Funciones Generales
// ==========================

// Convierte una imagen a DataURL (para los logos en PDF)
async function getImageDataUrl(imageUrl) {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
}

// Función para fetch con reintentos
async function fetchWithExponentialBackoff(url, options, retries = 3, delay = 500) {
    try {
        const response = await fetch(url, options);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        return await response.json();
    } catch (err) {
        if (retries > 0) {
            console.warn(`Retrying fetch: ${url}, attempts left: ${retries}`);
            await new Promise(r => setTimeout(r, delay));
            return fetchWithExponentialBackoff(url, options, retries - 1, delay * 2);
        } else {
            console.error("Fetch failed after retries:", err);
            return null;
        }
    }
}

// ==========================
// FUNCIONES DE DESCARGA PDF
// ==========================

// ---- Pasantías ----
        async function handleDownloadInternship(internshipId) {
            console.log(`%c[handleDownloadInternship] 🚀 Starting PDF generation for internship ID: ${internshipId}`, 'color: #1e88e5; font-weight: bold;');
            if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined' || typeof window.jspdf.jsPDF.API.autoTable === 'undefined') {
                console.error('%c[handleDownloadInternship] ❌ jsPDF o autoTable no están completamente cargados o inicializados.', 'color: #ea4335; font-weight: bold;');
                await showCustomAlert('Error', 'Las librerías necesarias para generar el PDF (jsPDF y AutoTable) aún no están disponibles. Por favor, espera un momento y inténtalo de nuevo.');
                return;
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            try {
                console.log(`%c[handleDownloadInternship] Calling fetchWithExponentialBackoff for datos-pdf for internship ID: ${internshipId}.`, 'color: #1e88e5;');
                const internshipData = await fetchWithExponentialBackoff(`/api/publicas/pasantias/${internshipId}/datos-pdf`, { method: 'GET' });
                console.log(`%c[handleDownloadInternship] Result of fetchWithExponentialBackoff:`, 'color: #1e88e5;', internshipData);

                if (!internshipData) {
                    console.warn('%c[handleDownloadInternship] ⚠️ internshipData is falsy (null or undefined). Showing alert and returning.', 'color: #fbbc04;');
                    await showCustomAlert('Error', 'No se pudieron obtener los datos de la pasantía para generar el PDF.');
                    return;
                }

                // --- Configuración del Documento ---
                const pageWidth = doc.internal.pageSize.getWidth();
                let yOffset = 10; // Margen superior inicial

                // --- Logos ---
                const unefaImageUrl = '../assets/img/unefa.png'; 
                const fuerzaArmadaImageUrl = '../assets/img/fuerza-armada.png'; 

                // Cargar logos
                const [unefaLogoDataUrl, fuerzaArmadaLogoDataUrl] = await Promise.all([
                    getImageDataUrl(unefaImageUrl),
                    getImageDataUrl(fuerzaArmadaImageUrl)
                ]);

                // Ajustar el tamaño y posición de los logos
                const logoWidth = 25; 
                const logoHeight = 25; 
                const logoMargin = 10; 
                
                // Dibujar primer logo (Fuerza Armada) a la izquierda
                doc.addImage(fuerzaArmadaLogoDataUrl, 'PNG', logoMargin, yOffset, logoWidth, logoHeight); 
                console.log('%c[handleDownloadInternship] Fuerza Armada logo drawn.', 'color: #34a853;');
                
                // Dibujar segundo logo (UNEFA) a la derecha
                doc.addImage(unefaLogoDataUrl, 'PNG', pageWidth - logoMargin - logoWidth, yOffset, logoWidth, logoHeight); 
                console.log('%c[handleDownloadInternship] UNEFA logo drawn.', 'color: #34a853;');
                
                yOffset += 5; 
                
                // --- Membrete ---
                doc.setFont('Times', 'Roman'); 
                doc.setFontSize(9);
                doc.text('REPÚBLICA BOLIVARIANA DE VENEZUELA', pageWidth / 2, yOffset, { align: 'center' });
                doc.text('MINISTERIO DEL PODER POPULAR PARA LA DEFENSA', pageWidth / 2, yOffset + 4, { align: 'center' });
                doc.text('VICEMINISTERIO DE EDUCACIÓN PARA LA DEFENSA', pageWidth / 2, yOffset + 8, { align: 'center' });
                doc.text('UNIVERSIDAD NACIONAL EXPERIMENTAL POLITÉCNICA', pageWidth / 2, yOffset + 12, { align: 'center' });
                doc.text('DE LA FUERZA ARMADA NACIONAL BOLIVARIANA', pageWidth / 2, yOffset + 16, { align: 'center' });
                doc.setFontSize(10);
                doc.setFont('Times', 'Bold');
                doc.text('U.N.E.F.A.', pageWidth / 2, yOffset + 20, { align: 'center' });
                doc.setFont('Times', 'Roman');
                doc.setFontSize(9);
                doc.text('NÚCLEO: LARA BARQUISIMETO', pageWidth / 2, yOffset + 24, { align: 'center' });

                yOffset += 40; 
                
                // --- Título del Documento ---
                doc.setFontSize(16);
                doc.setFont('Times', 'Bold');
                doc.setTextColor(42, 62, 97); 
                doc.text('COMPROBANTE DE PASANTÍA', pageWidth / 2, yOffset, { align: 'center' });
                doc.setTextColor(0, 0, 0); 
                doc.setFont('Times', 'Roman');
                yOffset += 15;

                // --- Datos del Proyecto ---
                doc.setFontSize(12);
                doc.setFont('Times', 'Bold');
                doc.text('Datos de la Pasantía', 10, yOffset);
                doc.line(10, yOffset + 1, pageWidth - 10, yOffset + 1); 
                doc.setFont('Times', 'Roman');
                yOffset += 7;

                const internshipDetails = [
                    `Título: ${internshipData.titulo || 'N/A'}`,
                    `Periodo: ${internshipData.periodo || 'N/A'}`,
                    `Carrera: ${internshipData.carrera || 'N/A'}`,
                    `Empresa: ${internshipData.empresa || 'N/A'}`,
                    `Estado: ${internshipData.estado || 'N/A'}`,
                    `Fecha Inicio: ${internshipData.fechaInicio ? new Date(internshipData.fechaInicio).toLocaleDateString('es-ES') : 'N/A'}`,
                    `Fecha Final: ${internshipData.fechaFinal ? new Date(internshipData.fechaFinal).toLocaleDateString('es-ES') : 'N/A'}`
                ];
                internshipDetails.forEach(detail => {
                    doc.text(detail, 10, yOffset);
                    yOffset += 6;
                });
                yOffset += 5; 

                // --- Datos del Tutor ---
                doc.setFontSize(12);
                doc.setFont('Times', 'Bold');
                doc.text('Datos del Tutor', 10, yOffset);
                doc.line(10, yOffset + 1, pageWidth - 10, yOffset + 1); 
                doc.setFont('Times', 'Roman');
                yOffset += 7;

                doc.text(`Cédula: ${internshipData.tutorCedula || 'N/A'}`, 10, yOffset);
                yOffset += 6;
                doc.text(`Nombre Completo: ${internshipData.tutorNombre || 'N/A'}`, 10, yOffset);
                yOffset += 10; 

                // --- Datos del Estudiante (Tabla) ---
                doc.setFontSize(12);
                doc.setFont('Times', 'Bold');
                doc.text('Datos del Estudiante', 10, yOffset);
                doc.line(10, yOffset + 1, pageWidth - 10, yOffset + 1); 
                doc.setFont('Times', 'Roman');
                yOffset += 7;

                const studentColumns = ["Cédula", "Nombre Completo", "Carrera del Estudiante"];
                const studentRows = [];

                if (internshipData.estudiante) {
                    studentRows.push([
                        internshipData.estudiante.cedula || 'N/A',
                        internshipData.estudiante.nombreCompleto || 'N/A',
                        internshipData.estudiante.carreraEstudiante || 'N/A'
                    ]);
                } else {
                    studentRows.push(['', 'No hay estudiante registrado.', '']);
                }

                doc.autoTable({
                    head: [studentColumns],
                    body: studentRows,
                    startY: yOffset,
                    theme: 'striped',
                    headStyles: { 
                        fillColor: [42, 62, 97], 
                        textColor: 255, 
                        fontStyle: 'bold',
                        font: 'Times' 
                    },
                    styles: { fontSize: 10, cellPadding: 2, overflow: 'linebreak', font: 'Times', fontStyle: 'Roman' },
                    columnStyles: {
                        0: { cellWidth: 35 },
                        1: { cellWidth: 70 },
                        2: { cellWidth: 'auto' }
                    },
                    margin: { top: 5, bottom: 5, left: 10, right: 10 },
                    didDrawPage: function (data) {
                        if (doc.autoTable.previous) {
                            yOffset = data.cursor.y; 
                        }
                    }
                });
                
                if (doc.autoTable.previous) {
                    yOffset = doc.autoTable.previous.finalY + 30; 
                } else {
                    yOffset += (studentRows.length * 10) + 30; 
                }
                
                // --- Firma ---
                if (yOffset > doc.internal.pageSize.height - 50) {
                    doc.addPage();
                    yOffset = 30; 
                }
                const signatureLineLength = 80;
                const signatureX = (pageWidth / 2) - (signatureLineLength / 2);
                doc.line(signatureX, yOffset, signatureX + signatureLineLength, yOffset); 
                doc.setFontSize(10);
                doc.setFont('Times', 'Roman');
                doc.text('Firma del Administrador / Jefe de Área Académica', pageWidth / 2, yOffset + 5, { align: 'center' });

                // Guardar el PDF
                doc.save(`Comprobante_Pasantia_${internshipId}.pdf`);
                console.log('%c[handleDownloadInternship] ✅ PDF generado y guardado exitosamente.', 'color: #34a853; font-weight: bold;');

            } catch (error) {
                console.error('%c[handleDownloadInternship] ❌ An error occurred during PDF generation (caught by top-level catch):', 'color: #ea4335; font-weight: bold;', error);
                await showCustomAlert('Error', 'Ocurrió un error al intentar generar el PDF. Revisa la consola para más detalles.');
            }
        }


// ---- Servicio Comunitario ----
    async function generateCommunityServicePdf(projectId) {
        console.log(`%c[generateCommunityServicePdf] 🚀 Starting PDF generation for project ID: ${projectId}`, 'color: #1e88e5; font-weight: bold;');
        // FIX: Asegurar que jsPDF y autoTable estén realmente disponibles
        if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined' || typeof window.jspdf.jsPDF.API.autoTable === 'undefined') {
            console.error('%c[generateCommunityServicePdf] ❌ jsPDF o autoTable no están completamente cargados o inicializados.', 'color: #ea4335; font-weight: bold;');
            await showCustomAlert('Error', 'Las librerías necesarias para generar el PDF (jsPDF y AutoTable) aún no están disponibles. Por favor, espera un momento y inténtalo de nuevo.');
            return;
        }

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();

        try {
            console.log(`%c[generateCommunityServicePdf] Calling fetchWithExponentialBackoff for datos-pdf for project ID: ${projectId}.`, 'color: #1e88e5;');
            const projectData = await fetchWithExponentialBackoff(`/api/publicas/proyectos-comunitarios/${projectId}/datos-pdf`, { method: 'GET' });
            console.log(`%c[generateCommunityServicePdf] Result of fetchWithExponentialBackoff:`, 'color: #1e88e5;', projectData);

            if (!projectData) {
                console.warn('%c[generateCommunityServicePdf] ⚠️ projectData is falsy (null or undefined). Showing alert and returning.', 'color: #fbbc04;');
                await showCustomAlert('Error', 'No se pudieron obtener los datos del proyecto para generar el PDF.');
                return;
            }

            // --- Configuración del Documento ---
            const pageWidth = doc.internal.pageSize.getWidth();
            let yOffset = 10; // Margen superior inicial

            // --- Logos ---
            const unefaImageUrl = '../assets/img/unefa.png'; 
            const fuerzaArmadaImageUrl = '../assets/img/fuerza-armada.png'; 

            const unefaImg = new Image();
            unefaImg.src = unefaImageUrl;
            const fuerzaArmadaImg = new Image();
            fuerzaArmadaImg.src = fuerzaArmadaImageUrl;

            console.log(`%c[generateCommunityServicePdf] Attempting to load logo from: ${unefaImageUrl} and ${fuerzaArmadaImageUrl}`, 'color: #1e88e5;');
            await Promise.all([
                new Promise((resolve) => {
                    unefaImg.onload = () => {
                        console.log('%c[generateCommunityServicePdf] UNEFA logo loaded successfully.', 'color: #34a853;');
                        resolve();
                    };
                    unefaImg.onerror = () => {
                        console.warn('%c[generateCommunityServicePdf] ⚠️ Error loading UNEFA logo. Continuing without it.', 'color: #fbbc04;');
                        resolve(); 
                    };
                }),
                new Promise((resolve) => {
                    fuerzaArmadaImg.onload = () => {
                        console.log('%c[generateCommunityServicePdf] Fuerza Armada logo loaded successfully.', 'color: #34a853;');
                        resolve();
                    };
                    fuerzaArmadaImg.onerror = () => {
                        console.warn('%c[generateCommunityServicePdf] ⚠️ Error loading Fuerza Armada logo. Continuing without it.', 'color: #fbbc04;');
                        resolve(); 
                    };
                })
            ]);

            // Ajustar el tamaño y posición de los logos
            const logoWidth = 25; 
            const logoHeight = 25; 
            const logoMargin = 10; // Margen desde los bordes
            const textStartOffset = logoMargin + logoWidth + 5; // Donde comienza el texto después del primer logo
            
            // Dibujar primer logo (Fuerza Armada) a la izquierda
            if (fuerzaArmadaImg.complete && fuerzaArmadaImg.naturalWidth !== 0) { 
                const canvas = document.createElement('canvas');
                const canvasResolutionMultiplier = 4; 
                canvas.width = logoWidth * canvasResolutionMultiplier;
                canvas.height = logoHeight * canvasResolutionMultiplier;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF'; 
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(fuerzaArmadaImg, 0, 0, canvas.width, canvas.height);
                const imgData = canvas.toDataURL('image/png');
                doc.addImage(imgData, 'PNG', logoMargin, yOffset, logoWidth, logoHeight); 
                console.log('%c[generateCommunityServicePdf] Fuerza Armada logo drawn.', 'color: #34a853;');
            } else {
                console.warn('%c[generateCommunityServicePdf] ⚠️ Could not draw Fuerza Armada logo.', 'color: #fbbc04;');
            }

            // Dibujar segundo logo (UNEFA) a la derecha
            if (unefaImg.complete && unefaImg.naturalWidth !== 0) { 
                const canvas = document.createElement('canvas');
                const canvasResolutionMultiplier = 4; 
                canvas.width = logoWidth * canvasResolutionMultiplier;
                canvas.height = logoHeight * canvasResolutionMultiplier;
                const ctx = canvas.getContext('2d');
                ctx.fillStyle = '#FFFFFF'; 
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(unefaImg, 0, 0, canvas.width, canvas.height);
                const imgData = canvas.toDataURL('image/png');
                doc.addImage(imgData, 'PNG', pageWidth - logoMargin - logoWidth, yOffset, logoWidth, logoHeight); 
                console.log('%c[generateCommunityServicePdf] UNEFA logo drawn.', 'color: #34a853;');
            } else {
                console.warn('%c[generateCommunityServicePdf] ⚠️ Could not draw UNEFA logo.', 'color: #fbbc04;');
            }
            
            yOffset += 5; // Pequeño margen después de los logos para empezar el texto
            
            // --- Encabezado ---
            // Usar Times New Roman o serif para una apariencia más formal
            doc.setFont('Times', 'Roman'); 
            doc.setFontSize(9);
            doc.text('REPÚBLICA BOLIVARIANA DE VENEZUELA', pageWidth / 2, yOffset, { align: 'center' });
            doc.text('MINISTERIO DEL PODER POPULAR PARA LA DEFENSA', pageWidth / 2, yOffset + 4, { align: 'center' });
            doc.text('VICEMINISTERIO DE EDUCACIÓN PARA LA DEFENSA', pageWidth / 2, yOffset + 8, { align: 'center' });
            doc.text('UNIVERSIDAD NACIONAL EXPERIMENTAL POLITÉCNICA', pageWidth / 2, yOffset + 12, { align: 'center' });
            doc.text('DE LA FUERZA ARMADA NACIONAL BOLIVARIANA', pageWidth / 2, yOffset + 16, { align: 'center' });
            doc.setFontSize(10);
            doc.setFont('Times', 'Bold');
            doc.text('U.N.E.F.A.', pageWidth / 2, yOffset + 20, { align: 'center' });
            doc.setFont('Times', 'Roman');
            doc.setFontSize(9);

            yOffset += 35; // Espacio después del encabezado
            
            // --- Título del Documento ---
            doc.setFontSize(16);
            doc.setFont('Times', 'Bold');
            doc.setTextColor(42, 62, 97); // Color similar a #2a3e61
            doc.text('COMPROBANTE DE SERVICIO COMUNITARIO', pageWidth / 2, yOffset, { align: 'center' });
            doc.setTextColor(0, 0, 0); // Resetear color
            doc.setFont('Times', 'Roman');
            yOffset += 15;

            // --- Datos del Proyecto ---
            doc.setFontSize(12);
            doc.setFont('Times', 'Bold');
            doc.text('Datos del Proyecto', 10, yOffset);
            doc.line(10, yOffset + 1, pageWidth - 10, yOffset + 1); // Línea divisoria
            doc.setFont('Times', 'Roman');
            yOffset += 7;

            const projectDetails = [
                `Nombre del Proyecto: ${projectData.nombreProyecto || 'N/A'}`,
                `Comunidad: ${projectData.comunidad || 'N/A'}`,
                `Periodo: ${projectData.periodo || 'N/A'}`,
                `Carrera: ${projectData.carrera || 'N/A'}`,
                `Fecha de Inicio: ${projectData.fechaInicio || 'N/A'}`,
                `Fecha Final: ${projectData.fechaFinal || 'N/A'}`,
                `Estado: ${projectData.estado || 'N/A'}`
            ];
            projectDetails.forEach(detail => {
                doc.text(detail, 10, yOffset);
                yOffset += 6;
            });
            yOffset += 5; // Espacio adicional

            // --- Datos del Tutor ---
            doc.setFontSize(12);
            doc.setFont('Times', 'Bold');
            doc.text('Datos del Tutor', 10, yOffset);
            doc.line(10, yOffset + 1, pageWidth - 10, yOffset + 1); // Línea divisoria
            doc.setFont('Times', 'Roman');
            yOffset += 7;

            doc.text(`Cédula: ${projectData.tutorCedula || 'N/A'}`, 10, yOffset);
            yOffset += 6;
            doc.text(`Nombre Completo: ${projectData.tutorNombre || 'N/A'}`, 10, yOffset);
            yOffset += 10; // Espacio adicional

            // --- Datos de los Integrantes (Tabla) ---
            doc.setFontSize(12);
            doc.setFont('Times', 'Bold');
            doc.text('Datos de los Integrantes', 10, yOffset);
            doc.line(10, yOffset + 1, pageWidth - 10, yOffset + 1); // Línea divisoria
            doc.setFont('Times', 'Roman');
            yOffset += 7;

            const tableColumn = ["Cédula", "Nombre Completo", "Carrera del Estudiante"];
            const tableRows = [];

            if (projectData.integrantes && projectData.integrantes.length > 0) {
                projectData.integrantes.forEach(integrante => {
                    tableRows.push([
                        integrante.cedula || 'N/A',
                        integrante.nombreCompleto || 'N/A',
                        integrante.carreraEstudiante || 'N/A' 
                    ]);
                });
            } else {
                tableRows.push(['', 'No hay integrantes registrados.', '']);
            }

            // Utiliza doc.autoTable para la tabla
            doc.autoTable({
                head: [tableColumn],
                body: tableRows,
                startY: yOffset,
                theme: 'striped',
                headStyles: { 
                    fillColor: [42, 62, 97], 
                    textColor: 255, 
                    fontStyle: 'bold' 
                },
                styles: { fontSize: 10, cellPadding: 2, overflow: 'linebreak', font: 'Times', fontStyle: 'Roman' },
                columnStyles: {
                    0: { cellWidth: 35 },
                    1: { cellWidth: 70 },
                    2: { cellWidth: 'auto' }
                },
                margin: { top: 5, bottom: 5, left: 10, right: 10 },
                didDrawPage: function (data) {
                    // Update yOffset only if autoTable.previous is available,
                    // which is when a page has actually been drawn.
                    if (doc.autoTable.previous) {
                        yOffset = data.cursor.y; 
                    }
                }
            });
            
            // Check if doc.autoTable.previous exists before accessing its properties.
            if (doc.autoTable.previous) {
                yOffset = doc.autoTable.previous.finalY + 30; // Espacio después de la tabla
            } else {
                // Fallback if no table was drawn (e.g., empty data), adjust yOffset manually
                yOffset += (tableRows.length * 10) + 30; 
            }
            
            // --- Firma ---
            // Asegurarse de que la firma no se corte al final de la página
            if (yOffset > doc.internal.pageSize.height - 50) {
                doc.addPage();
                yOffset = 30; // Reiniciar yOffset para la nueva página
            }
            doc.line(pageWidth / 2 - 40, yOffset, pageWidth / 2 + 40, yOffset); // Línea de firma
            doc.setFontSize(10);
            doc.setFont('Times', 'Roman');
            doc.text('Firma del Administrador / Jefe de Área Académica', pageWidth / 2, yOffset + 5, { align: 'center' });

            // Guardar el PDF
            doc.save(`Comprobante_Servicio_Comunitario_${projectId}.pdf`);
            console.log('%c[generateCommunityServicePdf] ✅ PDF generado y guardado exitosamente.', 'color: #34a853; font-weight: bold;');

        } catch (error) {
            console.error('%c[generateCommunityServicePdf] ❌ An error occurred during PDF generation (caught by top-level catch):', 'color: #ea4335; font-weight: bold;', error);
            await showCustomAlert('Error', 'Ocurrió un error al intentar generar el PDF. Revisa la consola para más detalles.');
        }
    }


// ---- Proyecto de Investigación ----
        async function handleDownloadInvestigationProject(projectId) {
            console.log(`%c[handleDownloadInvestigationProject] 🚀 Starting PDF generation for project ID: ${projectId}`, 'color: #1e88e5; font-weight: bold;');
            if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined' || typeof window.jspdf.jsPDF.API.autoTable === 'undefined') {
                console.error('%c[handleDownloadInvestigationProject] ❌ jsPDF o autoTable no están completamente cargados o inicializados.', 'color: #ea4335; font-weight: bold;');
                await showCustomAlert('Error', 'Las librerías necesarias para generar el PDF (jsPDF y AutoTable) aún no están disponibles. Por favor, espera un momento y inténtalo de nuevo.');
                return;
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            try {
                console.log(`%c[handleDownloadInvestigationProject] Calling fetchWithExponentialBackoff for datos-pdf for project ID: ${projectId}.`, 'color: #1e88e5;');
                const projectData = await fetchWithExponentialBackoff(`/api/publicas/proyectos-investigacion/${projectId}/datos-pdf`, { method: 'GET' });
                console.log(`%c[handleDownloadInvestigationProject] Result of fetchWithExponentialBackoff:`, 'color: #1e88e5;', projectData);

                if (!projectData) {
                    console.warn('%c[handleDownloadInvestigationProject] ⚠️ projectData is falsy (null or undefined). Showing alert and returning.', 'color: #fbbc04;');
                    await showCustomAlert('Error', 'No se pudieron obtener los datos del proyecto de investigación para generar el PDF.');
                    return;
                }

                // --- Configuración del Documento ---
                const pageWidth = doc.internal.pageSize.getWidth();
                let yOffset = 10; // Margen superior inicial

                // --- Logos ---
                const unefaImageUrl = '../assets/img/unefa.png'; 
                const fuerzaArmadaImageUrl = '../assets/img/fuerza-armada.png'; 

                // Cargar logos
                const [unefaLogoDataUrl, fuerzaArmadaLogoDataUrl] = await Promise.all([
                    getImageDataUrl(unefaImageUrl),
                    getImageDataUrl(fuerzaArmadaImageUrl)
                ]);

                // Ajustar el tamaño y posición de los logos
                const logoWidth = 25; 
                const logoHeight = 25; 
                const logoMargin = 10; // Margen desde los bordes
                
                // Dibujar primer logo (Fuerza Armada) a la izquierda
                doc.addImage(fuerzaArmadaLogoDataUrl, 'PNG', logoMargin, yOffset, logoWidth, logoHeight); 
                console.log('%c[handleDownloadInvestigationProject] Fuerza Armada logo drawn.', 'color: #34a853;');
                
                // Dibujar segundo logo (UNEFA) a la derecha
                doc.addImage(unefaLogoDataUrl, 'PNG', pageWidth - logoMargin - logoWidth, yOffset, logoWidth, logoHeight); 
                console.log('%c[handleDownloadInvestigationProject] UNEFA logo drawn.', 'color: #34a853;');
                
                yOffset += 5; // Pequeño margen después de los logos para empezar el texto
                
                // --- Membrete ---
                doc.setFont('Times', 'Roman'); 
                doc.setFontSize(9);
                doc.text('REPÚBLICA BOLIVARIANA DE VENEZUELA', pageWidth / 2, yOffset, { align: 'center' });
                doc.text('MINISTERIO DEL PODER POPULAR PARA LA DEFENSA', pageWidth / 2, yOffset + 4, { align: 'center' });
                doc.text('VICEMINISTERIO DE EDUCACIÓN PARA LA DEFENSA', pageWidth / 2, yOffset + 8, { align: 'center' });
                doc.text('UNIVERSIDAD NACIONAL EXPERIMENTAL POLITÉCNICA', pageWidth / 2, yOffset + 12, { align: 'center' });
                doc.text('DE LA FUERZA ARMADA NACIONAL BOLIVARIANA', pageWidth / 2, yOffset + 16, { align: 'center' });
                doc.setFontSize(10);
                doc.setFont('Times', 'Bold');
                doc.text('U.N.E.F.A.', pageWidth / 2, yOffset + 20, { align: 'center' });
                doc.setFont('Times', 'Roman');
                doc.setFontSize(9);
                doc.text('NÚCLEO: LARA BARQUISIMETO', pageWidth / 2, yOffset + 24, { align: 'center' });

                yOffset += 40; // Espacio después del membrete
                
                // --- Título del Documento ---
                doc.setFontSize(16);
                doc.setFont('Times', 'Bold');
                doc.setTextColor(42, 62, 97); // Color similar a #2a3e61
                doc.text('COMPROBANTE DE PROYECTO DE INVESTIGACIÓN', pageWidth / 2, yOffset, { align: 'center' });
                doc.setTextColor(0, 0, 0); // Resetear color
                doc.setFont('Times', 'Roman');
                yOffset += 15;

                // --- Datos del Proyecto ---
                doc.setFontSize(12);
                doc.setFont('Times', 'Bold');
                doc.text('Datos del Proyecto', 10, yOffset);
                doc.line(10, yOffset + 1, pageWidth - 10, yOffset + 1); // Línea divisoria
                doc.setFont('Times', 'Roman');
                yOffset += 7;

                const projectDetails = [
                    `Nombre del Proyecto: ${projectData.nombreProyecto || 'N/A'}`,
                    `Periodo: ${projectData.periodo || 'N/A'}`,
                    `Carrera: ${projectData.carrera || 'N/A'}`,
                    `Estado: ${projectData.estado || 'N/A'}`,
                    `Fecha de Generación: ${new Date().toLocaleDateString('es-ES') || 'N/A'}`
                ];
                projectDetails.forEach(detail => {
                    doc.text(detail, 10, yOffset);
                    yOffset += 6;
                });
                yOffset += 5; // Espacio adicional

                // --- Datos del Estudiante (Tabla) ---
                doc.setFontSize(12);
                doc.setFont('Times', 'Bold');
                doc.text('Datos del Estudiante', 10, yOffset);
                doc.line(10, yOffset + 1, pageWidth - 10, yOffset + 1); // Línea divisoria
                doc.setFont('Times', 'Roman');
                yOffset += 7;

                const studentColumns = ["Cédula", "Nombre Completo", "Carrera del Estudiante"];
                const studentRows = [];

                if (projectData.estudiante) {
                    studentRows.push([
                        projectData.estudiante.cedula || 'N/A',
                        projectData.estudiante.nombreCompleto || 'N/A',
                        projectData.estudiante.carreraEstudiante || 'N/A'
                    ]);
                } else {
                    studentRows.push(['', 'No hay estudiante registrado.', '']);
                }

                // Utiliza doc.autoTable para la tabla
                doc.autoTable({
                    head: [studentColumns],
                    body: studentRows,
                    startY: yOffset,
                    theme: 'striped',
                    headStyles: { 
                        fillColor: [42, 62, 97], 
                        textColor: 255, 
                        fontStyle: 'bold',
                        font: 'Times' 
                    },
                    styles: { fontSize: 10, cellPadding: 2, overflow: 'linebreak', font: 'Times', fontStyle: 'Roman' },
                    columnStyles: {
                        0: { cellWidth: 35 },
                        1: { cellWidth: 70 },
                        2: { cellWidth: 'auto' }
                    },
                    margin: { top: 5, bottom: 5, left: 10, right: 10 },
                    didDrawPage: function (data) {
                        if (doc.autoTable.previous) {
                            yOffset = data.cursor.y; 
                        }
                    }
                });
                
                if (doc.autoTable.previous) {
                    yOffset = doc.autoTable.previous.finalY + 30; // Espacio después de la tabla
                } else {
                    yOffset += (studentRows.length * 10) + 30; 
                }
                
                // --- Firma ---
                if (yOffset > doc.internal.pageSize.height - 50) {
                    doc.addPage();
                    yOffset = 30; // Reiniciar yOffset para la nueva página
                }
                const signatureLineLength = 80;
                const signatureX = (pageWidth / 2) - (signatureLineLength / 2);
                doc.line(signatureX, yOffset, signatureX + signatureLineLength, yOffset); // Línea de firma
                doc.setFontSize(10);
                doc.setFont('Times', 'Roman');
                doc.text('Firma del Administrador / Jefe de Área Académica', pageWidth / 2, yOffset + 5, { align: 'center' });

                // Guardar el PDF
                doc.save(`Comprobante_Proyecto_Investigacion_${projectId}.pdf`);
                console.log('%c[handleDownloadInvestigationProject] ✅ PDF generado y guardado exitosamente.', 'color: #34a853; font-weight: bold;');

            } catch (error) {
                console.error('%c[handleDownloadInvestigationProject] ❌ An error occurred during PDF generation (caught by top-level catch):', 'color: #ea4335; font-weight: bold;', error);
                await showCustomAlert('Error', 'Ocurrió un error al intentar generar el PDF. Revisa la consola para más detalles.');
            }
        }


// ---- Trabajo de Grado ----
        async function handleDownloadDegreeProject(degreeProjectId) {
            console.log(`%c[handleDownloadDegreeProject] 🚀 Starting PDF generation for project ID: ${degreeProjectId}`, 'color: #1e88e5; font-weight: bold;');
            // FIX: Asegurar que jsPDF y autoTable estén realmente disponibles
            if (typeof window.jspdf === 'undefined' || typeof window.jspdf.jsPDF === 'undefined' || typeof window.jspdf.jsPDF.API.autoTable === 'undefined') {
                console.error('%c[handleDownloadDegreeProject] ❌ jsPDF o autoTable no están completamente cargados o inicializados.', 'color: #ea4335; font-weight: bold;');
                await showCustomAlert('Error', 'Las librerías necesarias para generar el PDF (jsPDF y AutoTable) aún no están disponibles. Por favor, espera un momento y inténtalo de nuevo.');
                return;
            }

            const { jsPDF } = window.jspdf;
            const doc = new jsPDF();

            try {
                // Obtener los datos completos del trabajo de grado desde el backend
                console.log(`%c[handleDownloadDegreeProject] Calling fetchWithExponentialBackoff for datos-pdf for degree project ID: ${degreeProjectId}.`, 'color: #1e88e5;');
                const degreeProjectData = await fetchWithExponentialBackoff(`/api/publicas/trabajos-de-grado/${degreeProjectId}/datos-pdf`, { method: 'GET' });
                console.log(`%c[handleDownloadDegreeProject] Result of fetchWithExponentialBackoff:`, 'color: #1e88e5;', degreeProjectData);

                if (!degreeProjectData) {
                    console.warn('%c[handleDownloadDegreeProject] ⚠️ degreeProjectData is falsy (null or undefined). Showing alert and returning.', 'color: #fbbc04;');
                    await showCustomAlert('Error', 'No se pudieron obtener los datos del trabajo de grado para generar el PDF.');
                    return;
                }

                // --- Configuración del Documento ---
                const pageWidth = doc.internal.pageSize.getWidth();
                let yOffset = 10; // Margen superior inicial

                // --- Logos ---
                const unefaImageUrl = '../assets/img/unefa.png'; 
                const fuerzaArmadaImageUrl = '../assets/img/fuerza-armada.png'; 

                // Cargar logos
                const [unefaLogoDataUrl, fuerzaArmadaLogoDataUrl] = await Promise.all([
                    getImageDataUrl(unefaImageUrl),
                    getImageDataUrl(fuerzaArmadaImageUrl)
                ]);

                // Ajustar el tamaño y posición de los logos
                const logoWidth = 25; 
                const logoHeight = 25; 
                const logoMargin = 10; // Margen desde los bordes
                
                // Dibujar primer logo (Fuerza Armada) a la izquierda
                doc.addImage(fuerzaArmadaLogoDataUrl, 'PNG', logoMargin, yOffset, logoWidth, logoHeight); 
                console.log('%c[handleDownloadDegreeProject] Fuerza Armada logo drawn.', 'color: #34a853;');
                
                // Dibujar segundo logo (UNEFA) a la derecha
                doc.addImage(unefaLogoDataUrl, 'PNG', pageWidth - logoMargin - logoWidth, yOffset, logoWidth, logoHeight); 
                console.log('%c[handleDownloadDegreeProject] UNEFA logo drawn.', 'color: #34a853;');
                
                yOffset += 5; // Pequeño margen después de los logos para empezar el texto
                
                // --- Membrete ---
                doc.setFont('Times', 'Roman'); 
                doc.setFontSize(9);
                doc.text('REPÚBLICA BOLIVARIANA DE VENEZUELA', pageWidth / 2, yOffset, { align: 'center' });
                doc.text('MINISTERIO DEL PODER POPULAR PARA LA DEFENSA', pageWidth / 2, yOffset + 4, { align: 'center' });
                doc.text('VICEMINISTERIO DE EDUCACIÓN PARA LA DEFENSA', pageWidth / 2, yOffset + 8, { align: 'center' });
                doc.text('UNIVERSIDAD NACIONAL EXPERIMENTAL POLITÉCNICA', pageWidth / 2, yOffset + 12, { align: 'center' });
                doc.text('DE LA FUERZA ARMADA NACIONAL BOLIVARIANA', pageWidth / 2, yOffset + 16, { align: 'center' });
                doc.setFontSize(10);
                doc.setFont('Times', 'Bold');
                doc.text('U.N.E.F.A.', pageWidth / 2, yOffset + 20, { align: 'center' });
                doc.setFont('Times', 'Roman');
                doc.setFontSize(9);
                doc.text('NÚCLEO: LARA BARQUISIMETO', pageWidth / 2, yOffset + 24, { align: 'center' });

                yOffset += 40; // Espacio después del membrete
                
                // --- Título del Documento ---
                doc.setFontSize(16);
                doc.setFont('Times', 'Bold');
                doc.setTextColor(42, 62, 97); // Color similar a #2a3e61
                doc.text('COMPROBANTE DE TRABAJO DE GRADO', pageWidth / 2, yOffset, { align: 'center' });
                doc.setTextColor(0, 0, 0); // Resetear color
                doc.setFont('Times', 'Roman');
                yOffset += 15;

                // --- Datos del Proyecto ---
                doc.setFontSize(12);
                doc.setFont('Times', 'Bold');
                doc.text('Datos del Proyecto', 10, yOffset);
                doc.line(10, yOffset + 1, pageWidth - 10, yOffset + 1); // Línea divisoria
                doc.setFont('Times', 'Roman');
                yOffset += 7;

                const projectDetails = [
                    `Nombre del Proyecto: ${degreeProjectData.nombreProyecto || 'N/A'}`,
                    `Periodo: ${degreeProjectData.periodo || 'N/A'}`,
                    `Carrera: ${degreeProjectData.carrera || 'N/A'}`,
                    `Estado: ${degreeProjectData.estado || 'N/A'}`,
                    `Fecha: ${degreeProjectData.fecha ? new Date(degreeProjectData.fecha).toLocaleDateString('es-ES') : 'N/A'}`
                ];
                projectDetails.forEach(detail => {
                    doc.text(detail, 10, yOffset);
                    yOffset += 6;
                });
                yOffset += 5; // Espacio adicional

                // --- Datos del Tutor ---
                doc.setFontSize(12);
                doc.setFont('Times', 'Bold');
                doc.text('Datos del Tutor', 10, yOffset);
                doc.line(10, yOffset + 1, pageWidth - 10, yOffset + 1); // Línea divisoria
                doc.setFont('Times', 'Roman');
                yOffset += 7;

                doc.text(`Cédula: ${degreeProjectData.tutorCedula || 'N/A'}`, 10, yOffset);
                yOffset += 6;
                doc.text(`Nombre Completo: ${degreeProjectData.tutorNombre || 'N/A'}`, 10, yOffset);
                yOffset += 10; // Espacio adicional

                // --- Datos del Estudiante (Tabla) ---
                doc.setFontSize(12);
                doc.setFont('Times', 'Bold');
                doc.text('Datos del Estudiante', 10, yOffset);
                doc.line(10, yOffset + 1, pageWidth - 10, yOffset + 1); // Línea divisoria
                doc.setFont('Times', 'Roman');
                yOffset += 7;

                const studentColumns = ["Cédula", "Nombre Completo", "Carrera del Estudiante"];
                const studentRows = [];

                if (degreeProjectData.estudiante) {
                    studentRows.push([
                        degreeProjectData.estudiante.cedula || 'N/A',
                        degreeProjectData.estudiante.nombreCompleto || 'N/A',
                        degreeProjectData.estudiante.carreraEstudiante || 'N/A'
                    ]);
                } else {
                    studentRows.push(['', 'No hay estudiante registrado.', '']);
                }

                // Utiliza doc.autoTable para la tabla
                doc.autoTable({
                    head: [studentColumns],
                    body: studentRows,
                    startY: yOffset,
                    theme: 'striped',
                    headStyles: { 
                        fillColor: [42, 62, 97], 
                        textColor: 255, 
                        fontStyle: 'bold',
                        font: 'Times' 
                    },
                    styles: { fontSize: 10, cellPadding: 2, overflow: 'linebreak', font: 'Times', fontStyle: 'Roman' },
                    columnStyles: {
                        0: { cellWidth: 35 },
                        1: { cellWidth: 70 },
                        2: { cellWidth: 'auto' }
                    },
                    margin: { top: 5, bottom: 5, left: 10, right: 10 },
                    didDrawPage: function (data) {
                        if (doc.autoTable.previous) {
                            yOffset = data.cursor.y; 
                        }
                    }
                });
                
                if (doc.autoTable.previous) {
                    yOffset = doc.autoTable.previous.finalY + 30; // Espacio después de la tabla
                } else {
                    yOffset += (studentRows.length * 10) + 30; 
                }
                
                // --- Firma ---
                if (yOffset > doc.internal.pageSize.height - 50) {
                    doc.addPage();
                    yOffset = 30; // Reiniciar yOffset para la nueva página
                }
                const signatureLineLength = 80;
                const signatureX = (pageWidth / 2) - (signatureLineLength / 2);
                doc.line(signatureX, yOffset, signatureX + signatureLineLength, yOffset); // Línea de firma
                doc.setFontSize(10);
                doc.setFont('Times', 'Roman');
                doc.text('Firma del Administrador / Jefe de Área Académica', pageWidth / 2, yOffset + 5, { align: 'center' });

                // Guardar el PDF
                doc.save(`Comprobante_Trabajo_de_Grado_${degreeProjectId}.pdf`);
                console.log('%c[handleDownloadDegreeProject] ✅ PDF generado y guardado exitosamente.', 'color: #34a853; font-weight: bold;');

            } catch (error) {
                console.error('%c[handleDownloadDegreeProject] ❌ An error occurred during PDF generation (caught by top-level catch):', 'color: #ea4335; font-weight: bold;', error);
                await showCustomAlert('Error', 'Ocurrió un error al intentar generar el PDF. Revisa la consola para más detalles.');
            }
        }