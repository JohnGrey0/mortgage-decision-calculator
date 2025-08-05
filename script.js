// Global variables
let balanceChart = null;
let comparisonChart = null;
let strategyChart = null;

// Initialize theme
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark'; // Default to dark mode
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

// Toggle theme
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    
    // Update charts if they exist
    if (balanceChart) updateChartTheme(balanceChart);
    if (comparisonChart) updateChartTheme(comparisonChart);
    if (strategyChart) updateChartTheme(strategyChart);
}

function updateThemeIcon(theme) {
    const themeIcon = document.querySelector('.theme-icon');
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function updateChartTheme(chart) {
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const gridColor = isDark ? '#475569' : '#e2e8f0';
    
    chart.options.plugins.legend.labels.color = textColor;
    chart.options.scales.x.ticks.color = textColor;
    chart.options.scales.y.ticks.color = textColor;
    chart.options.scales.x.grid.color = gridColor;
    chart.options.scales.y.grid.color = gridColor;
    chart.options.scales.x.title.color = textColor;
    chart.options.scales.y.title.color = textColor;
    
    chart.update();
}

// Mortgage calculation functions
function calculateMortgagePayoff(principal, rate, term, extraPayment = 0) {
    const monthlyRate = rate / 100 / 12;
    const numberOfPayments = term * 12;
    
    // Standard monthly payment (P&I only)
    const monthlyPayment = principal * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
                          (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    
    let balance = principal;
    let totalInterest = 0;
    let totalPaid = 0;
    let month = 0;
    const payoffSchedule = [];
    
    while (balance > 0.01 && month < numberOfPayments * 2) {
        const interestPayment = balance * monthlyRate;
        let principalPayment = monthlyPayment - interestPayment + extraPayment;
        
        if (principalPayment > balance) {
            principalPayment = balance;
            // For the final payment, only pay what's needed
            const finalPayment = balance + interestPayment;
            totalPaid += finalPayment;
        } else {
            totalPaid += monthlyPayment + extraPayment;
        }
        
        if (principalPayment > balance) {
            principalPayment = balance;
        }
        
        balance -= principalPayment;
        totalInterest += interestPayment;
        
        payoffSchedule.push({
            month: month + 1,
            balance: Math.max(0, balance),
            interestPayment,
            principalPayment,
            totalInterest
        });
        
        month++;
    }
    
    return {
        monthsToPayoff: month,
        totalInterest,
        totalPaid,
        monthlyPayment,
        schedule: payoffSchedule
    };
}

function calculateInvestmentGrowth(monthlyInvestment, annualReturn, months) {
    const monthlyReturn = annualReturn / 100 / 12;
    let balance = 0;
    const schedule = [];
    
    for (let month = 1; month <= months; ++month) {
        balance = balance * (1 + monthlyReturn) + monthlyInvestment;
        schedule.push({
            month,
            balance,
            totalContributions: monthlyInvestment * month,
            gains: balance - (monthlyInvestment * month)
        });
    }
    
    return {
        finalBalance: balance,
        totalValue: balance,
        totalContributions: monthlyInvestment * months,
        totalGains: balance - (monthlyInvestment * months),
        schedule
    };
}

function calculateHybridStrategy(acceleratedPayoff, extraPayment, standardTotalMonths, annualReturn) {
    // Phase 1: Interest saved from early payoff
    const remainingBalance = parseFloat(document.getElementById('remainingBalance').value);
    const interestRate = parseFloat(document.getElementById('interestRate').value);
    const remainingTerm = parseFloat(document.getElementById('remainingTerm').value);
    
    const standardPayoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingTerm, 0);
    const interestSaved = standardPayoff.totalInterest - acceleratedPayoff.totalInterest;
    
    // Phase 2: Continue investing the extra payment amount for remaining years
    const remainingMonths = standardTotalMonths - acceleratedPayoff.monthsToPayoff;
    const currentPayment = parseFloat(document.getElementById('currentPayment').value);
    
    // Calculate P&I portion of current payment
    const monthlyRate = interestRate / 100 / 12;
    const numberOfPayments = remainingTerm * 12;
    const monthlyPI = remainingBalance * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
                     (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    
    // After payoff, invest 75% of total payment + extra principal (simplified approach)
    const estimatedPI = currentPayment * 0.75;
    const totalMonthlyInvestment = estimatedPI + extraPayment;
    
    let investmentBalance = 0;
    if (remainingMonths > 0) {
        const investmentGrowth = calculateInvestmentGrowth(totalMonthlyInvestment, annualReturn, remainingMonths);
        investmentBalance = investmentGrowth.finalBalance;
    }
    
    // Total benefit = Interest saved + Investment growth
    const totalBenefit = interestSaved + investmentBalance;
    
    return {
        interestSaved,
        investmentBalance,
        totalBenefit,
        monthsToPayoff: acceleratedPayoff.monthsToPayoff,
        remainingMonths,
        totalMonthlyInvestment
    };
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(amount);
}

function formatTime(months) {
    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    
    if (years === 0) {
        return `${remainingMonths} months`;
    } else if (remainingMonths === 0) {
        return `${years} years`;
    } else {
        return `${years} years, ${remainingMonths} months`;
    }
}

function calculate() {
    const button = document.querySelector('.calculate-btn');
    button.classList.add('loading');
    
    // Get input values
    const currentPayment = parseFloat(document.getElementById('currentPayment').value);
    const extraPrincipal = parseFloat(document.getElementById('extraPrincipal').value);
    const remainingBalance = parseFloat(document.getElementById('remainingBalance').value);
    const interestRate = parseFloat(document.getElementById('interestRate').value);
    const remainingTerm = parseFloat(document.getElementById('remainingTerm').value);
    const taxRate = parseFloat(document.getElementById('taxRate').value);
    
    // Validate inputs
    if (isNaN(currentPayment) || isNaN(extraPrincipal) || 
        isNaN(remainingBalance) || isNaN(interestRate) || isNaN(remainingTerm) || isNaN(taxRate)) {
        alert('Please fill in all fields with valid numbers');
        button.classList.remove('loading');
        return;
    }
    
    // Calculate mortgage scenarios
    const standardPayoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingTerm, 0);
    const acceleratedPayoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingTerm, extraPrincipal);
    
    // Calculate investment scenarios (invest extra principal for FULL standard mortgage term)
    const weakInvestment = calculateInvestmentGrowth(extraPrincipal, 4, standardPayoff.monthsToPayoff);
    const averageInvestment = calculateInvestmentGrowth(extraPrincipal, 7, standardPayoff.monthsToPayoff);
    const strongInvestment = calculateInvestmentGrowth(extraPrincipal, 10, standardPayoff.monthsToPayoff);
    
    // Calculate hybrid strategy: Pay off early, then invest the payment amount for remaining term
    const hybridWeak = calculateHybridStrategy(acceleratedPayoff, extraPrincipal, standardPayoff.monthsToPayoff, 4);
    const hybridAverage = calculateHybridStrategy(acceleratedPayoff, extraPrincipal, standardPayoff.monthsToPayoff, 7);
    const hybridStrong = calculateHybridStrategy(acceleratedPayoff, extraPrincipal, standardPayoff.monthsToPayoff, 10);
    
    // Update summary cards
    updateSummaryCards(standardPayoff, acceleratedPayoff, weakInvestment, averageInvestment, strongInvestment, hybridWeak, hybridAverage, hybridStrong);
    
    // Update comparison table
    updateComparisonTable(standardPayoff, acceleratedPayoff, extraPrincipal);
    
    // Create charts
    createBalanceChart(standardPayoff, acceleratedPayoff);
    createStrategyChart(acceleratedPayoff, weakInvestment, averageInvestment, strongInvestment);
    createComparisonChart(acceleratedPayoff, weakInvestment, averageInvestment, strongInvestment);
    
    // Show results
    document.getElementById('resultsSection').style.display = 'block';
    document.getElementById('resultsSection').scrollIntoView({ behavior: 'smooth' });
    
    setTimeout(() => {
        button.classList.remove('loading');
    }, 500);
}

