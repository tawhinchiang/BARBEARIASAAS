// JavaScript para área administrativa - Frontend
document.addEventListener('DOMContentLoaded', function() {
    // Filtros de agendamentos
    const filterForm = document.getElementById('filterForm');
    if (filterForm) {
        filterForm.addEventListener('submit', function(e) {
            e.preventDefault();
            
            const formData = new FormData(filterForm);
            const params = new URLSearchParams();
            
            for (let [key, value] of formData.entries()) {
                if (value) {
                    params.append(key, value);
                }
            }
            
            window.location.href = `${window.location.pathname}?${params.toString()}`;
        });
    }
    
    // Atualizar status do agendamento
    document.querySelectorAll('.status-select').forEach(select => {
        select.addEventListener('change', async function() {
            const appointmentId = this.dataset.appointmentId;
            const newStatus = this.value;
            
            try {
                const response = await fetch(`/admin/appointments/${appointmentId}/status`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({ status: newStatus })
                });
                
                if (response.ok) {
                    showAlert('Status atualizado com sucesso!', 'success');
                } else {
                    showAlert('Erro ao atualizar status', 'error');
                }
            } catch (error) {
                console.error('Erro:', error);
                showAlert('Erro ao atualizar status', 'error');
            }
        });
    });
    
    // Exportar relatórios
    const exportButtons = document.querySelectorAll('.export-btn');
    exportButtons.forEach(button => {
        button.addEventListener('click', async function() {
            const format = this.dataset.format;
            const startDate = document.getElementById('startDate')?.value;
            const endDate = document.getElementById('endDate')?.value;
            const barberId = document.getElementById('barberId')?.value;
            
            // Validar datas
            if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
                showAlert('Data inicial deve ser anterior à data final', 'error');
                return;
            }
            
            // Mostrar loading
            this.disabled = true;
            this.innerHTML = '<i class="bi bi-hourglass-split"></i> Gerando...';
            
            try {
                const response = await fetch('/admin/reports/export', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        format,
                        startDate,
                        endDate,
                        barberId
                    })
                });
                
                if (response.ok) {
                    // Criar link para download
                    const blob = await response.blob();
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `relatorio-agendamentos.${format}`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(url);
                    document.body.removeChild(a);
                    
                    showAlert(`Relatório ${format.toUpperCase()} gerado com sucesso!`, 'success');
                } else {
                    const error = await response.json();
                    showAlert(error.error || 'Erro ao gerar relatório', 'error');
                }
            } catch (error) {
                console.error('Erro:', error);
                showAlert('Erro ao gerar relatório', 'error');
            } finally {
                // Restaurar botão
                this.disabled = false;
                if (format === 'pdf') {
                    this.innerHTML = '<i class="bi bi-file-pdf"></i> Exportar PDF';
                } else {
                    this.innerHTML = '<i class="bi bi-file-spreadsheet"></i> Exportar CSV';
                }
            }
        });
    });
    
    // Gráficos (se Chart.js estiver disponível)
    if (typeof Chart !== 'undefined') {
        initializeCharts();
    }
    
    // Auto-refresh do dashboard a cada 5 minutos
    if (window.location.pathname.includes('/admin/dashboard')) {
        setInterval(() => {
            location.reload();
        }, 300000); // 5 minutos
    }
});

// Função para mostrar alertas administrativos
function showAlert(message, type = 'info') {
    const alertContainer = document.getElementById('alertContainer') || createAlertContainer();
    
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type === 'error' ? 'danger' : type} alert-dismissible fade show`;
    alertDiv.innerHTML = `
        <i class="bi bi-${getAlertIcon(type)}"></i>
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    alertContainer.appendChild(alertDiv);
    
    // Auto-remover após 5 segundos
    setTimeout(() => {
        if (alertDiv.parentNode) {
            alertDiv.remove();
        }
    }, 5000);
}

// Obter ícone do alerta
function getAlertIcon(type) {
    const icons = {
        'success': 'check-circle',
        'error': 'exclamation-triangle',
        'danger': 'exclamation-triangle',
        'warning': 'exclamation-triangle',
        'info': 'info-circle'
    };
    return icons[type] || 'info-circle';
}

// Criar container de alertas se não existir
function createAlertContainer() {
    const container = document.createElement('div');
    container.id = 'alertContainer';
    container.style.position = 'fixed';
    container.style.top = '20px';
    container.style.right = '20px';
    container.style.zIndex = '9999';
    container.style.maxWidth = '400px';
    document.body.appendChild(container);
    return container;
}

