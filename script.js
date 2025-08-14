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

// Calculate remaining term based on loan start date and original term
function calculateRemainingTerm() {
    const loanStartDate = document.getElementById('loanStartDate').value;
    const originalTerm = parseFloat(document.getElementById('originalTerm').value);
    
    if (!loanStartDate || !originalTerm) {
        document.getElementById('remainingTerm').value = '';
        return null;
    }
    
    const startDate = new Date(loanStartDate + '-01'); // Add day to make it a full date
    const currentDate = new Date();
    
    // Calculate months elapsed more precisely
    let monthsElapsed = (currentDate.getFullYear() - startDate.getFullYear()) * 12 + 
                       (currentDate.getMonth() - startDate.getMonth());
    
    // If we're past the payment date in the current month, count the full month
    // Assume payments are due on the 1st of each month
    if (currentDate.getDate() >= 1) {
        // We're already counting the current month correctly
    }
    
    const totalMonths = originalTerm * 12;
    const remainingMonths = Math.max(0, totalMonths - monthsElapsed);
    const remainingYears = remainingMonths / 12;
    
    // Store the exact remaining months for calculations
    window.exactRemainingMonths = remainingMonths;
    
    // Format the display
    const years = Math.floor(remainingYears);
    const months = Math.round((remainingYears - years) * 12);
    
    let displayText = '';
    if (years > 0) {
        displayText += `${years} year${years !== 1 ? 's' : ''}`;
        if (months > 0) {
            displayText += `, ${months} month${months !== 1 ? 's' : ''}`;
        }
    } else {
        displayText = `${months} month${months !== 1 ? 's' : ''}`;
    }
    
    document.getElementById('remainingTerm').value = displayText;
    document.getElementById('remainingPayments').value = `${remainingMonths} payments`;
    
    // Calculate and display the standard payoff date
    const standardPayoffDate = formatPayoffDate(remainingMonths);
    document.getElementById('calculatedPayoffDate').value = standardPayoffDate;
    
    return remainingYears;
}