function updateSummaryCards(standard, accelerated, weak, average, strong, hybridWeak, hybridAverage, hybridStrong) {
    const timeSaved = standard.monthsToPayoff - accelerated.monthsToPayoff;
    const interestSaved = standard.totalInterest - accelerated.totalInterest;
    const taxRate = parseFloat(document.getElementById('taxRate').value);
    const extraPrincipal = parseFloat(document.getElementById('extraPrincipal').value);
    
    // Calculate remaining balance and original mortgage amount for complete picture
    const remainingBalance = parseFloat(document.getElementById('remainingBalance').value);
    const originalBalance = parseFloat(document.getElementById('originalBalance').value);
    const alreadyPaidPrincipal = originalBalance - remainingBalance;
    
    document.getElementById('timeSaved').textContent = formatTime(timeSaved);
    document.getElementById('interestSaved').textContent = formatCurrency(interestSaved);
    
    // Updated mortgage information for complete picture
    document.getElementById('totalInterestPaid').textContent = formatCurrency(accelerated.totalInterest);
    document.getElementById('totalMortgageCost').textContent = formatCurrency(originalBalance + accelerated.totalInterest);
    
    // Show hybrid strategy results (payoff early + invest remaining years)
    document.getElementById('weakReturn').textContent = formatCurrency(hybridWeak.totalBenefit);
    document.getElementById('averageReturn').textContent = formatCurrency(hybridAverage.totalBenefit);
    document.getElementById('strongReturn').textContent = formatCurrency(hybridStrong.totalBenefit);
    
    // Calculate after-tax gains for pure investment strategy
    const pureInvestmentScenarios = [
        { data: weak, id: 'pureWeakReturn' },
        { data: average, id: 'pureAverageReturn' },
        { data: strong, id: 'pureStrongReturn' }
    ];
    
    pureInvestmentScenarios.forEach(scenario => {
        // Calculate capital gains tax on investment gains
        const investmentGains = scenario.data.totalGains;
        const tax = investmentGains * (taxRate / 100);
        const afterTaxGains = investmentGains - tax;
        const totalAfterTaxValue = scenario.data.totalContributions + afterTaxGains;
        
        document.getElementById(scenario.id).textContent = formatCurrency(totalAfterTaxValue);
    });
}

