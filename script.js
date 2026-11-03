let globalData = [];
let stadiumsData = [];

document.addEventListener("DOMContentLoaded", () => {
    // 1. Cargar data.json (Park Factors)
    fetch('data.json')
        .then(response => response.json())
        .then(data => {
            globalData = data;
            initRegimes();
        })
        .catch(err => console.error("Error cargando data.json:", err));

    // 2. Cargar estadios.json (Estadios)
    fetch('estadios.json')
        .then(response => response.json())
        .then(data => {
            stadiumsData = data;
            initStadiums();
        })
        .catch(err => console.error("Error cargando estadios.json:", err));
});

// ==========================================
// LÓGICA DE PESTAÑAS (TABS)
// ==========================================
function showTab(tab) {
    document.getElementById('section-dashboard').style.display = 'none';
    document.getElementById('section-stadiums').style.display = 'none';
    document.getElementById('section-methodology').style.display = 'none';
    
    document.getElementById('tab-dashboard').classList.remove('active');
    document.getElementById('tab-stadiums').classList.remove('active');
    document.getElementById('tab-methodology').classList.remove('active');
    
    if (tab === 'dashboard') {
        document.getElementById('section-dashboard').style.display = 'block';
        document.getElementById('tab-dashboard').classList.add('active');
    } else if (tab === 'stadiums') {
        document.getElementById('section-stadiums').style.display = 'block';
        document.getElementById('tab-stadiums').classList.add('active');
    } else if (tab === 'methodology') {
        document.getElementById('section-methodology').style.display = 'block';
        document.getElementById('tab-methodology').classList.add('active');
    }
}

// ==========================================
// LÓGICA DEL DASHBOARD (Park Factors)
// ==========================================
function initRegimes() {
    const selectReg = document.getElementById('selectRegime');
    const regimenLabels = {
        'A': 'Régimen A (32SN - 51SN)',
        'B': 'Régimen B (52SN - 59SN)',
        'C': 'Régimen C (60SN - 65SN)'
    };

    const regimes = [...new Set(globalData.map(d => d.regimen))].filter(Boolean).sort();
    
    if (regimes.length === 0) {
        selectReg.innerHTML = '<option value="">No hay datos</option>';
        return;
    }
    
    selectReg.innerHTML = '';
    regimes.forEach(r => {
        const label = regimenLabels[r] || `Régimen ${r}`;
        selectReg.innerHTML += `<option value="${r}">${label}</option>`;
    });
    updateSeasons();
}

function updateSeasons() {
    const regime = document.getElementById('selectRegime').value;
    const selectSeason = document.getElementById('selectSeason');
    
    const seasons = [...new Set(globalData.filter(d => d.regimen === regime).map(d => d.temporada))].filter(Boolean);
    seasons.sort((a, b) => b - a);
    
    selectSeason.innerHTML = '';
    seasons.forEach(s => {
        selectSeason.innerHTML += `<option value="${s}">Serie ${s}</option>`;
    });
    
    document.getElementById('regimeWarning').classList.remove('d-none');
    renderDashboard();
}

function renderDashboard() {
    const regime = document.getElementById('selectRegime').value;
    const season = document.getElementById('selectSeason').value;
    const metric = document.getElementById('selectMetric').value;
    
    if (!season || !metric) return;
    
    const validData = globalData.filter(d => 
        d.regimen === regime && 
        d.temporada == season && 
        d.evento === metric && 
        d.PF_final !== null
    );
    
    validData.sort((a, b) => b.PF_final - a.PF_final);

    renderChart(validData, metric);
    renderTable(validData, metric);
}

function renderChart(data, metric) {
    const stadiums = data.map(d => d.estadio);
    const pfs = data.map(d => d.PF_final);
    const ci_lower = data.map(d => d.IC95_inf);
    const ci_upper = data.map(d => d.IC95_sup);

    const error_y = ci_upper.map((sup, i) => sup - pfs[i]);
    const error_y_minus = pfs.map((pf, i) => pf - ci_lower[i]);

    const trace = {
        x: stadiums,
        y: pfs,
        type: 'bar',
        text: pfs.map(pf => pf.toFixed(3)),
        textposition: 'auto',
        marker: {
            color: pfs.map(pf => pf > 1.00 ? '#DA291C' : (pf < 1.00 ? '#0B2A68' : '#6c757d'))
        },
        error_y: {
            type: 'data',
            symmetric: false,
            array: error_y,
            arrayminus: error_y_minus,
            color: 'black'
        }
    };

    const layout = {
        title: `PF de ${metric} - Serie ${document.getElementById('selectSeason').value}`,
        yaxis: { title: 'Factor (1.00 = Promedio)' },
        shapes: [{
            type: 'line',
            x0: -0.5,
            x1: stadiums.length - 0.5,
            y0: 1.00, y1: 1.00,
            line: { color: 'red', width: 2, dash: 'dash' }
        }],
        margin: { b: 150 }
    };

    Plotly.newPlot('plotlyChart', [trace], layout, {responsive: true});
}