// Add event listeners for auto-calculation
document.addEventListener('DOMContentLoaded', function() {
    const loanStartDate = document.getElementById('loanStartDate');
    const originalTerm = document.getElementById('originalTerm');
    const currentPayment = document.getElementById('currentPayment');
    const remainingBalance = document.getElementById('remainingBalance');
    const interestRate = document.getElementById('interestRate');
    
    if (loanStartDate && originalTerm) {
        loanStartDate.addEventListener('change', () => {
            calculateRemainingTerm();
            updatePIVerificationCard();
        });
        originalTerm.addEventListener('input', () => {
            calculateRemainingTerm();
            updatePIVerificationCard();
        });
        
        // Calculate on page load
        calculateRemainingTerm();
    }
    
    // Update P&I verification when relevant fields change
    const originalBalanceField = document.getElementById('originalBalance');
    const originalTermField = document.getElementById('originalTerm');
    const homeValueField = document.getElementById('homeValue');
    const pmiField = document.getElementById('pmiPayment');
    
    if (originalBalanceField && interestRate && originalTermField) {
        originalBalanceField.addEventListener('input', () => {
            updatePIVerificationCard();
            calculatePMI();
        });
        interestRate.addEventListener('input', updatePIVerificationCard);
        originalTermField.addEventListener('input', updatePIVerificationCard);
        
        // Initial calculation (but don't show insight note until after calculations)
        updatePIVerificationCard();
        calculatePMI();
    }
    
    // Add PMI calculation listeners
    if (homeValueField && originalBalanceField) {
        homeValueField.addEventListener('input', calculatePMI);
    }
    
    // Mark PMI as manually entered when user types in it
    if (pmiField) {
        pmiField.addEventListener('input', function() {
            if (this.value !== '') {
                this.dataset.calculated = 'false';
            }
        });
    }
});

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
function calculateMortgagePayoff(principal, rate, term, extraPayment = 0, annualBonus = 0, userMonthlyPayment = null, homeValue = null, monthlyPMI = 0) {
    const monthlyRate = rate / 100 / 12;
    
    // Use exact remaining months if available (from date calculation), otherwise convert years to months
    const numberOfPayments = window.exactRemainingMonths !== undefined ? 
                             window.exactRemainingMonths : 
                             Math.round(term * 12);
    
    // Use user's monthly payment if provided, otherwise calculate standard monthly payment (P&I only)
    const monthlyPayment = userMonthlyPayment !== null ? userMonthlyPayment : 
                          principal * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
                          (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    
    let balance = principal;
    let totalInterest = 0;
    let totalPaid = 0;
    let month = 0;
    let totalBonusApplied = 0;
    let totalPMIPaid = 0;
    let pmiEliminated = false;
    let pmiEliminationMonth = null;
    const payoffSchedule = [];
    
    // Calculate 80% LTV threshold for PMI elimination
    const pmiEliminationBalance = homeValue ? homeValue * 0.8 : 0;
    
    while (balance > 0.01 && month < numberOfPayments * 2) {
        const interestPayment = balance * monthlyRate;
        let principalPayment = monthlyPayment - interestPayment;
        
        // Check if PMI should be eliminated this month (80% LTV reached)
        let currentMonthlyPMI = 0;
        if (monthlyPMI > 0 && homeValue && !pmiEliminated) {
            if (balance <= pmiEliminationBalance) {
                pmiEliminated = true;
                pmiEliminationMonth = month + 1;
            } else {
                currentMonthlyPMI = monthlyPMI;
            }
        }
        
        // Add monthly extra payment to principal
        let totalPrincipalPayment = principalPayment + extraPayment;
        
        // If PMI was eliminated this month or earlier, redirect PMI savings to principal
        if (pmiEliminated && monthlyPMI > 0) {
            totalPrincipalPayment += monthlyPMI; // Add former PMI payment as extra principal
        }
        
        // Apply annual bonus at the beginning of each year (month 12, 24, 36, etc.)
        let bonusThisMonth = 0;
        if (annualBonus > 0 && month > 0 && (month + 1) % 12 === 1) {
            bonusThisMonth = Math.min(annualBonus, balance - totalPrincipalPayment);
            if (bonusThisMonth > 0) {
                totalPrincipalPayment += bonusThisMonth;
                totalBonusApplied += bonusThisMonth;
            }
        }
        
        // Don't overpay - cap at remaining balance
        if (totalPrincipalPayment > balance) {
            totalPrincipalPayment = balance;
            principalPayment = balance - extraPayment - bonusThisMonth;
            if (principalPayment < 0) principalPayment = 0;
        }
        
        // Calculate actual payment amount for this month (including PMI)
        const thisMonthPayment = interestPayment + totalPrincipalPayment + currentMonthlyPMI;
        
        balance -= totalPrincipalPayment;
        totalInterest += interestPayment;
        totalPaid += thisMonthPayment;
        totalPMIPaid += currentMonthlyPMI;
        
        payoffSchedule.push({
            month: month + 1,
            balance: Math.max(0, balance),
            interestPayment,
            principalPayment: totalPrincipalPayment,
            totalInterest,
            paymentAmount: thisMonthPayment,
            bonusApplied: bonusThisMonth,
            pmiPayment: currentMonthlyPMI,
            pmiEliminated: pmiEliminated && currentMonthlyPMI === 0
        });
        
        month++;
    }
    
    return {
        monthsToPayoff: month,
        totalInterest,
        totalPaid,
        monthlyPayment,
        totalBonusApplied,
        totalPMIPaid,
        pmiEliminationMonth,
        schedule: payoffSchedule
    };
}

function calculateInvestmentGrowth(monthlyInvestment, annualReturn, months, annualBonus = 0) {
    const monthlyReturn = annualReturn / 100 / 12;
    let balance = 0;
    let totalContributions = 0;
    let totalBonusInvested = 0;
    const schedule = [];
    
    for (let month = 1; month <= months; ++month) {
        // Apply monthly growth first
        balance = balance * (1 + monthlyReturn);
        
        // Add monthly investment
        balance += monthlyInvestment;
        totalContributions += monthlyInvestment;
        
        // Apply annual bonus at the beginning of each year (month 12, 24, 36, etc.)
        let bonusThisMonth = 0;
        if (annualBonus > 0 && month > 0 && (month) % 12 === 1) {
            bonusThisMonth = annualBonus;
            balance += bonusThisMonth;
            totalContributions += bonusThisMonth;
            totalBonusInvested += bonusThisMonth;
        }
        
        schedule.push({
            month,
            balance,
            totalContributions,
            gains: balance - totalContributions,
            bonusInvested: bonusThisMonth
        });
    }
    
    return {
        finalBalance: balance,
        totalValue: balance,
        totalContributions,
        totalGains: balance - totalContributions,
        totalBonusInvested,
        schedule
    };
}

function calculateHybridStrategy(acceleratedPayoff, extraPayment, standardTotalMonths, annualReturn, annualBonus) {
    // Phase 1: Interest saved from early payoff (already calculated)
    const interestSaved = acceleratedPayoff.interestSavings || 0;
    
    // Phase 2: Continue investing for remaining years
    const remainingMonths = standardTotalMonths - acceleratedPayoff.monthsToPayoff;
    const currentPayment = parseFloat(document.getElementById('currentPayment').value);
    
    // After payoff, invest the P&I payment + extra principal that was being used
    const totalMonthlyInvestment = currentPayment + extraPayment;
    
    let investmentBalance = 0;
    if (remainingMonths > 0) {
        // Include annual bonus in investment phase
        const investmentGrowth = calculateInvestmentGrowth(totalMonthlyInvestment, annualReturn, remainingMonths, annualBonus);
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

// Calculate monthly P&I payment using standard mortgage formula
function calculateMonthlyPI(loanAmount, annualRate, termYears) {
    if (!loanAmount || !annualRate || !termYears || 
        loanAmount <= 0 || annualRate <= 0 || termYears <= 0) {
        return 0;
    }
    
    const monthlyRate = annualRate / 100 / 12;
    const numberOfPayments = termYears * 12;
    
    if (monthlyRate <= 0 || numberOfPayments <= 0) {
        return 0;
    }
    
    const monthlyPI = loanAmount * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
                     (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    
    return isFinite(monthlyPI) ? monthlyPI : 0;
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

function formatPayoffDate(monthsFromNow) {
    const currentDate = new Date();
    const payoffDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + monthsFromNow, 1);
    return payoffDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
    });
}

function calculatePMI() {
    const originalBalance = parseFloat(document.getElementById('originalBalance').value);
    const homeValue = parseFloat(document.getElementById('homeValue').value);
    const pmiField = document.getElementById('pmiPayment');
    
    if (isNaN(originalBalance) || isNaN(homeValue) || originalBalance <= 0 || homeValue <= 0) {
        pmiField.value = '';
        return;
    }
    
    // Calculate current LTV
    const currentLTV = (originalBalance / homeValue) * 100;
    
    // Only calculate PMI if LTV > 80% and field is empty (not manually entered)
    if (currentLTV > 80 && (pmiField.value === '' || pmiField.dataset.calculated === 'true')) {
        // Use 0.5% annual rate as default
        const annualPMI = originalBalance * 0.005;
        const monthlyPMI = annualPMI / 12;
        pmiField.value = monthlyPMI.toFixed(0);
        pmiField.dataset.calculated = 'true';
    } else if (currentLTV <= 80) {
        // No PMI needed if LTV is 80% or below
        pmiField.value = '0';
        pmiField.dataset.calculated = 'true';
    }
}

function calculate() {
    const button = document.querySelector('.calculate-btn');
    button.classList.add('loading');
    
    // Get input values
    const currentPayment = parseFloat(document.getElementById('currentPayment').value);
    const extraPrincipal = parseFloat(document.getElementById('extraPrincipal').value);
    const annualBonus = parseFloat(document.getElementById('annualBonus').value) || 0;
    const originalBalance = parseFloat(document.getElementById('originalBalance').value);
    const remainingBalance = parseFloat(document.getElementById('remainingBalance').value);
    const interestRate = parseFloat(document.getElementById('interestRate').value);
    const originalTerm = parseFloat(document.getElementById('originalTerm').value);
    const remainingTerm = calculateRemainingTerm(); // Get calculated remaining term in years
    const homeValue = parseFloat(document.getElementById('homeValue').value) || 0;
    const monthlyPMI = parseFloat(document.getElementById('pmiPayment').value) || 0;
    const taxRate = 20; // Hardcoded 20% capital gains tax rate
    
    // Validate inputs
    if (isNaN(currentPayment) || isNaN(extraPrincipal) || 
        isNaN(originalBalance) || isNaN(remainingBalance) || isNaN(interestRate) || 
        isNaN(originalTerm) || !remainingTerm) {
        alert('Please fill in all required fields with valid numbers and ensure loan start date is entered.');
        button.classList.remove('loading');
        return;
    }
    
    // Calculate mortgage scenarios using calculated P&I payment
    // Standard: P&I only (no PMI)
    // Accelerated: P&I + PMI + extra principal + annual bonus
    const standardPayoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingTerm, 0, 0, currentPayment, homeValue, 0);
    const acceleratedPayoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingTerm, extraPrincipal, annualBonus, currentPayment, homeValue, monthlyPMI);
    
    // Store for scenarios table to use the exact same baseline
    window.lastStandardPayoff = standardPayoff;
    window.lastStandardPayoffMonths = standardPayoff.monthsToPayoff;
    
    // Calculate interest savings and add to accelerated payoff object
    acceleratedPayoff.interestSavings = standardPayoff.totalInterest - acceleratedPayoff.totalInterest;
    
    // Calculate investment scenarios (invest extra principal + annual bonus for FULL standard mortgage term)
    const weakInvestment = calculateInvestmentGrowth(extraPrincipal, 4, standardPayoff.monthsToPayoff, annualBonus);
    const averageInvestment = calculateInvestmentGrowth(extraPrincipal, 7, standardPayoff.monthsToPayoff, annualBonus);
    const strongInvestment = calculateInvestmentGrowth(extraPrincipal, 10, standardPayoff.monthsToPayoff, annualBonus);
    
    // Calculate hybrid strategy: Pay off early, then invest the payment amount for remaining term
    const hybridWeak = calculateHybridStrategy(acceleratedPayoff, extraPrincipal, standardPayoff.monthsToPayoff, 4, annualBonus);
    const hybridAverage = calculateHybridStrategy(acceleratedPayoff, extraPrincipal, standardPayoff.monthsToPayoff, 7, annualBonus);
    const hybridStrong = calculateHybridStrategy(acceleratedPayoff, extraPrincipal, standardPayoff.monthsToPayoff, 10, annualBonus);
    
    // Update summary cards
    updateSummaryCards(standardPayoff, acceleratedPayoff, weakInvestment, averageInvestment, strongInvestment, hybridWeak, hybridAverage, hybridStrong);
    
    // Update comparison table
    updateComparisonTable(standardPayoff, acceleratedPayoff, extraPrincipal, annualBonus);
    
    // Update payment scenarios table
    // Calculate the proper P&I for scenarios (based on original loan terms)
    const scenariosPI = calculateMonthlyPI(originalBalance, interestRate, originalTerm);
    
    // Store data for toggle functionality
    window.lastScenariosData = {
        remainingBalance: remainingBalance,
        interestRate: interestRate,
        remainingTermMonths: window.exactRemainingMonths,
        currentPayment: scenariosPI
    };
    
    // Determine current mode based on active toggle
    const isbiweeklyActive = document.getElementById('biweeklyToggle') && 
                            document.getElementById('biweeklyToggle').classList.contains('active');
    const mode = isbiweeklyActive ? 'biweekly' : 'monthly';
    
    updatePaymentScenariosTable(remainingBalance, interestRate, window.exactRemainingMonths, mode, scenariosPI);
    
    // Update bi-weekly comparison
    updateBiweeklyComparison(remainingBalance, interestRate, window.exactRemainingMonths, scenariosPI, extraPrincipal);
    
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
    const currentDate = new Date();
    const interestSaved = standard.totalInterest - accelerated.totalInterest;
    const taxRate = 20; // Hardcoded 20% capital gains tax rate
    const extraPrincipal = parseFloat(document.getElementById('extraPrincipal').value);
    
    // Calculate payoff dates
    const standardPayoffDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + standard.monthsToPayoff, 1);
    const acceleratedPayoffDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + accelerated.monthsToPayoff, 1);
    
    // Calculate remaining balance and original mortgage amount for complete picture
    const remainingBalance = parseFloat(document.getElementById('remainingBalance').value);
    const originalBalance = parseFloat(document.getElementById('originalBalance').value);
    const alreadyPaidPrincipal = originalBalance - remainingBalance;
    
    // Update payoff dates instead of time saved
    document.getElementById('standardPayoffSummary').textContent = standardPayoffDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
    });
    document.getElementById('acceleratedPayoffSummary').textContent = acceleratedPayoffDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
    });
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
    
    // Update P&I verification card
    updatePIVerificationCard();
}