function updateComparisonTable(standard, accelerated, extraPrincipal) {
    const currentDate = new Date();
    
    // Calculate payoff dates
    const standardPayoffDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + standard.monthsToPayoff, 1);
    const acceleratedPayoffDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + accelerated.monthsToPayoff, 1);
    
    // Calculate savings
    const timeSaved = standard.monthsToPayoff - accelerated.monthsToPayoff;
    const interestSaved = standard.totalInterest - accelerated.totalInterest;
    const totalSaved = standard.totalPaid - accelerated.totalPaid;
    
    // Update table cells
    document.getElementById('standardPayoffDate').textContent = standardPayoffDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
    });
    document.getElementById('extraPayoffDate').textContent = acceleratedPayoffDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
    });
    document.getElementById('timeSavedDetailed').textContent = formatTime(timeSaved);
    
    document.getElementById('standardTotalInterest').textContent = formatCurrency(standard.totalInterest);
    document.getElementById('extraTotalInterest').textContent = formatCurrency(accelerated.totalInterest);
    document.getElementById('interestSavedDetailed').textContent = formatCurrency(interestSaved);
    
    document.getElementById('standardTotalPaid').textContent = formatCurrency(standard.totalPaid);
    document.getElementById('extraTotalPaidDetailed').textContent = formatCurrency(accelerated.totalPaid);
    document.getElementById('totalSavedDetailed').textContent = formatCurrency(totalSaved);
    
    document.getElementById('standardMonthlyPI').textContent = formatCurrency(standard.monthlyPayment);
    document.getElementById('extraMonthlyPI').textContent = formatCurrency(standard.monthlyPayment + extraPrincipal);
    document.getElementById('extraPrincipalAmount').textContent = '+' + formatCurrency(extraPrincipal);
    
    document.getElementById('standardTerm').textContent = formatTime(standard.monthsToPayoff);
    document.getElementById('extraTerm').textContent = formatTime(accelerated.monthsToPayoff);
    document.getElementById('termReduction').textContent = '-' + formatTime(timeSaved);
}