function renderTable(data, metric) {
    const tbody = document.querySelector('#dataTable tbody');
    tbody.innerHTML = '';

    data.forEach(d => {
        let badgeClass = 'bg-secondary text-dark';
        if (d.clasificacion.includes('Efecto')) badgeClass = 'bg-success';
        else if (d.clasificacion.includes('Sugerente')) badgeClass = 'bg-warning text-dark';
        else if (d.clasificacion.includes('Inconcluso')) badgeClass = 'bg-danger';

        let flagsHtml = '';
        if (d.muestra_reducida) flagsHtml += '<span class="badge bg-info text-dark me-1">Muestra Reducida</span>';
        if (d.ventana_incompleta) flagsHtml += '<span class="badge bg-warning text-dark me-1">Ventana Incompleta</span>';
        if (d.nota && d.nota.includes('Compartido')) flagsHtml += '<span class="badge bg-primary me-1">Compartido</span>';
        if (d.nota && d.nota.includes('temporal')) flagsHtml += '<span class="badge bg-dark me-1">Temporal</span>';
        if (d.nota && d.nota.includes('insuficiente')) flagsHtml += '<span class="badge bg-danger me-1">Insuficiente</span>';

        tbody.innerHTML += `
            <tr>
                <td><strong>${d.estadio}</strong></td>
                <td class="text-center"><strong>${d.PF_final ? d.PF_final.toFixed(3) : '-'}</strong></td>
                <td class="text-center text-muted">[${d.IC95_inf ? d.IC95_inf.toFixed(3) : '-'} - ${d.IC95_sup ? d.IC95_sup.toFixed(3) : '-'}]</td>
                <td><span class="badge ${badgeClass}">${d.direccion} ${d.clasificacion}</span></td>
                <td class="text-center">${d.n_juegos}</td>
                <td>${flagsHtml || '-'}</td>
            </tr>
        `;
    });
}

// ==========================================
// LÓGICA DE LA SECCIÓN ESTADIOS
// ==========================================
function initStadiums() {
    const select = document.getElementById('selectStadium');
    if (!select) return;

    select.innerHTML = '';
    // Ordenar alfabéticamente
    stadiumsData.sort((a, b) => a.stadium.localeCompare(b.stadium));
    
    stadiumsData.forEach((s, index) => {
        select.innerHTML += `<option value="${index}">${s.stadium}</option>`;
    });
    
    if (stadiumsData.length > 0) {
        updateStadiumViewOptions();
    }
}

function updateStadiumViewOptions() {
    const selectedIndex = document.getElementById('selectStadium').value;
    const mode = document.getElementById('selectViewMode').value;
    
    if (selectedIndex === "") return;
    const data = stadiumsData[selectedIndex];

    if (mode === 'by_edition') {
        const edSelect = document.getElementById('selectEdition');
        edSelect.innerHTML = '';
        
        // Obtener las series en las que se jugó en este estadio, de mayor a menor
        const editions = Object.keys(data.by_edition).sort((a, b) => b - a);
        
        editions.forEach(ed => {
            edSelect.innerHTML += `<option value="${ed}">Serie ${ed}</option>`;
        });
    }
    
    renderStadium();
}

function toggleEditionSelect() {
    const mode = document.getElementById('selectViewMode').value;
    const edContainer = document.getElementById('editionContainer');
    
    if (mode === 'by_edition') {
        edContainer.style.display = 'block';
        updateStadiumViewOptions();
    } else {
        edContainer.style.display = 'none';
        renderStadium();
    }
}