function updatePIVerificationCard() {
    const originalBalance = parseFloat(document.getElementById('originalBalance').value);
    const interestRate = parseFloat(document.getElementById('interestRate').value);
    const originalTerm = parseFloat(document.getElementById('originalTerm').value);
    
    if (isNaN(originalBalance) || isNaN(interestRate) || isNaN(originalTerm)) {
        // If missing values, clear the payment field
        document.getElementById('currentPayment').value = '';
        return;
    }
    
    // Calculate the P&I payment using original loan terms
    const calculatedPI = calculateMonthlyPI(originalBalance, interestRate, originalTerm);
    
    if (!calculatedPI || calculatedPI <= 0) {
        document.getElementById('currentPayment').value = '';
        return;
    }
    
    // Update the payment field
    document.getElementById('currentPayment').value = calculatedPI.toFixed(2);
}

function updateComparisonTable(standard, accelerated, extraPrincipal, annualBonus = 0) {
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
    document.getElementById('timeSavedDetailed').textContent = '+' + formatTime(timeSaved);
    
    document.getElementById('standardTotalInterest').textContent = formatCurrency(standard.totalInterest);
    document.getElementById('extraTotalInterest').textContent = formatCurrency(accelerated.totalInterest);
    document.getElementById('interestSavedDetailed').textContent = '+' + formatCurrency(interestSaved);
    
    document.getElementById('standardTotalPaid').textContent = formatCurrency(standard.totalPaid);
    document.getElementById('extraTotalPaidDetailed').textContent = formatCurrency(accelerated.totalPaid);
    document.getElementById('totalSavedDetailed').textContent = '+' + formatCurrency(totalSaved);
    
    document.getElementById('standardMonthlyPI').textContent = formatCurrency(standard.monthlyPayment);
    
    // Update extra payment description to include bonus
    const extraPaymentText = annualBonus > 0 
        ? `${formatCurrency(standard.monthlyPayment + extraPrincipal)} + ${formatCurrency(annualBonus)}/year`
        : formatCurrency(standard.monthlyPayment + extraPrincipal);
    document.getElementById('extraMonthlyPI').textContent = extraPaymentText;
    
    const extraAmountText = annualBonus > 0 
        ? `+${formatCurrency(extraPrincipal)}/mo + ${formatCurrency(annualBonus)}/yr`
        : '+' + formatCurrency(extraPrincipal);
    document.getElementById('extraPrincipalAmount').textContent = extraAmountText;
    
    // Update payoff times to show actual dates instead of time periods
    document.getElementById('standardTerm').textContent = formatPayoffDate(standard.monthsToPayoff);
    document.getElementById('extraTerm').textContent = formatPayoffDate(accelerated.monthsToPayoff);
    document.getElementById('termReduction').textContent = '+' + formatTime(timeSaved) + ' sooner';
    
    // Update remaining term information
    const originalRemainingTerm = window.exactRemainingMonths || 0;
    document.getElementById('standardRemainingTerm').textContent = formatTime(originalRemainingTerm);
    document.getElementById('extraRemainingTerm').textContent = formatTime(accelerated.monthsToPayoff);
    
    // Add bonus information if applicable
    if (annualBonus > 0 && accelerated.totalBonusApplied) {
        const bonusInfo = document.createElement('div');
        bonusInfo.className = 'bonus-info';
        bonusInfo.innerHTML = `<small style="color: #10b981; font-weight: 600;">💰 Total Bonus Applied: ${formatCurrency(accelerated.totalBonusApplied)}</small>`;
        
        // Add to the table if not already there
        const existingInfo = document.querySelector('.bonus-info');
        if (existingInfo) {
            existingInfo.remove();
        }
        document.querySelector('.comparison-table').appendChild(bonusInfo);
    }
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

function updatePaymentScenariosTable(remainingBalance, interestRate, remainingTermMonths, mode = 'monthly', currentPayment = null) {
    const scenariosBody = document.getElementById('paymentScenariosBody');
    
    // Clear existing rows
    scenariosBody.innerHTML = '';
    
    // Get current values (including PMI and annual bonus to match main calculations)
    const currentExtraPrincipal = parseFloat(document.getElementById('extraPrincipal').value) || 0;
    const annualBonus = parseFloat(document.getElementById('annualBonus').value) || 0;
    const homeValue = parseFloat(document.getElementById('homeValue').value) || 0;
    const monthlyPMI = parseFloat(document.getElementById('pmiPayment').value) || 0;
    
    const monthlyRate = interestRate / 100 / 12;
    const calculatedPI = remainingBalance * (monthlyRate * Math.pow(1 + monthlyRate, remainingTermMonths)) / 
                        (Math.pow(1 + monthlyRate, remainingTermMonths) - 1);
    
    // Use user's current payment or fall back to calculated P&I
    const monthlyPI = currentPayment || calculatedPI;
    
    // Use the standardPayoff that was already calculated in the main function
    // This ensures consistency between main table and scenarios table
    const baselinePayoff = window.lastStandardPayoff || {
        monthsToPayoff: remainingTermMonths,
        totalInterest: 0
    };
    
    // Use the remaining term from the baseline calculation (in years)
    const remainingTermYears = baselinePayoff.monthsToPayoff / 12;
    
    // Payment amounts to test (including $0 for "do nothing" scenario)
    let paymentAmounts = [0, 20, 50, 100, 150, 200, 250, 500, 1000, 1500, 2000, 2500, 3000];
    
    // Add current extra principal if it's not already in the list and is greater than 0
    if (currentExtraPrincipal > 0 && !paymentAmounts.includes(currentExtraPrincipal)) {
        paymentAmounts.push(currentExtraPrincipal);
    }
    
    // Sort the payment amounts in ascending order
    paymentAmounts.sort((a, b) => a - b);
    
    paymentAmounts.forEach(extraAmount => {
        let payoff, percentageOfPI, totalPaymentDisplay, extraPaymentDisplay;
        const isCurrentPayment = extraAmount === currentExtraPrincipal;
        
        if (mode === 'biweekly') {
            // Bi-weekly mode: convert monthly extra to bi-weekly equivalent
            const biweeklyExtraPayment = extraAmount / 2;
            const biweeklyAnnualExtra = biweeklyExtraPayment * 26;
            const monthlyEquivalentExtra = biweeklyAnnualExtra / 12;
            
            // For $0 extra: match baseline (P&I only, no PMI, no annual bonus)
            // For >$0 extra: include PMI and annual bonus
            if (extraAmount === 0) {
                payoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingTermYears, 0, 0, monthlyPI, homeValue, 0);
            } else {
                payoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingTermYears, monthlyEquivalentExtra, annualBonus, monthlyPI, homeValue, monthlyPMI);
            }
            
            percentageOfPI = ((biweeklyExtraPayment / monthlyPI) * 100).toFixed(1);
            if (extraAmount > 0) {
                totalPaymentDisplay = annualBonus > 0 
                    ? `+$${biweeklyExtraPayment.toFixed(0)} Bi-Weekly + $${annualBonus.toLocaleString()} Annually`
                    : `+$${biweeklyExtraPayment.toFixed(0)} Bi-Weekly`;
            } else {
                totalPaymentDisplay = `No Extra Payment`;
            }
            extraPaymentDisplay = isCurrentPayment ? 
                `+$${extraAmount.toLocaleString()} 👈` : 
                `+$${extraAmount.toLocaleString()}`;
        } else {
            // Monthly mode: use monthly extra as-is
            // For $0 extra: match baseline (P&I only, no PMI, no annual bonus)
            // For >$0 extra: include PMI and annual bonus
            if (extraAmount === 0) {
                payoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingTermYears, 0, 0, monthlyPI, homeValue, 0);
            } else {
                payoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingTermYears, extraAmount, annualBonus, monthlyPI, homeValue, monthlyPMI);
            }
            
            percentageOfPI = ((extraAmount / monthlyPI) * 100).toFixed(1);
            if (extraAmount > 0) {
                totalPaymentDisplay = annualBonus > 0 
                    ? `+$${extraAmount.toFixed(0)} Monthly + $${annualBonus.toLocaleString()} Annually`
                    : `+$${extraAmount.toFixed(0)} Monthly`;
            } else {
                totalPaymentDisplay = `No Extra Payment`;
            }
            extraPaymentDisplay = isCurrentPayment ? 
                `+$${extraAmount.toLocaleString()} 👈` : 
                `+$${extraAmount.toLocaleString()}`;
        }
        
        // Calculate savings compared to baseline
        const timeSaved = baselinePayoff.monthsToPayoff - payoff.monthsToPayoff;
        const interestSaved = baselinePayoff.totalInterest - payoff.totalInterest;
        const yearsSaved = Math.floor(timeSaved / 12);
        const monthsSaved = timeSaved % 12;
        
        // Create row
        const row = document.createElement('tr');
        
        // Add indicator for current payment
        const currentPaymentIndicator = isCurrentPayment ? ' 👈' : '';
            
        row.innerHTML = `
            <td>${totalPaymentDisplay}${currentPaymentIndicator}</td>
            <td>${percentageOfPI}%</td>
            <td>${formatPayoffDate(payoff.monthsToPayoff)}</td>
            <td class="time-saved">${yearsSaved > 0 ? yearsSaved + 'y ' : ''}${monthsSaved}m</td>
            <td class="interest-saved">$${interestSaved.toLocaleString(undefined, {maximumFractionDigits: 0})}</td>
        `;
        
        // Highlight current extra payment amount
        if (isCurrentPayment) {
            row.classList.add('current-payment');
        }
        
        scenariosBody.appendChild(row);
    });
}