function createBalanceChart(standard, accelerated) {
    const ctx = document.getElementById('balanceChart').getContext('2d');
    
    if (balanceChart) {
        balanceChart.destroy();
    }
    
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const gridColor = isDark ? '#475569' : '#e2e8f0';
    
    const maxMonths = Math.max(standard.schedule.length, accelerated.schedule.length);
    
    // Get initial balance to calculate equity
    const initialBalance = parseFloat(document.getElementById('remainingBalance').value);
    
    // Create date labels starting from current date
    const currentDate = new Date();
    const dateLabels = [];
    for (let i = 0; i < maxMonths; i++) {
        const futureDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i + 1, 1);
        dateLabels.push(futureDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short'
        }));
    }
    
    // Calculate equity data (initial balance - current balance)
    const standardEquity = standard.schedule.map(item => initialBalance - item.balance);
    const acceleratedEquity = accelerated.schedule.map(item => initialBalance - item.balance);
    
    balanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dateLabels,
            datasets: [
                {
                    label: '🏠 Standard Payment - Balance',
                    data: standard.schedule.map(item => item.balance),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.1,
                    yAxisID: 'y'
                },
                {
                    label: '⚡ With Extra Principal - Balance',
                    data: accelerated.schedule.map(item => item.balance),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.1,
                    yAxisID: 'y'
                },
                {
                    label: '💰 Standard Payment - Equity Built',
                    data: standardEquity,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    borderDash: [3, 3],
                    yAxisID: 'y'
                },
                {
                    label: '💎 With Extra Principal - Equity Built',
                    data: acceleratedEquity,
                    borderColor: '#06b6d4',
                    backgroundColor: 'rgba(6, 182, 212, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    borderDash: [3, 3],
                    yAxisID: 'y'
                },
                {
                    label: '📊 Standard Payment - Interest Paid',
                    data: standard.schedule.map(item => item.totalInterest),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    borderDash: [5, 5],
                    yAxisID: 'y1'
                },
                {
                    label: '📈 With Extra Principal - Interest Paid',
                    data: accelerated.schedule.map(item => item.totalInterest),
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1,
                    borderDash: [5, 5],
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: textColor,
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? '#334155' : '#ffffff',
                    titleColor: textColor,
                    bodyColor: textColor,
                    borderColor: gridColor,
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Date',
                        color: textColor
                    },
                    ticks: {
                        color: textColor,
                        maxTicksLimit: 12,
                        callback: function(value, index) {
                            // Show every other tick to avoid crowding
                            return index % Math.ceil(dateLabels.length / 12) === 0 ? this.getLabelForValue(value) : '';
                        }
                    },
                    grid: {
                        color: gridColor
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Remaining Balance ($)',
                        color: textColor
                    },
                    ticks: {
                        color: textColor,
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    },
                    grid: {
                        color: gridColor
                    }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    title: {
                        display: true,
                        text: 'Cumulative Interest Paid ($)',
                        color: textColor
                    },
                    ticks: {
                        color: textColor,
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    },
                    grid: {
                        drawOnChartArea: false,
                    }
                }
            }
        }
    });
}