function renderStadium() {
    const selectedIndex = document.getElementById('selectStadium').value;
    const mode = document.getElementById('selectViewMode').value;
    
    if (selectedIndex === "") return;

    const stadiumData = stadiumsData[selectedIndex];
    let currentData, yearLabel;

    if (mode === 'totals') {
        currentData = stadiumData.totals;
        yearLabel = 'Histórico';
    } else {
        const selectedEd = document.getElementById('selectEdition').value;
        if (!selectedEd) return;
        currentData = stadiumData.by_edition[selectedEd];
        yearLabel = `Serie ${selectedEd}`;
    }

    // 1. Tarjetas Superiores
    document.getElementById('stat-team').textContent = stadiumData.assigned_team;
    document.getElementById('stat-games').textContent = currentData.games.toLocaleString();
    
    document.getElementById('stat-runs').textContent = currentData.runs.toLocaleString();
    document.getElementById('stat-runs-pg').textContent = currentData.games > 0 ? `${(currentData.runs / currentData.games).toFixed(2)} / juego` : '-';
    
    document.getElementById('stat-hits').textContent = currentData.hits.toLocaleString();
    document.getElementById('stat-hits-pg').textContent = currentData.games > 0 ? `${(currentData.hits / currentData.games).toFixed(2)} / juego` : '-';

    // 2. Tabla de Estadísticas Detalladas
    document.getElementById('stat-b1').textContent = currentData.b1.toLocaleString();
    document.getElementById('stat-b2').textContent = currentData.b2.toLocaleString();
    document.getElementById('stat-b3').textContent = currentData.b3.toLocaleString();
    document.getElementById('stat-hr').textContent = currentData.hr.toLocaleString();
    document.getElementById('stat-bb').textContent = currentData.bb.toLocaleString();
    document.getElementById('stat-so').textContent = currentData.so.toLocaleString();
    document.getElementById('stat-hbp').textContent = currentData.hbp.toLocaleString();

    // 3. Park Factors (Igual que antes)
    const pfContainer = document.getElementById('pf-container');
    let pfHtml = '';

    if (mode === 'totals') {
        const pfYears = Object.keys(stadiumData.park_factors).map(Number).sort((a, b) => b - a);
        if (pfYears.length > 0) {
            const latestYear = pfYears[0];
            const yearData = stadiumData.park_factors[latestYear];
            if (yearData.R) pfHtml += renderPFBadge('Carreras (R)', yearData.R);
            if (yearData.HR) pfHtml += renderPFBadge('Home Runs (HR)', yearData.HR);
            pfContainer.innerHTML = `<div class="mb-2 small text-muted">PF más reciente (Serie ${latestYear})</div>` + pfHtml;
        } else {
            pfContainer.innerHTML = `<div class="alert alert-warning mb-0 py-2"><small>No hay Park Factors calculados para este estadio.</small></div>`;
        }
    } else {
        const selectedEd = document.getElementById('selectEdition').value;
        const yearData = stadiumData.park_factors[selectedEd];
        if (yearData && (yearData.R || yearData.HR)) {
            if (yearData.R) pfHtml += renderPFBadge('Carreras (R)', yearData.R);
            if (yearData.HR) pfHtml += renderPFBadge('Home Runs (HR)', yearData.HR);
            pfContainer.innerHTML = pfHtml;
        } else {
            pfContainer.innerHTML = `<div class="alert alert-warning mb-0 py-2"><small>No hay Park Factors calculados para la Serie ${selectedEd}.</small></div>`;
        }
    }

    // 4. NUEVO GRÁFICO: Terreno de Béisbol
    renderFieldChart(currentData.zones, stadiumData.stadium, yearLabel);
}

