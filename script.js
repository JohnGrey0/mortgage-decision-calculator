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
    if (currentPayment && remainingBalance && interestRate) {
        currentPayment.addEventListener('input', updatePIVerificationCard);
        remainingBalance.addEventListener('input', updatePIVerificationCard);
        interestRate.addEventListener('input', updatePIVerificationCard);
        
        // Initial calculation (but don't show insight note until after calculations)
        updatePIVerificationCard();
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
function calculateMortgagePayoff(principal, rate, term, extraPayment = 0, annualBonus = 0, userMonthlyPayment = null) {
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
    const payoffSchedule = [];
    
    while (balance > 0.01 && month < numberOfPayments * 2) {
        const interestPayment = balance * monthlyRate;
        let principalPayment = monthlyPayment - interestPayment;
        
        // Add monthly extra payment to principal
        let totalPrincipalPayment = principalPayment + extraPayment;
        
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
        
        // Calculate actual payment amount for this month
        const thisMonthPayment = interestPayment + totalPrincipalPayment;
        
        balance -= totalPrincipalPayment;
        totalInterest += interestPayment;
        totalPaid += thisMonthPayment;
        
        payoffSchedule.push({
            month: month + 1,
            balance: Math.max(0, balance),
            interestPayment,
            principalPayment: totalPrincipalPayment,
            totalInterest,
            paymentAmount: thisMonthPayment,
            bonusApplied: bonusThisMonth
        });
        
        month++;
    }
    
    return {
        monthsToPayoff: month,
        totalInterest,
        totalPaid,
        monthlyPayment,
        totalBonusApplied,
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

// Validate that user's P&I input is reasonable
function validatePIPayment(userPayment, balance, rate, term) {
    // Check for invalid inputs first
    if (!userPayment || !balance || !rate || !term || 
        userPayment <= 0 || balance <= 0 || rate <= 0 || term <= 0) {
        return {
            calculatedPI: 0,
            difference: 0,
            percentDifference: 0,
            isReasonable: true // Skip validation if inputs are invalid
        };
    }
    
    const monthlyRate = rate / 100 / 12;
    const numberOfPayments = term * 12;
    
    // Check for edge cases that could cause division by zero
    if (monthlyRate <= 0 || numberOfPayments <= 0) {
        return {
            calculatedPI: 0,
            difference: 0,
            percentDifference: 0,
            isReasonable: true
        };
    }
    
    const calculatedPI = balance * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
                        (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    
    // Check if calculation resulted in a valid number
    if (!calculatedPI || calculatedPI <= 0 || !isFinite(calculatedPI)) {
        return {
            calculatedPI: 0,
            difference: 0,
            percentDifference: 0,
            isReasonable: true
        };
    }
    
    const difference = Math.abs(userPayment - calculatedPI);
    const percentDifference = (difference / calculatedPI) * 100;
    
    return {
        calculatedPI,
        difference,
        percentDifference,
        isReasonable: percentDifference < 15 // Allow 15% variance for rounding, different terms, etc.
    };
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
    const annualBonus = parseFloat(document.getElementById('annualBonus').value) || 0;
    const remainingBalance = parseFloat(document.getElementById('remainingBalance').value);
    const interestRate = parseFloat(document.getElementById('interestRate').value);
    const remainingTerm = calculateRemainingTerm(); // Get calculated remaining term in years
    const taxRate = 20; // Hardcoded 20% capital gains tax rate
    
    // Validate inputs
    if (isNaN(currentPayment) || isNaN(extraPrincipal) || 
        isNaN(remainingBalance) || isNaN(interestRate) || !remainingTerm) {
        alert('Please fill in all required fields with valid numbers and ensure loan start date is entered.');
        button.classList.remove('loading');
        return;
    }
    
    // Validate P&I payment is reasonable
    const piValidation = validatePIPayment(currentPayment, remainingBalance, interestRate, remainingTerm);
    
    // Only show validation warning if we have a valid calculated P&I and it's significantly different
    if (!piValidation.isReasonable && piValidation.calculatedPI > 0) {
        const message = `⚠️ P&I Payment Check:\nYour entered payment: ${formatCurrency(currentPayment)}\nCalculated P&I: ${formatCurrency(piValidation.calculatedPI)}\nDifference: ${piValidation.percentDifference.toFixed(1)}%\n\nThis seems like a large difference. Please verify your P&I payment amount.\n\nClick OK to continue anyway, or Cancel to review your inputs.`;
        if (!confirm(message)) {
            button.classList.remove('loading');
            return;
        }
    }
    
    // Calculate mortgage scenarios using user's actual P&I payment
    const standardPayoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingTerm, 0, 0, currentPayment);
    const acceleratedPayoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingTerm, extraPrincipal, annualBonus, currentPayment);
    
    // Store for P&I verification note
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
    const taxRate = 20; // Hardcoded 20% capital gains tax rate
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
    
    // Update P&I verification card
    updatePIVerificationCard();
}

function updatePIVerificationCard() {
    const currentPayment = parseFloat(document.getElementById('currentPayment').value);
    const remainingBalance = parseFloat(document.getElementById('remainingBalance').value);
    const interestRate = parseFloat(document.getElementById('interestRate').value);
    const remainingTerm = calculateRemainingTerm(); // Get calculated remaining term in years
    
    if (!remainingTerm || isNaN(currentPayment) || isNaN(remainingBalance) || isNaN(interestRate)) {
        // If we can't calculate remaining term or missing values, show placeholder
        document.getElementById('userPIPayment').textContent = '-';
        document.getElementById('calculatedPIPayment').textContent = '-';
        document.getElementById('piDifference').textContent = 'Complete all fields';
        return;
    }
    
    // Calculate the theoretical P&I payment
    const monthlyRate = interestRate / 100 / 12;
    const numberOfPayments = remainingTerm * 12;
    const calculatedPI = remainingBalance * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
                        (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
    
    // Calculate difference
    const difference = currentPayment - calculatedPI;
    const percentDifference = ((difference / calculatedPI) * 100);
    
    // Update the UI
    document.getElementById('userPIPayment').textContent = formatCurrency(currentPayment);
    document.getElementById('calculatedPIPayment').textContent = formatCurrency(calculatedPI);
    
    let differenceText = formatCurrency(Math.abs(difference));
    if (Math.abs(percentDifference) < 2) {
        // Small difference - very normal
        differenceText = `${formatCurrency(Math.abs(difference))} (${Math.abs(percentDifference).toFixed(1)}%)`;
        document.getElementById('piDifference').textContent = differenceText;
        document.getElementById('piDifference').style.color = '#22c55e'; // Green for normal difference
        document.getElementById('piDifference').className = 'difference-normal';
    } else if (difference > 0) {
        differenceText = `+${differenceText} (${percentDifference.toFixed(1)}%)`;
        document.getElementById('piDifference').textContent = differenceText;
        document.getElementById('piDifference').style.color = '#f59e0b'; // Orange for higher
        document.getElementById('piDifference').className = 'difference-higher';
    } else if (difference < 0) {
        differenceText = `-${differenceText} (${Math.abs(percentDifference).toFixed(1)}%)`;
        document.getElementById('piDifference').textContent = differenceText;
        document.getElementById('piDifference').style.color = '#f59e0b'; // Orange for lower
        document.getElementById('piDifference').className = 'difference-lower';
    } else {
        differenceText = 'Perfect match!';
        document.getElementById('piDifference').textContent = differenceText;
        document.getElementById('piDifference').style.color = '#22c55e'; // Green for exact match
        document.getElementById('piDifference').className = 'difference-perfect';
    }
    
    // Add explanatory note if there's a significant time difference between calculated term and actual payoff
    // Only show this after calculations have been run
    const timeDifferenceMonths = window.exactRemainingMonths && window.lastStandardPayoffMonths ? 
                                Math.abs(window.exactRemainingMonths - window.lastStandardPayoffMonths) : 0;
    
    if (timeDifferenceMonths >= 6 && window.lastStandardPayoffMonths) {
        const noteElement = document.getElementById('piExplanationNote') || 
                           (() => {
                               const note = document.createElement('div');
                               note.id = 'piExplanationNote';
                               note.className = 'pi-explanation-note';
                               return note;
                           })();
        
        const monthsDiff = Math.round(timeDifferenceMonths);
        const isPayingFaster = window.exactRemainingMonths > (window.lastStandardPayoffMonths || 0);
        
        if (isPayingFaster) {
            noteElement.innerHTML = `
                <div class="note-header">💡 Payment Insight</div>
                <div class="note-text">Your actual payment pays off the loan ~${monthsDiff} months faster than the original schedule. 
                This is normal - lenders often round payments up slightly, creating a built-in acceleration effect.</div>
            `;
            
            // Ensure note is in the verification metrics container
            const container = document.querySelector('.verification-metrics');
            if (container && !container.contains(noteElement)) {
                container.appendChild(noteElement);
            }
        }
    } else {
        // Remove note if difference is small
        const existingNote = document.getElementById('piExplanationNote');
        if (existingNote) existingNote.remove();
    }
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
    document.getElementById('timeSavedDetailed').textContent = formatTime(timeSaved);
    
    document.getElementById('standardTotalInterest').textContent = formatCurrency(standard.totalInterest);
    document.getElementById('extraTotalInterest').textContent = formatCurrency(accelerated.totalInterest);
    document.getElementById('interestSavedDetailed').textContent = formatCurrency(interestSaved);
    
    document.getElementById('standardTotalPaid').textContent = formatCurrency(standard.totalPaid);
    document.getElementById('extraTotalPaidDetailed').textContent = formatCurrency(accelerated.totalPaid);
    document.getElementById('totalSavedDetailed').textContent = formatCurrency(totalSaved);
    
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
    
    document.getElementById('standardTerm').textContent = formatTime(standard.monthsToPayoff);
    document.getElementById('extraTerm').textContent = formatTime(accelerated.monthsToPayoff);
    document.getElementById('termReduction').textContent = '-' + formatTime(timeSaved);
    
    // Show the original calculated remaining term
    const originalRemainingTerm = window.exactRemainingMonths || 0;
    document.getElementById('originalRemainingTerm').textContent = formatTime(originalRemainingTerm);
    
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