function createStrategyChart(payoff, weak, average, strong) {
    const ctx = document.getElementById('strategyChart').getContext('2d');
    
    if (strategyChart) {
        strategyChart.destroy();
    }
    
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const gridColor = isDark ? '#475569' : '#e2e8f0';
    
    const extraPrincipal = parseFloat(document.getElementById('extraPrincipal').value);
    const remainingBalance = parseFloat(document.getElementById('remainingBalance').value);
    const interestRate = parseFloat(document.getElementById('interestRate').value);
    const remainingTerm = parseFloat(document.getElementById('remainingTerm').value);
    
    // Calculate P&I portion for fair comparison
    const monthlyRate = interestRate / 100 / 12;
    const numberOfPayments = remainingTerm * 12;
    const monthlyPI = remainingBalance * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
                     (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    
    // For fair comparison: invest only the extra principal amount vs paying extra on mortgage
    const monthlyInvestmentAmount = extraPrincipal;
    
    // Calculate standard mortgage for comparison
    const standardPayoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingTerm, 0);
    
    // Use the accelerated payoff timeline for comparison
    const timelineMonths = payoff.monthsToPayoff;
    
    // Create date labels starting from current date
    const currentDate = new Date();
    const dateLabels = [];
    for (let i = 0; i < timelineMonths; i++) {
        const futureDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i + 1, 1);
        dateLabels.push(futureDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short'
        }));
    }
    
    // Calculate net benefit over time up to accelerated payoff date
    const weakNetBenefit = [];
    const averageNetBenefit = [];
    const strongNetBenefit = [];
    const mortgageNetBenefit = [];
    
    for (let month = 1; month <= timelineMonths; month++) {
        // Calculate the TOTAL interest savings if you continue the extra payment strategy
        // This should be the final total interest saved, not the partial amount saved so far
        const totalInterestSaved = standardPayoff.totalInterest - payoff.totalInterest;
        
        // Show this total savings growing linearly over the payoff period
        const progressRatio = month / timelineMonths;
        const interestSavedSoFar = totalInterestSaved * progressRatio;
        
        // Investment values: investing only the extra principal amount each month (total value, not just gains)
        const weakInvestTotal = calculateInvestmentGrowth(monthlyInvestmentAmount, 4, month).finalBalance;
        const avgInvestTotal = calculateInvestmentGrowth(monthlyInvestmentAmount, 7, month).finalBalance;
        const strongInvestTotal = calculateInvestmentGrowth(monthlyInvestmentAmount, 10, month).finalBalance;
        
        weakNetBenefit.push(weakInvestTotal);
        averageNetBenefit.push(avgInvestTotal);
        strongNetBenefit.push(strongInvestTotal);
        mortgageNetBenefit.push(interestSavedSoFar);
    }
    
    strategyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dateLabels,
            datasets: [
                {
                    label: '🏠 Mortgage Payoff Interest Savings',
                    data: mortgageNetBenefit,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.1
                },
                {
                    label: '🐻 Invest Extra Principal (Weak 4%)',
                    data: weakNetBenefit,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1
                },
                {
                    label: '📈 Invest Extra Principal (Average 7%)',
                    data: averageNetBenefit,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1
                },
                {
                    label: '🚀 Invest Extra Principal (Strong 10%)',
                    data: strongNetBenefit,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: textColor,
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? '#334155' : '#ffffff',
                    titleColor: textColor,
                    bodyColor: textColor,
                    borderColor: gridColor,
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Date',
                        color: textColor
                    },
                    ticks: {
                        color: textColor,
                        maxTicksLimit: 12,
                        callback: function(value, index) {
                            return index % Math.ceil(dateLabels.length / 12) === 0 ? this.getLabelForValue(value) : '';
                        }
                    },
                    grid: {
                        color: gridColor
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Financial Benefit ($)',
                        color: textColor
                    },
                    ticks: {
                        color: textColor,
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    },
                    grid: {
                        color: gridColor
                    }
                }
            }
        }
    });
}