// NUEVA FUNCIÓN PARA DIBUJAR EL TERRENO Y LAS BURBUJAS
function renderFieldChart(zones, stadiumName, yearLabel) {
    const container = document.getElementById('fieldContainer');
    const legendContainer = document.getElementById('fieldLegend');
    
    // Calcular total y máximo para escalar
    const hrValues = Object.values(zones);
    const totalHR = hrValues.reduce((a, b) => a + b, 0);
    const maxCount = Math.max(...hrValues, 1); // Evitar división por 0

    if (totalHR === 0) {
        container.innerHTML = `<div class="p-5 text-center text-muted"><i class="fas fa-baseball-ball fs-1 mb-2"></i><br>No hay datos de HR para esta selección.</div>`;
        legendContainer.innerHTML = '';
        return;
    }

    let bubblesHtml = '';

    // Función para crear una burbuja
    const addBubble = (x, y, count, label) => {
        if (!count || count === 0) return;
        
        // Escalar radio entre 10 y 45 basado en la cantidad
        const radius = 10 + (count / maxCount) * 35;
        
        // Color de calor: Amarillo -> Naranja -> Rojo -> Rojo Oscuro
        const intensity = count / maxCount;
        let color = '#1A3C8A'; // Azul claro (Pocos HR)
        if (intensity > 0.75) color = '#DA291C'; // Rojo marca (Muchos HR)
        else if (intensity > 0.5) color = '#B81F14'; // Rojo oscuro
        else if (intensity > 0.25) color = '#0B2A68'; // Azul marca

        bubblesHtml += `
            <g class="hr-bubble">
                <circle cx="${x}" cy="${y}" r="${radius}" fill="${color}" opacity="0.85" stroke="#fff" stroke-width="2">
                    <title>${label}: ${count} HR</title>
                </circle>
                <text x="${x}" y="${y}" dy=".35em" text-anchor="middle" fill="#fff" font-weight="bold" font-size="${Math.max(12, radius*0.6)}px" pointer-events="none">${count}</text>
            </g>
        `;
    };

    // Mapear las zonas de la BD a coordenadas del SVG
    for (const [zone, count] of Object.entries(zones)) {
        const z = zone.toLowerCase();
        let x = 250, y = 250; // Default (Centro del Infield)

        // Coordenadas aproximadas en el SVG (500x450)
        if (z.includes('lf') && (z.includes('cf') || z.includes('rf'))) { x = 160; y = 140; }
        else if (z.includes('rf') && (z.includes('cf') || z.includes('lf'))) { x = 340; y = 140; }
        else if (z.includes('lf')) { x = 90; y = 220; }
        else if (z.includes('rf')) { x = 410; y = 220; }
        else if (z.includes('cf')) { x = 250; y = 90; }
        else if (z.includes('short') || z.includes('third')) { x = 180; y = 270; }
        else if (z.includes('second') || z.includes('first')) { x = 320; y = 270; }
        
        addBubble(x, y, count, zone);
    }

    // Dibujo SVG del estadio
    const svg = `
        <svg viewBox="0 0 500 450" class="baseball-field-svg">
            <!-- Césped del Outfield -->
            <path d="M 250 420 L 40 210 A 297 297 0 0 1 460 210 Z" fill="#2e8b57" />
            
            <!-- Línea del Outfield -->
            <path d="M 250 420 L 40 210 A 297 297 0 0 1 460 210" fill="none" stroke="#fff" stroke-width="4" />
            
            <!-- Tierra del Infield -->
            <path d="M 250 420 L 140 310 A 155 155 0 0 1 360 310 Z" fill="#cd853f" />
            
            <!-- Líneas de las Bases -->
            <path d="M 250 420 L 140 310 L 250 200 L 360 310 Z" fill="none" stroke="#fff" stroke-width="3" />
            
            <!-- Home Plate -->
            <rect x="235" y="405" width="30" height="30" transform="rotate(45 250 420)" fill="#fff" />
            <!-- 1ra Base -->
            <rect x="345" y="295" width="30" height="30" transform="rotate(45 360 310)" fill="#fff" />
            <!-- 2da Base -->
            <rect x="235" y="185" width="30" height="30" transform="rotate(45 250 200)" fill="#fff" />
            <!-- 3ra Base -->
            <rect x="125" y="295" width="30" height="30" transform="rotate(45 140 310)" fill="#fff" />
            
            <!-- Loma del Pitcher -->
            <circle cx="250" cy="310" r="22" fill="#cd853f" stroke="#fff" stroke-width="2" />
            
            <!-- Burbujas de Home Runs -->
            ${bubblesHtml}
        </svg>
    `;

    container.innerHTML = svg;
    
    // Leyenda inferior
    legendContainer.innerHTML = `
        <div><span class="badge" style="background-color: #ffc107;">&nbsp;</span> Menos HR</div>
        <div><span class="badge" style="background-color: #dc3545;">&nbsp;</span> Más HR</div>
        <div class="text-muted ms-2"><small>*Pasa el cursor sobre las burbujas para ver el número exacto.</small></div>
    `;
}

function renderPFBadge(title, pfData) {
    let color = 'bg-secondary';
    if (pfData.clasificacion.includes('Efecto')) color = 'bg-success';
    else if (pfData.clasificacion.includes('Sugerente')) color = 'bg-warning text-dark';
    else if (pfData.clasificacion.includes('Inconcluso')) color = 'bg-danger';

    return `
        <div class="mb-3">
            <p class="mb-1 text-muted small">${title}</p>
            <h4 class="mb-1">${pfData.pf_final ? pfData.pf_final.toFixed(3) : '-'}</h4>
            <span class="badge ${color}">${pfData.direccion} ${pfData.clasificacion}</span>
        </div>
    `;
}

function renderZonesChart(zones, stadiumName, yearLabel) {
    const labels = Object.keys(zones);
    const counts = Object.values(zones);

    const trace = {
        x: labels,
        y: counts,
        type: 'bar',
        text: counts.map(c => c.toString()),
        textposition: 'auto',
        marker: { color: '#0d6efd' }
    };

    const layout = {
        title: `${stadiumName} (${yearLabel})`,
        xaxis: { title: 'Zona' },
        yaxis: { title: 'Cantidad de HR' },
        margin: { t: 40, b: 40, l: 40, r: 20 }
    };

    Plotly.newPlot('zonesChart', [trace], layout, {responsive: true});
}