function updateBiweeklyComparison(remainingBalance, interestRate, remainingTermMonths, currentPayment, extraPrincipal) {
    // Get annual bonus and PMI values to match main calculations
    const annualBonus = parseFloat(document.getElementById('annualBonus').value) || 0;
    const homeValue = parseFloat(document.getElementById('homeValue').value) || 0;
    const monthlyPMI = parseFloat(document.getElementById('pmiPayment').value) || 0;
    
    // Calculate monthly payment details
    const monthlyRate = interestRate / 100 / 12;
    const monthlyPI = remainingBalance * (monthlyRate * Math.pow(1 + monthlyRate, remainingTermMonths)) / 
                     (Math.pow(1 + monthlyRate, remainingTermMonths) - 1);
    
    // Use current payment or calculated P&I
    const actualMonthlyPayment = currentPayment || monthlyPI;
    
    // Calculate monthly scenario WITH user's extra payment and annual bonus (includes PMI)
    const monthlyPayoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingTermMonths / 12, extraPrincipal, annualBonus, actualMonthlyPayment, homeValue, monthlyPMI);
    
    // Bi-weekly strategy: 
    // - Keep monthly P&I payment as required by lender
    // - Replace monthly extra with bi-weekly extra payments (26 payments per year)
    // - Each bi-weekly extra payment should be half of user's monthly extra
    const biweeklyExtraPayment = extraPrincipal / 2; // Half of monthly extra, or $0 if no extra
    const biweeklyExtraAnnual = biweeklyExtraPayment * 26; // 26 bi-weekly payments
    const monthlyEquivalentExtra = biweeklyExtraAnnual / 12; // Convert bi-weekly extra to monthly equivalent
    
    // Calculate bi-weekly scenario (monthly P&I + equivalent monthly extra from bi-weekly payments, includes PMI and annual bonus)
    const biweeklyPayoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingTermMonths / 12, monthlyEquivalentExtra, annualBonus, actualMonthlyPayment, homeValue, monthlyPMI);
    
    // Update monthly strategy display (WITH user's extra payment)
    const totalMonthlyPayment = actualMonthlyPayment + extraPrincipal;
    document.getElementById('monthlyPaymentAmount').textContent = extraPrincipal > 0 ? 
        `${formatCurrency(actualMonthlyPayment)} + ${formatCurrency(extraPrincipal)} extra` : 
        formatCurrency(actualMonthlyPayment);
    document.getElementById('monthlyAnnualTotal').textContent = formatCurrency(totalMonthlyPayment * 12);
    document.getElementById('monthlyPayoffTime').textContent = formatPayoffDate(monthlyPayoff.monthsToPayoff);
    document.getElementById('monthlyTotalInterest').textContent = formatCurrency(monthlyPayoff.totalInterest);
    
    // Update bi-weekly strategy display
    const totalBiweeklyAnnual = (actualMonthlyPayment * 12) + biweeklyExtraAnnual; // P&I + bi-weekly extra (no monthly extra)
    const biweeklyDescription = biweeklyExtraPayment > 0 ? 
        `${formatCurrency(actualMonthlyPayment)} + ${formatCurrency(biweeklyExtraPayment)} bi-weekly` :
        formatCurrency(actualMonthlyPayment);
    
    document.getElementById('biweeklyPaymentAmount').textContent = biweeklyDescription;
    document.getElementById('biweeklyAnnualTotal').textContent = formatCurrency(totalBiweeklyAnnual);
    document.getElementById('biweeklyPayoffTime').textContent = formatPayoffDate(biweeklyPayoff.monthsToPayoff);
    document.getElementById('biweeklyTotalInterest').textContent = formatCurrency(biweeklyPayoff.totalInterest);
    
    // Calculate savings (bi-weekly vs monthly with extra)
    const timeSaved = monthlyPayoff.monthsToPayoff - biweeklyPayoff.monthsToPayoff;
    const interestSaved = monthlyPayoff.totalInterest - biweeklyPayoff.totalInterest;
    
    // Update savings display
    document.getElementById('biweeklyTimeSaved').textContent = formatTime(timeSaved);
    document.getElementById('biweeklyInterestSaved').textContent = formatCurrency(interestSaved);
    document.getElementById('biweeklyEquivalentExtra').textContent = formatCurrency(biweeklyExtraAnnual / 12);
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
    
    // Add toggle functionality for payment scenarios
    const monthlyToggle = document.getElementById('monthlyToggle');
    const biweeklyToggle = document.getElementById('biweeklyToggle');
    
    if (monthlyToggle && biweeklyToggle) {
        monthlyToggle.addEventListener('click', function() {
            monthlyToggle.classList.add('active');
            biweeklyToggle.classList.remove('active');
            
            // Re-run scenarios in monthly mode if we have data
            if (window.lastScenariosData) {
                updatePaymentScenariosTable(
                    window.lastScenariosData.remainingBalance,
                    window.lastScenariosData.interestRate,
                    window.lastScenariosData.remainingTermMonths,
                    'monthly',
                    window.lastScenariosData.currentPayment
                );
            }
        });
        
        biweeklyToggle.addEventListener('click', function() {
            biweeklyToggle.classList.add('active');
            monthlyToggle.classList.remove('active');
            
            // Re-run scenarios in bi-weekly mode if we have data
            if (window.lastScenariosData) {
                updatePaymentScenariosTable(
                    window.lastScenariosData.remainingBalance,
                    window.lastScenariosData.interestRate,
                    window.lastScenariosData.remainingTermMonths,
                    'biweekly',
                    window.lastScenariosData.currentPayment
                );
            }
        });
    }
});