function createComparisonChart(payoff, weak, average, strong) {
    const ctx = document.getElementById('comparisonChart').getContext('2d');
    
    if (comparisonChart) {
        comparisonChart.destroy();
    }
    
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const gridColor = isDark ? '#475569' : '#e2e8f0';
    
    const extraPrincipal = parseFloat(document.getElementById('extraPrincipal').value);
    const remainingBalance = parseFloat(document.getElementById('remainingBalance').value);
    const interestRate = parseFloat(document.getElementById('interestRate').value);
    const remainingTerm = parseFloat(document.getElementById('remainingTerm').value);
    const currentPayment = parseFloat(document.getElementById('currentPayment').value);
    
    // Calculate standard mortgage for comparison
    const standardPayoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingTerm, 0);
    
    // Use only the investment timeline (from payoff date to end of standard term)
    const investmentTimelineMonths = standardPayoff.monthsToPayoff - payoff.monthsToPayoff;
    
    // Calculate P&I portion for investment phase
    const monthlyRate = interestRate / 100 / 12;
    const numberOfPayments = remainingTerm * 12;
    const monthlyPI = remainingBalance * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
                     (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    
    // Calculate total monthly investment amount (75% of total payment + extra principal)
    const estimatedPI = currentPayment * 0.75;
    const totalMonthlyInvestment = estimatedPI + extraPrincipal;
    
    // Update the chart title with investment details
    const chartTitle = document.querySelector('#comparisonChart').closest('.chart-container').querySelector('h3');
    chartTitle.innerHTML = `💰 Hybrid Strategy: Investment After Payoff`;
    
    const chartSubtitle = document.querySelector('#comparisonChart').closest('.chart-container').querySelector('.chart-subtitle');
    chartSubtitle.innerHTML = `Monthly Investment: ${formatCurrency(totalMonthlyInvestment)} (75% of Payment: ${formatCurrency(estimatedPI)} + Extra Principal: ${formatCurrency(extraPrincipal)})`;
    
    // Create date labels starting from payoff completion date
    const currentDate = new Date();
    const payoffDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + payoff.monthsToPayoff, 1);
    const dateLabels = [];
    for (let i = 0; i < investmentTimelineMonths; i++) {
        const futureDate = new Date(payoffDate.getFullYear(), payoffDate.getMonth() + i + 1, 1);
        dateLabels.push(futureDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short'
        }));
    }
    
    // Investment growth data arrays (showing only investment gains, not interest savings)
    const hybridWeakLine = [];
    const hybridAverageLine = [];
    const hybridStrongLine = [];
    
    for (let month = 1; month <= investmentTimelineMonths; month++) {
        // After payoff, invest the freed cash flow (P&I + extra principal only)
        // Note: totalMonthlyInvestment is already calculated above
        
        // Calculate investment growth starting from zero
        const weakGrowth = calculateInvestmentGrowth(totalMonthlyInvestment, 4, month);
        const avgGrowth = calculateInvestmentGrowth(totalMonthlyInvestment, 7, month);
        const strongGrowth = calculateInvestmentGrowth(totalMonthlyInvestment, 10, month);
        
        // Show total investment value (principal invested + gains)
        hybridWeakLine.push(weakGrowth.totalValue);
        hybridAverageLine.push(avgGrowth.totalValue);
        hybridStrongLine.push(strongGrowth.totalValue);
    }
    
    comparisonChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dateLabels,
            datasets: [
                {
                    label: '🐻 Total Investment Value (Weak 4%)',
                    data: hybridWeakLine,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.1
                },
                {
                    label: '📈 Total Investment Value (Average 7%)',
                    data: hybridAverageLine,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.1
                },
                {
                    label: '🚀 Total Investment Value (Strong 10%)',
                    data: hybridStrongLine,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: false,
                    tension: 0.1
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        color: textColor,
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? '#334155' : '#ffffff',
                    titleColor: textColor,
                    bodyColor: textColor,
                    borderColor: gridColor,
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Date',
                        color: textColor
                    },
                    ticks: {
                        color: textColor,
                        maxTicksLimit: 12,
                        callback: function(value, index) {
                            // Show every other tick to avoid crowding
                            return index % Math.ceil(dateLabels.length / 12) === 0 ? this.getLabelForValue(value) : '';
                        }
                    },
                    grid: {
                        color: gridColor
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Investment Gains ($)',
                        color: textColor
                    },
                    ticks: {
                        color: textColor,
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    },
                    grid: {
                        color: gridColor
                    }
                }
            }
        }
    });
}

// Add input event listeners for real-time validation
document.addEventListener('DOMContentLoaded', function() {
    initializeTheme();
    
    // Add input validation
    const inputs = document.querySelectorAll('input[type="number"]');
    inputs.forEach(input => {
        input.addEventListener('input', function() {
            if (this.value < 0) {
                this.value = 0;
            }
        });
    });
    
    // Add Enter key support
    inputs.forEach(input => {
        input.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                calculate();
            }
        });
    });
});

// Add some sample data on load for demo purposes
window.addEventListener('load', function() {
    // The HTML already has sample values, so we don't need to set them again
    console.log('Mortgage Payoff vs Investment Calculator loaded successfully!');
});