// Inicializar gráficos do dashboard
function initializeCharts() {
    // Gráfico de agendamentos por status
    const statusChartCanvas = document.getElementById('statusChart');
    if (statusChartCanvas) {
        const statusData = JSON.parse(statusChartCanvas.dataset.chartData || '{}');
        
        new Chart(statusChartCanvas, {
            type: 'doughnut',
            data: {
                labels: Object.keys(statusData).map(status => getStatusText(status)),
                datasets: [{
                    data: Object.values(statusData),
                    backgroundColor: [
                        '#28a745', // Concluído
                        '#ffc107', // Agendado
                        '#17a2b8', // Confirmado
                        '#dc3545', // Cancelado
                        '#6c757d'  // Não compareceu
                    ],
                    borderWidth: 2,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((context.parsed / total) * 100).toFixed(1);
                                return `${context.label}: ${context.parsed} (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Gráfico de agendamentos por barbeiro
    const barberChartCanvas = document.getElementById('barberChart');
    if (barberChartCanvas) {
        const barberData = JSON.parse(barberChartCanvas.dataset.chartData || '{}');
        
        new Chart(barberChartCanvas, {
            type: 'bar',
            data: {
                labels: Object.keys(barberData),
                datasets: [{
                    label: 'Agendamentos',
                    data: Object.values(barberData),
                    backgroundColor: '#6f42c1',
                    borderColor: '#5a32a3',
                    borderWidth: 1,
                    borderRadius: 5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1
                        }
                    }
                },
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: function(context) {
                                return `Barbeiro: ${context[0].label}`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Gráfico de receita mensal
    const revenueChartCanvas = document.getElementById('revenueChart');
    if (revenueChartCanvas) {
        const revenueData = JSON.parse(revenueChartCanvas.dataset.chartData || '{}');
        
        new Chart(revenueChartCanvas, {
            type: 'line',
            data: {
                labels: Object.keys(revenueData),
                datasets: [{
                    label: 'Receita (R$)',
                    data: Object.values(revenueData),
                    borderColor: '#28a745',
                    backgroundColor: 'rgba(40, 167, 69, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return `Receita: ${formatCurrency(context.parsed.y)}`;
                            }
                        }
                    }
                }
            }
        });
    }
}

// Traduzir status para português
function getStatusText(status) {
    const statusMap = {
        'scheduled': 'Agendado',
        'confirmed': 'Confirmado',
        'completed': 'Concluído',
        'cancelled': 'Cancelado',
        'no_show': 'Não compareceu'
    };
    return statusMap[status] || status;
}

// Função para confirmar ações críticas
function confirmAction(message, callback) {
    if (confirm(message)) {
        callback();
    }
}

// Função para formatar moeda brasileira
function formatCurrency(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(value);
}

// Função para formatar data brasileira
function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('pt-BR');
}

// Função para formatar data e hora
function formatDateTime(dateTimeString) {
    return new Date(dateTimeString).toLocaleString('pt-BR');
}

// Filtro rápido de tabelas
function filterTable(inputId, tableId) {
    const input = document.getElementById(inputId);
    const table = document.getElementById(tableId);
    
    if (!input || !table) return;
    
    input.addEventListener('keyup', function() {
        const filter = this.value.toLowerCase();
        const rows = table.getElementsByTagName('tr');
        
        for (let i = 1; i < rows.length; i++) {
            const row = rows[i];
            const cells = row.getElementsByTagName('td');
            let found = false;
            
            for (let j = 0; j < cells.length; j++) {
                if (cells[j].textContent.toLowerCase().includes(filter)) {
                    found = true;
                    break;
                }
            }
            
            row.style.display = found ? '' : 'none';
        }
    });
}

// Exportar dados da tabela para CSV
function exportTableToCSV(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return;
    
    const rows = table.querySelectorAll('tr');
    const csvContent = [];
    
    rows.forEach(row => {
        const cells = row.querySelectorAll('th, td');
        const rowData = Array.from(cells).map(cell => {
            return `"${cell.textContent.trim().replace(/"/g, '""')}"`;
        });
        csvContent.push(rowData.join(','));
    });
    
    const blob = new Blob([csvContent.join('\n')], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename || 'dados.csv';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
}

// Atualizar contador em tempo real
function updateCounters() {
    const counters = document.querySelectorAll('[data-counter]');
    
    counters.forEach(counter => {
        const target = parseInt(counter.dataset.counter);
        const current = parseInt(counter.textContent) || 0;
        const increment = target / 100;
        
        if (current < target) {
            counter.textContent = Math.ceil(current + increment);
            setTimeout(() => updateCounters(), 20);
        } else {
            counter.textContent = target;
        }
    });
}

// Inicializar contadores animados
document.addEventListener('DOMContentLoaded', function() {
    setTimeout(updateCounters, 500);
});