// Tooltip functionality
function showTooltip(type) {
    try {
        const modal = document.getElementById('tooltip-modal');
        const title = document.getElementById('tooltip-title');
        const body = document.getElementById('tooltip-body');
        
        // Get current values for calculations
        const originalBalance = parseFloat(document.getElementById('originalBalance').value) || 0;
        const remainingBalance = parseFloat(document.getElementById('remainingBalance').value) || 0;
        const interestRate = parseFloat(document.getElementById('interestRate').value) || 0;
        const homeValue = parseFloat(document.getElementById('homeValue').value) || 0;
        const originalTerm = parseFloat(document.getElementById('originalTerm').value) || 0;
        const loanStartDate = document.getElementById('loanStartDate').value;
        const extraPrincipal = parseFloat(document.getElementById('extraPrincipal').value) || 0;
        const annualBonus = parseFloat(document.getElementById('annualBonus').value) || 0;
        
        // Calculate some derived values
        const monthlyRate = interestRate / 100 / 12;
        const totalPayments = originalTerm * 12;
        const monthlyPI = originalBalance > 0 && interestRate > 0 && originalTerm > 0 
            ? calculateMonthlyPI(originalBalance, interestRate, originalTerm) 
            : 0;
        
        // Use the actual PMI value from the field (whether calculated or manually entered)
        const actualMonthlyPMI = parseFloat(document.getElementById('pmiPayment').value) || 0;
        
        // Calculate what the auto-calculated PMI would be for comparison
        const originalLTV = originalBalance > 0 && homeValue > 0 ? (originalBalance / homeValue) * 100 : 0;
        const autoCalculatedPMI = originalLTV > 80 ? (originalBalance * 0.005) / 12 : 0;
        const pmiThreshold = homeValue * 0.8;
        
        // Check if PMI was manually entered
        const pmiField = document.getElementById('pmiPayment');
        const isManuallyEntered = pmiField.dataset.calculated !== 'true' && pmiField.value !== '';
        
        let content = '';
        
        switch(type) {
        case 'mortgage-details':
            title.textContent = '🏡 Mortgage Details - How Values Are Used';
            content = `
                <div class="calculation-section">
                    <h5>📐 Monthly P&I Payment Formula</h5>
                    <div class="formula">M = P × [r(1+r)ⁿ] / [(1+r)ⁿ-1]</div>
                    <p><strong>Where:</strong></p>
                    <ul>
                        <li><strong>M</strong> = Monthly Payment</li>
                        <li><strong>P</strong> = Principal (loan amount)</li>
                        <li><strong>r</strong> = Monthly interest rate</li>
                        <li><strong>n</strong> = Total number of payments</li>
                    </ul>
                </div>
                
                <div class="calculation-section">
                    <h5>🏠 PMI Calculation</h5>
                    <div class="formula">Monthly PMI = (Home Value × 0.005) ÷ 12</div>
                    <p>PMI eliminates when: Remaining Balance ≤ 80% of Home Value</p>
                </div>
                
                <div class="current-values">
                    <h6>🔢 Your Current Values:</h6>
                    <ul class="value-list">
                        <li><span>Original Loan Amount (P):</span> <strong>$${originalBalance.toLocaleString()}</strong></li>
                        <li><span>Monthly Interest Rate (r):</span> <strong>${(monthlyRate * 100).toFixed(4)}%</strong></li>
                        <li><span>Total Payments (n):</span> <strong>${totalPayments} months</strong></li>
                        <li><span>Monthly P&I Payment:</span> <strong>$${monthlyPI.toLocaleString()}</strong></li>
                        <li><span>Home Value:</span> <strong>$${homeValue.toLocaleString()}</strong></li>
                        <li><span>PMI Elimination Threshold:</span> <strong>$${pmiThreshold.toLocaleString()}</strong></li>
                        <li><span>Current Remaining Balance:</span> <strong>$${remainingBalance.toLocaleString()}</strong></li>
                    </ul>
                </div>
            `;
            break;
            
        case 'calculated-values':
            let startDate, monthsElapsed, remainingMonths;
            
            if (loanStartDate) {
                startDate = new Date(loanStartDate + '-01');
                const currentDate = new Date();
                monthsElapsed = (currentDate.getFullYear() - startDate.getFullYear()) * 12 + 
                                    (currentDate.getMonth() - startDate.getMonth());
                remainingMonths = Math.max(0, totalPayments - monthsElapsed);
            } else {
                monthsElapsed = 0;
                remainingMonths = totalPayments;
            }
            
            title.textContent = '🔢 Calculated Values - Auto-Computation Details';
            content = `
                <div class="calculation-section">
                    <h5>⏱️ Remaining Term Calculation</h5>
                    <div class="formula">Remaining Term = (Original Term × 12) - Months Elapsed</div>
                    <div class="formula">Remaining Payments = Remaining Months</div>
                    <p>Months elapsed calculated from loan start date to current date.</p>
                </div>
                
                <div class="calculation-section">
                    <h5>💰 Monthly P&I Calculation</h5>
                    <div class="formula">Uses original loan terms with mortgage payment formula</div>
                    <p>Based on original loan amount, interest rate, and term - not current balance.</p>
                </div>
                
                <div class="calculation-section">
                    <h5>🏠 PMI Calculation</h5>
                    <div class="formula">Auto-calculated: (Original Loan Amount × 0.5%) ÷ 12</div>
                    <p>Auto-eliminates when balance drops to 80% of home value, but you can override with actual PMI.</p>
                    <p><em>Current field shows: ${isManuallyEntered ? 'Manually entered value' : 'Auto-calculated value'}</em></p>
                </div>
                
                <div class="current-values">
                    <h6>🔢 Your Calculated Values:</h6>
                    <ul class="value-list">
                        <li><span>Loan Start Date:</span> <strong>${loanStartDate || 'Not set'}</strong></li>
                        <li><span>Months Elapsed:</span> <strong>${monthsElapsed} months</strong></li>
                        <li><span>Remaining Payments:</span> <strong>${remainingMonths} payments</strong></li>
                        <li><span>Remaining Term:</span> <strong>${remainingMonths} months (${(remainingMonths/12).toFixed(1)} years)</strong></li>
                        <li><span>Monthly P&I Payment:</span> <strong>$${monthlyPI.toLocaleString()}</strong></li>
                        <li><span>Original LTV:</span> <strong>${originalLTV.toFixed(1)}%</strong></li>
                        <li><span>Current Monthly PMI:</span> <strong>$${actualMonthlyPMI.toLocaleString()}</strong></li>
                        <li><span>Auto-calculated PMI would be:</span> <strong>$${Math.round(autoCalculatedPMI).toLocaleString()}</strong></li>
                        <li><span>PMI Entry Type:</span> <strong>${isManuallyEntered ? 'Manual' : 'Auto-calculated'}</strong></li>
                        <li><span>PMI Status:</span> <strong>${remainingBalance <= pmiThreshold ? 'Should eliminate when balance ≤ 80% LTV' : 'Active (LTV > 80%)'}</strong></li>
                    </ul>
                </div>
            `;
            break;
            
        case 'payment-info':
            title.textContent = '💰 Payment Info - Extra Payment Logic';
            content = `
                <div class="calculation-section">
                    <h5>📅 Monthly Overpayment Processing</h5>
                    <p>Applied directly to principal each month, reducing balance faster and shortening loan term.</p>
                    <div class="formula">New Balance = Previous Balance - (Regular Principal + Extra Principal)</div>
                </div>
                
                <div class="calculation-section">
                    <h5>🎯 Annual Lump Sum Processing</h5>
                    <p>Applied once per year in January as additional principal payment.</p>
                    <div class="formula">January Balance = December Balance - Annual Lump Sum</div>
                </div>
                
                <div class="calculation-section">
                    <h5>🔄 PMI Reinvestment Feature</h5>
                    <p>When PMI is eliminated (balance ≤ 80% LTV), former PMI payments automatically become additional principal.</p>
                    <div class="formula">New Monthly Extra = Original Extra + Former PMI Payment</div>
                </div>
                
                <div class="current-values">
                    <h6>🔢 Your Payment Settings:</h6>
                    <ul class="value-list">
                        <li><span>Monthly Overpayment:</span> <strong>$${extraPrincipal.toLocaleString()}</strong></li>
                        <li><span>Annual Lump Sum:</span> <strong>$${annualBonus.toLocaleString()}</strong></li>
                        <li><span>Current Monthly PMI:</span> <strong>$${actualMonthlyPMI.toLocaleString()}</strong></li>
                        <li><span>PMI Reinvestment Benefit:</span> <strong>+$${actualMonthlyPMI.toLocaleString()}/month when eliminated</strong></li>
                    </ul>
                </div>
            `;
            break;
            
        case 'methodology':
            title.textContent = '📋 Calculation Methodology - Algorithm Overview';
            content = `
                <div class="calculation-section">
                    <h5>🔄 Month-by-Month Simulation</h5>
                    <p>The calculator runs detailed simulations for each scenario, processing each month individually.</p>
                    <div class="formula">For each month: New Balance = Previous Balance - Principal Payment</div>
                    <div class="formula">Interest Payment = Previous Balance × Monthly Rate</div>
                </div>
                
                <div class="calculation-section">
                    <h5>📈 Investment Growth Formulas</h5>
                    <p><strong>Lump Sum Growth:</strong></p>
                    <div class="formula">FV = PV × (1 + r)ⁿ</div>
                    <p><strong>Regular Contributions (Annuity):</strong></p>
                    <div class="formula">FV = PMT × [((1 + r)ⁿ - 1) ÷ r]</div>
                </div>
                
                <div class="calculation-section">
                    <h5>🏠 PMI Elimination Tracking</h5>
                    <p>The calculator tracks balance vs. home value ratio each month.</p>
                    <div class="formula">PMI Eliminates when: Balance ≤ (Home Value × 0.80)</div>
                    <p>After elimination, former PMI payments automatically become extra principal.</p>
                </div>
                
                <div class="current-values">
                    <h6>🔢 Your Simulation Parameters:</h6>
                    <ul class="value-list">
                        <li><span>Starting Balance:</span> <strong>$${remainingBalance.toLocaleString()}</strong></li>
                        <li><span>Monthly Interest Rate:</span> <strong>${(monthlyRate * 100).toFixed(4)}%</strong></li>
                        <li><span>Monthly P&I Payment:</span> <strong>$${monthlyPI.toLocaleString()}</strong></li>
                        <li><span>Monthly PMI:</span> <strong>$${actualMonthlyPMI.toLocaleString()}</strong></li>
                        <li><span>PMI Elimination Threshold:</span> <strong>$${pmiThreshold.toLocaleString()}</strong></li>
                        <li><span>Simulation Length:</span> <strong>${originalTerm} years (${totalPayments} months)</strong></li>
                    </ul>
                </div>
            `;
            break;
            
        case 'payoff-strategy':
            title.textContent = '🏠 Mortgage Payoff Strategy - Calculation Details';
            content = `
                <div class="calculation-section">
                    <h5>📊 Standard vs Accelerated Comparison</h5>
                    <p>Compares standard payment schedule against accelerated payments with extra principal.</p>
                    <div class="formula">Interest Saved = Standard Total Interest - Accelerated Total Interest</div>
                </div>
                
                <div class="calculation-section">
                    <h5>⚡ Acceleration Factors</h5>
                    <p>Multiple factors accelerate payoff:</p>
                    <ul>
                        <li>Monthly extra principal payments</li>
                        <li>Annual lump sum payments</li>
                        <li>PMI reinvestment (when eliminated)</li>
                    </ul>
                </div>
                
                <div class="current-values">
                    <h6>🔢 Your Payoff Acceleration:</h6>
                    <ul class="value-list">
                        <li><span>Standard Monthly Payment:</span> <strong>$${(monthlyPI + actualMonthlyPMI).toLocaleString()}</strong></li>
                        <li><span>Your Monthly Overpayment:</span> <strong>$${extraPrincipal.toLocaleString()}</strong></li>
                        <li><span>Annual Lump Sum:</span> <strong>$${annualBonus.toLocaleString()}</strong></li>
                        <li><span>Future PMI Reinvestment:</span> <strong>+$${actualMonthlyPMI.toLocaleString()}/month</strong></li>
                        <li><span>Total Monthly Payment (after PMI ends):</span> <strong>$${(monthlyPI + extraPrincipal + actualMonthlyPMI).toLocaleString()}</strong></li>
                    </ul>
                </div>
            `;
            break;
            
        case 'hybrid-strategy':
            title.textContent = '📈 Hybrid Investment Strategy - Dual Benefit Calculation';
            content = `
                <div class="calculation-section">
                    <h5>🎯 Two-Phase Strategy</h5>
                    <p><strong>Phase 1:</strong> Accelerate mortgage payoff to save interest</p>
                    <p><strong>Phase 2:</strong> Invest freed payment amount for remaining loan term</p>
                </div>
                
                <div class="calculation-section">
                    <h5>💰 Total Investment Amount</h5>
                    <div class="formula">Monthly Investment = P&I + PMI + Extra Payments</div>
                    <p>Invested from payoff date until original loan maturity date.</p>
                </div>
                
                <div class="calculation-section">
                    <h5>📈 Final Calculation</h5>
                    <div class="formula">Total Benefit = Interest Saved + Investment Growth</div>
                </div>
                
                <div class="current-values">
                    <h6>🔢 Your Hybrid Strategy:</h6>
                    <ul class="value-list">
                        <li><span>Monthly Investment Amount:</span> <strong>$${(monthlyPI + actualMonthlyPMI + extraPrincipal).toLocaleString()}</strong></li>
                        <li><span>Investment Period:</span> <strong>From payoff until original maturity</strong></li>
                        <li><span>Combined with Interest Savings:</span> <strong>Interest saved + compound growth</strong></li>
                    </ul>
                </div>
            `;
            break;
            
        case 'pure-investment':
            title.textContent = '📊 Pure Investment Strategy - Alternative Comparison';
            content = `
                <div class="calculation-section">
                    <h5>💸 Investment vs Extra Payments</h5>
                    <p>Instead of extra mortgage payments, invest the same amounts monthly.</p>
                    <div class="formula">Monthly Investment = Extra Principal + Annual Bonus ÷ 12</div>
                </div>
                
                <div class="calculation-section">
                    <h5>⚖️ Net Calculation</h5>
                    <div class="formula">Net Benefit = Investment Growth - Additional Interest Paid</div>
                    <p>Since you're not paying extra principal, you pay more interest over the loan term.</p>
                </div>
                
                <div class="current-values">
                    <h6>🔢 Your Investment Strategy:</h6>
                    <ul class="value-list">
                        <li><span>Monthly Investment:</span> <strong>$${(extraPrincipal + (annualBonus / 12)).toLocaleString()}</strong></li>
                        <li><span>Investment Period:</span> <strong>${originalTerm} years (full loan term)</strong></li>
                        <li><span>Trade-off:</span> <strong>Investment growth vs. extra interest paid</strong></li>
                    </ul>
                </div>
            `;
            break;
            
        case 'scenarios':
            title.textContent = '💸 Extra Payment Scenarios - Impact Analysis';
            content = `
                <div class="calculation-section">
                    <h5>📊 Scenario Methodology</h5>
                    <p><strong>Baseline:</strong> Standard P&I payment only (no PMI, no extra payments)</p>
                    <p><strong>Extra Payment Scenarios:</strong> P&I + PMI + Extra Principal + Annual Bonus</p>
                    <div class="formula">Savings = Baseline Interest - Scenario Interest</div>
                </div>
                
                <div class="calculation-section">
                    <h5>🏠 PMI Handling</h5>
                    <p>PMI is included in extra payment calculations and automatically eliminates when loan balance reaches 80% of home value.</p>
                    <div class="formula">PMI Drops Off When: Remaining Balance ≤ ${(homeValue * 0.8).toLocaleString()}</div>
                </div>
                
                <div class="calculation-section">
                    <h5>📈 Percentage of P&I</h5>
                    <p>Shows extra payments as percentage of your base P&I payment for easy comparison.</p>
                    <div class="formula">Percentage = (Extra Payment ÷ Monthly P&I) × 100</div>
                </div>
                
                <div class="current-values">
                    <h6>🔢 Your Current Calculation:</h6>
                    <ul class="value-list">
                        <li><span>Monthly P&I Payment:</span> <strong>$${monthlyPI.toLocaleString()}</strong></li>
                        <li><span>Monthly PMI:</span> <strong>$${actualMonthlyPMI.toLocaleString()}</strong></li>
                        <li><span>Current Extra Payment:</span> <strong>$${extraPrincipal.toLocaleString()}</strong></li>
                        <li><span>Annual Bonus Payment:</span> <strong>$${annualBonus.toLocaleString()}</strong></li>
                        <li><span>Total Monthly (with extra):</span> <strong>$${(monthlyPI + actualMonthlyPMI + extraPrincipal).toLocaleString()}</strong></li>
                        <li><span>PMI Elimination Threshold:</span> <strong>$${(homeValue * 0.8).toLocaleString()}</strong></li>
                    </ul>
                </div>
            `;
            break;
            
        case 'biweekly':
            title.textContent = '📅 Bi-Weekly Strategy - Payment Frequency Impact';
            content = `
                <div class="calculation-section">
                    <h5>🗓️ Payment Schedule</h5>
                    <p>Bi-weekly payments create 26 payments per year (every 2 weeks).</p>
                    <div class="formula">26 payments ÷ 12 months = 2.17 extra monthly payments/year</div>
                </div>
                
                <div class="calculation-section">
                    <h5>⚡ Acceleration Effect</h5>
                    <p>The extra 2.17 payments significantly reduce principal and shorten loan term.</p>
                    <div class="formula">Annual Extra = Bi-weekly Amount × 2.17</div>
                </div>
                
                <div class="current-values">
                    <h6>🔢 Bi-Weekly Impact:</h6>
                    <ul class="value-list">
                        <li><span>Payment Frequency:</span> <strong>Every 2 weeks (26/year)</strong></li>
                        <li><span>Equivalent Extra Monthly:</span> <strong>2.17 payments/year</strong></li>
                        <li><span>Your Current Extra:</span> <strong>$${extraPrincipal.toLocaleString()}/month</strong></li>
                        <li><span>Bi-weekly Equivalent:</span> <strong>$${(extraPrincipal / 2.17).toLocaleString()} every 2 weeks</strong></li>
                    </ul>
                </div>
            `;
            break;
    }
    
    body.innerHTML = content;
    modal.classList.add('show');
    } catch (error) {
        console.error('Error showing tooltip for type:', type);
        console.error('Error details:', error);
        console.error('Values:', {
            originalBalance,
            remainingBalance,
            interestRate,
            homeValue,
            originalTerm,
            loanStartDate,
            extraPrincipal,
            annualBonus
        });
        
        // Fallback - still show the modal with an error message
        const modal = document.getElementById('tooltip-modal');
        const title = document.getElementById('tooltip-title');
        const body = document.getElementById('tooltip-body');
        
        title.textContent = 'Error Loading Explanation';
        body.innerHTML = `<p>Sorry, there was an error loading the detailed explanation for "${type}". Check the console for details.</p>`;
        modal.classList.add('show');
    }
}

function hideTooltip() {
    const modal = document.getElementById('tooltip-modal');
    modal.classList.remove('show');
}

// Add some sample data on load for demo purposes
window.addEventListener('load', function() {
    // The HTML already has sample values, so we don't need to set them again
    console.log('Mortgage Payoff vs Investment Calculator loaded successfully!');
});
