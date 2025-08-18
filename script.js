// Global variables
let balanceChart = null;
let comparisonChart = null;
let strategyChart = null;
let pureInvestmentChart = null;
let combinedStrategyChart = null;

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
        document.getElementById('remainingPayments').value = '';
        document.getElementById('calculatedPayoffDate').value = '';
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
    
    // Format the display for standard remaining term
    const years = Math.floor(remainingYears);
    const months = Math.round((remainingYears - years) * 12);
    
    let standardDisplayText = '';
    if (years > 0) {
        standardDisplayText += `${years} year${years !== 1 ? 's' : ''}`;
        if (months > 0) {
            standardDisplayText += `, ${months} month${months !== 1 ? 's' : ''}`;
        }
    } else {
        standardDisplayText = `${months} month${months !== 1 ? 's' : ''}`;
    }
    
    // Calculate standard maturity date
    const standardMaturityDate = formatPayoffDate(remainingMonths);
    
    // Check if we can detect previous extra payments in real-time
    const remainingBalance = parseFloat(document.getElementById('remainingBalance').value);
    const interestRate = parseFloat(document.getElementById('interestRate').value);
    const currentPayment = parseFloat(document.getElementById('currentPayment').value);
    
    // If we have the required data, calculate actual vs standard
    if (!isNaN(remainingBalance) && !isNaN(interestRate) && !isNaN(currentPayment) && 
        remainingBalance > 0 && interestRate > 0 && currentPayment > 0) {
        
        // Calculate what the actual payoff would be based on current balance
        const actualPayoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingYears, 0, 0, currentPayment);
        
        // If actual payoff is shorter than standard, they've made previous extra payments
        if (actualPayoff.monthsToPayoff < remainingMonths) {
            // Store actual remaining months for payment comparison table
            window.actualRemainingMonths = actualPayoff.monthsToPayoff;
            
            // Format actual remaining term
            const actualYears = Math.floor(actualPayoff.monthsToPayoff / 12);
            const actualRemainingMonths = actualPayoff.monthsToPayoff % 12;
            
            let actualDisplayText = '';
            if (actualYears > 0) {
                actualDisplayText += `${actualYears} year${actualYears !== 1 ? 's' : ''}`;
                if (actualRemainingMonths > 0) {
                    actualDisplayText += `, ${actualRemainingMonths} month${actualRemainingMonths !== 1 ? 's' : ''}`;
                }
            } else {
                actualDisplayText = `${actualRemainingMonths} month${actualRemainingMonths !== 1 ? 's' : ''}`;
            }
            
            // Calculate actual maturity date
            const actualMaturityDate = formatPayoffDate(actualPayoff.monthsToPayoff);
            
            // Display in "standard / actual" format
            document.getElementById('remainingTerm').value = `${standardDisplayText} / ${actualDisplayText}`;
            document.getElementById('remainingPayments').value = `${remainingMonths} / ${actualPayoff.monthsToPayoff} payments`;
            document.getElementById('calculatedPayoffDate').value = `${standardMaturityDate} / ${actualMaturityDate}`;
            
            return remainingYears;
        } else {
            // Clear actual remaining months if no previous extra payments detected
            window.actualRemainingMonths = undefined;
        }
    }
    
    // Default: show only standard values
    document.getElementById('remainingTerm').value = standardDisplayText;
    document.getElementById('remainingPayments').value = `${remainingMonths} payments`;
    document.getElementById('calculatedPayoffDate').value = standardMaturityDate;
    
    return remainingYears;
}

// Update calculated fields to show both original and current values when previous extra payments detected
function updateCalculatedFieldsWithPreviousPayments(standardPayoff) {
    if (!standardPayoff.hasAlreadyMadeExtraPayments) {
        return; // No changes needed if no previous extra payments detected
    }
    
    // Get the original standard values (based on loan start date and original term)
    const originalStandardMonths = standardPayoff.monthsToOriginalMaturity;
    const actualCurrentMonths = standardPayoff.monthsToPayoff;
    
    // Format original standard remaining term
    const originalYears = Math.floor(originalStandardMonths / 12);
    const originalMonths = originalStandardMonths % 12;
    let originalDisplayText = '';
    if (originalYears > 0) {
        originalDisplayText += `${originalYears} year${originalYears !== 1 ? 's' : ''}`;
        if (originalMonths > 0) {
            originalDisplayText += `, ${originalMonths} month${originalMonths !== 1 ? 's' : ''}`;
        }
    } else {
        originalDisplayText = `${originalMonths} month${originalMonths !== 1 ? 's' : ''}`;
    }
    
    // Format actual current remaining term
    const actualYears = Math.floor(actualCurrentMonths / 12);
    const actualMonths = actualCurrentMonths % 12;
    let actualDisplayText = '';
    if (actualYears > 0) {
        actualDisplayText += `${actualYears} year${actualYears !== 1 ? 's' : ''}`;
        if (actualMonths > 0) {
            actualDisplayText += `, ${actualMonths} month${actualMonths !== 1 ? 's' : ''}`;
        }
    } else {
        actualDisplayText = `${actualMonths} month${actualMonths !== 1 ? 's' : ''}`;
    }
    
    // Calculate maturity dates
    const currentDate = new Date();
    const originalMaturityDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + originalStandardMonths, 1);
    const actualMaturityDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + actualCurrentMonths, 1);
    
    // Update the fields to show both values in "standard / actual" format
    document.getElementById('remainingTerm').value = `${originalDisplayText} / ${actualDisplayText}`;
    
    document.getElementById('remainingPayments').value = `${originalStandardMonths} / ${actualCurrentMonths} payments`;
    
    document.getElementById('calculatedPayoffDate').value = `${originalMaturityDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })} / ${actualMaturityDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}`;
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
    
    // Add real-time listeners for remaining balance and interest rate to trigger comparison updates
    if (remainingBalance) {
        remainingBalance.addEventListener('input', calculateRemainingTerm);
    }
    if (interestRate) {
        interestRate.addEventListener('input', calculateRemainingTerm);
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
    
    // Update charts if they exist - all will now update immediately
    if (balanceChart) updateChartTheme(balanceChart);
    if (comparisonChart) updateChartTheme(comparisonChart);
    if (strategyChart) updateChartTheme(strategyChart);
    if (pureInvestmentChart) updateChartTheme(pureInvestmentChart);
    if (combinedStrategyChart) updateChartTheme(combinedStrategyChart);
}

function updateThemeIcon(theme) {
    const themeIcon = document.querySelector('.theme-icon');
    themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
}

function updateChartTheme(chart) {
    // More robust theme detection
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const isDark = currentTheme === 'dark';
    
    // Explicit color assignment
    let textColor, gridColor;
    if (isDark) {
        textColor = '#f1f5f9';  // Light text for dark theme
        gridColor = '#475569';  // Medium gray for dark theme
    } else {
        textColor = '#1e293b';  // Dark text for light theme  
        gridColor = '#e2e8f0';  // Light gray for light theme
    }
    
    // Update legend
    if (chart.options.plugins && chart.options.plugins.legend && chart.options.plugins.legend.labels) {
        chart.options.plugins.legend.labels.color = textColor;
    }
    
    // Update title
    if (chart.options.plugins && chart.options.plugins.title && chart.options.plugins.title.display) {
        chart.options.plugins.title.color = textColor;
    }
    
    // Update tooltip colors
    if (chart.options.plugins && chart.options.plugins.tooltip) {
        chart.options.plugins.tooltip.backgroundColor = isDark ? '#334155' : '#ffffff';
        chart.options.plugins.tooltip.titleColor = textColor;
        chart.options.plugins.tooltip.bodyColor = textColor;
        chart.options.plugins.tooltip.borderColor = gridColor;
    }
    
    // Update all scales (x, y, y1, etc.)
    if (chart.options.scales) {
        Object.keys(chart.options.scales).forEach(scaleKey => {
            const scale = chart.options.scales[scaleKey];
            if (scale) {
                // Update ticks color
                if (scale.ticks) {
                    scale.ticks.color = textColor;
                }
                // Update grid color
                if (scale.grid) {
                    scale.grid.color = gridColor;
                }
                // Update title color
                if (scale.title) {
                    scale.title.color = textColor;
                }
            }
        });
    }
    
    // Force immediate and complete update
    chart.update('none'); // Update the configuration
    chart.render();       // Force complete redraw
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
        
        // Apply annual bonus at the beginning of each year (month 1, 13, 25, etc. = January)
        let bonusThisMonth = 0;
        if (annualBonus > 0 && month > 0 && (month) % 12 === 1) {
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

// Calculate historical payments made when previous extra payments are detected
function calculateHistoricalPayments(originalBalance, currentBalance, interestRate, originalTerm, loanStartDate) {
    if (!loanStartDate || !originalBalance || !currentBalance) {
        return { historicalInterest: 0, historicalTotal: 0, monthsElapsed: 0 };
    }
    
    const startDate = new Date(loanStartDate);
    const currentDate = new Date();
    const monthsElapsed = Math.round((currentDate - startDate) / (1000 * 60 * 60 * 24 * 30.44));
    
    if (monthsElapsed <= 0) {
        return { historicalInterest: 0, historicalTotal: 0, monthsElapsed: 0 };
    }
    
    // Calculate what the standard amortization schedule would have been
    const monthlyRate = interestRate / 100 / 12;
    const totalPayments = originalTerm * 12;
    const standardMonthlyPayment = originalBalance * (monthlyRate * Math.pow(1 + monthlyRate, totalPayments)) / 
                                  (Math.pow(1 + monthlyRate, totalPayments) - 1);
    
    // Simulate standard amortization for the elapsed months
    let balance = originalBalance;
    let totalInterestPaid = 0;
    let totalPaid = 0;
    
    for (let month = 0; month < Math.min(monthsElapsed, totalPayments) && balance > 0.01; month++) {
        const interestPayment = balance * monthlyRate;
        const principalPayment = standardMonthlyPayment - interestPayment;
        
        balance -= principalPayment;
        totalInterestPaid += interestPayment;
        totalPaid += standardMonthlyPayment;
    }
    
    // If the current balance is lower than what standard amortization would predict,
    // estimate the additional principal payments made
    const predictedBalance = balance;
    if (currentBalance < predictedBalance) {
        const extraPrincipalMade = predictedBalance - currentBalance;
        totalPaid += extraPrincipalMade;
    }
    
    return { 
        historicalInterest: totalInterestPaid, 
        historicalTotal: totalPaid, 
        monthsElapsed,
        standardBalance: predictedBalance,
        extraPrincipalMade: Math.max(0, predictedBalance - currentBalance)
    };
}

// Helper function to get historical-adjusted totals for display
function getHistoricalAdjustedTotals(payoffData) {
    const loanStartDate = document.getElementById('loanStartDate').value;
    const originalBalance = parseFloat(document.getElementById('originalBalance').value);
    const remainingBalance = parseFloat(document.getElementById('remainingBalance').value);
    const interestRate = parseFloat(document.getElementById('interestRate').value);
    const originalTerm = parseFloat(document.getElementById('originalTerm').value);
    
    // If no loan start date, return future-only totals
    if (!loanStartDate || !originalBalance || !remainingBalance) {
        return {
            totalInterest: payoffData.totalInterest,
            totalPaid: payoffData.totalPaid,
            hasHistorical: false
        };
    }
    
    // Calculate historical payments
    const historical = calculateHistoricalPayments(
        originalBalance, 
        remainingBalance, 
        interestRate, 
        originalTerm, 
        loanStartDate
    );
    
    // If no meaningful elapsed time, return future-only totals
    if (historical.monthsElapsed <= 0) {
        return {
            totalInterest: payoffData.totalInterest,
            totalPaid: payoffData.totalPaid,
            hasHistorical: false
        };
    }
    
    // Return totals including historical payments
    return {
        totalInterest: historical.historicalInterest + payoffData.totalInterest,
        totalPaid: historical.historicalTotal + payoffData.totalPaid,
        hasHistorical: true,
        monthsElapsed: historical.monthsElapsed
    };
}

// Helper function to get historical-adjusted interest savings
function getHistoricalAdjustedInterestSavings(baselinePayoff, acceleratedPayoff) {
    const baselineTotals = getHistoricalAdjustedTotals(baselinePayoff);
    const acceleratedTotals = getHistoricalAdjustedTotals(acceleratedPayoff);
    
    return baselineTotals.totalInterest - acceleratedTotals.totalInterest;
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

function calculateDynamicTaxRate(holdingPeriodMonths, annualIncome = null) {
    // Default to median household income if not provided
    const estimatedAnnualIncome = annualIncome || 70000;
    
    // Short-term capital gains (< 12 months) = ordinary income tax rates
    if (holdingPeriodMonths < 12) {
        if (estimatedAnnualIncome <= 11000) return 10;
        if (estimatedAnnualIncome <= 44725) return 12;
        if (estimatedAnnualIncome <= 95375) return 22;
        if (estimatedAnnualIncome <= 182050) return 24;
        if (estimatedAnnualIncome <= 231250) return 32;
        if (estimatedAnnualIncome <= 578125) return 35;
        return 37; // Highest bracket
    }
    
    // Long-term capital gains (≥ 12 months)
    if (estimatedAnnualIncome <= 44625) return 0;  // 0% bracket
    if (estimatedAnnualIncome <= 492300) return 15; // 15% bracket
    return 20; // 20% bracket for high earners
}

function getEstimatedIncomeFromMortgage() {
    // Rough estimate based on mortgage payment (general rule: housing should be ~28% of gross income)
    const currentPayment = parseFloat(document.getElementById('currentPayment').value) || 0;
    const monthlyPMI = parseFloat(document.getElementById('pmiPayment').value) || 0;
    const totalHousingPayment = currentPayment + monthlyPMI + 500; // Add estimated taxes/insurance
    
    // Assume housing is 28% of gross income
    const estimatedMonthlyIncome = totalHousingPayment / 0.28;
    const estimatedAnnualIncome = estimatedMonthlyIncome * 12;
    
    // Cap at reasonable bounds
    return Math.min(Math.max(estimatedAnnualIncome, 40000), 500000);
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

function calculate(autoRun = false) {
    const button = document.querySelector('.calculate-btn');
    
    // Only show loading animation if this is a user-initiated calculation
    if (!autoRun) {
        button.classList.add('loading');
    }
    
    // Get input values
    const currentPayment = parseFloat(document.getElementById('currentPayment').value);
    const extraPrincipal = parseFloat(document.getElementById('extraPrincipal').value);
    const annualBonus = parseFloat(document.getElementById('annualBonus').value) || 0;
    const originalBalance = parseFloat(document.getElementById('originalBalance').value);
    const remainingBalance = parseFloat(document.getElementById('remainingBalance').value);
    const interestRate = parseFloat(document.getElementById('interestRate').value);
    const originalTerm = parseFloat(document.getElementById('originalTerm').value);
    const remainingTerm = calculateRemainingTerm(); // Get calculated remaining term in years
    const loanStartDate = document.getElementById('loanStartDate').value;
    const homeValue = parseFloat(document.getElementById('homeValue').value) || 0;
    const monthlyPMI = parseFloat(document.getElementById('pmiPayment').value) || 0;
    const taxRate = 20; // Hardcoded 20% capital gains tax rate
    
    // Validate inputs
    if (isNaN(currentPayment) || isNaN(extraPrincipal) || 
        isNaN(originalBalance) || isNaN(remainingBalance) || isNaN(interestRate) || 
        isNaN(originalTerm) || !remainingTerm) {
        alert('Please fill in all required fields with valid numbers and ensure loan start date is entered.');
        if (!autoRun) {
            button.classList.remove('loading');
        }
        return;
    }
    
    // Calculate mortgage scenarios using calculated P&I payment
    // Standard: Shows what happens if they continue P&I-only from current remaining balance
    // Accelerated: Current remaining loan with P&I + PMI + extra principal + annual bonus
    
    // Calculate standard payoff based on current remaining balance (P&I only, no PMI, no extras)
    // This accounts for any previous extra payments they may have made
    const standardPayoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingTerm, 0, 0, currentPayment, homeValue, 0);
    
    // Compare this to what the original loan maturity would have been
    const startDate = new Date(loanStartDate + '-01');
    const originalMaturityDate = new Date(startDate);
    originalMaturityDate.setFullYear(originalMaturityDate.getFullYear() + originalTerm);
    const currentDate = new Date();
    const monthsToOriginalMaturity = (originalMaturityDate.getFullYear() - currentDate.getFullYear()) * 12 + 
                                    (originalMaturityDate.getMonth() - currentDate.getMonth());
    
    // If their current standard payoff is earlier than original maturity, they've already made extra payments
    const hasAlreadyMadeExtraPayments = standardPayoff.monthsToPayoff < monthsToOriginalMaturity;
    
    // Store both dates for reference
    standardPayoff.originalMaturityDate = originalMaturityDate;
    standardPayoff.hasAlreadyMadeExtraPayments = hasAlreadyMadeExtraPayments;
    standardPayoff.monthsToOriginalMaturity = Math.max(0, monthsToOriginalMaturity);
    
    // Update calculated fields to show both original and current values if previous payments detected
    updateCalculatedFieldsWithPreviousPayments(standardPayoff);
    
    // For accelerated calculation: if no extra payments, use same as standard for fair comparison
    const acceleratedPayoff = (extraPrincipal === 0 && annualBonus === 0) ? 
        standardPayoff : 
        calculateMortgagePayoff(remainingBalance, interestRate, remainingTerm, extraPrincipal, annualBonus, currentPayment, homeValue, monthlyPMI);
    
    // Store for scenarios table to use the exact same baseline
    window.lastStandardPayoff = standardPayoff;
    window.lastStandardPayoffMonths = standardPayoff.monthsToPayoff;
    
    // Calculate interest savings using historical-adjusted totals and add to accelerated payoff object
    acceleratedPayoff.interestSavings = getHistoricalAdjustedInterestSavings(standardPayoff, acceleratedPayoff);
    
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

    // Use actual remaining months if previous extra payments detected, otherwise use standard
    const remainingMonthsForComparison = window.actualRemainingMonths !== undefined ? 
                                        window.actualRemainingMonths : 
                                        window.exactRemainingMonths;

    updatePaymentScenariosTable(remainingBalance, interestRate, remainingMonthsForComparison, mode, scenariosPI);
    
    // Update bi-weekly comparison using actual remaining months if available
    updateBiweeklyComparison(remainingBalance, interestRate, remainingMonthsForComparison, scenariosPI, extraPrincipal);
    
    // Create charts
    createBalanceChart(standardPayoff, acceleratedPayoff);
    createCombinedStrategyChart(acceleratedPayoff, standardPayoff, weakInvestment, averageInvestment, strongInvestment);
    
    // Results are now always visible in tab structure
    // Switch to summary tab automatically after calculation (only for manual calculations)
    if (!autoRun) {
        setTimeout(() => {
            const summaryTabBtn = document.querySelector('[onclick*="summaryTab"]');
            if (summaryTabBtn) {
                summaryTabBtn.click();
            }
        }, 100);
    }
    
    // Only remove loading state if it was added (not during auto-run)
    if (!autoRun) {
        setTimeout(() => {
            button.classList.remove('loading');
        }, 500);
    }
}

function updateSummaryCards(standard, accelerated, weak, average, strong, hybridWeak, hybridAverage, hybridStrong) {
    const currentDate = new Date();
    
    // Get loan details for historical calculation
    const originalBalance = parseFloat(document.getElementById('originalBalance').value);
    const remainingBalance = parseFloat(document.getElementById('remainingBalance').value);
    const interestRate = parseFloat(document.getElementById('interestRate').value);
    const originalTerm = parseFloat(document.getElementById('originalTerm').value);
    const loanStartDate = document.getElementById('loanStartDate').value;
    
    // Calculate interest saved (always accounting for historical payments if loan start date exists)
    // Use the same baseline as scenarios table for consistency
    const baselineStandard = window.lastStandardPayoff || standard;
    let interestSaved = baselineStandard.totalInterest - accelerated.totalInterest;
    
    if (loanStartDate && originalBalance && remainingBalance) {
        // Calculate historical payments for anyone who has been paying their mortgage
        const historical = calculateHistoricalPayments(
            originalBalance, 
            remainingBalance, 
            interestRate, 
            originalTerm, 
            loanStartDate
        );
        
        // Only adjust interest saved calculation if there's meaningful elapsed time
        if (historical.monthsElapsed > 0) {
            // Use the same historical-adjusted calculation as scenarios table
            interestSaved = getHistoricalAdjustedInterestSavings(baselineStandard, accelerated);
        }
    }
    
    const taxRate = 20; // Hardcoded 20% capital gains tax rate
    const extraPrincipal = parseFloat(document.getElementById('extraPrincipal').value);
    
    // Calculate maturity dates
    const standardMaturityDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + standard.monthsToPayoff, 1);
    const acceleratedMaturityDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + accelerated.monthsToPayoff, 1);
    
    // Calculate already paid principal for complete picture
    const alreadyPaidPrincipal = originalBalance - remainingBalance;
    
    // Update maturity dates instead of time saved
    if (standard.hasAlreadyMadeExtraPayments) {
        // Show both original and current standard maturity dates
        const originalMaturityDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + standard.monthsToOriginalMaturity, 1);
        document.getElementById('standardPayoffSummary').innerHTML = `
            <div style="font-size: 0.9em;">
                <div><strong>Current Standard:</strong><br>${standardMaturityDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</div>
                <div style="margin-top: 6px; padding: 4px 8px; background: var(--surface-color); border-radius: 4px; border-left: 3px solid var(--warning-color);">
                    <div style="font-size: 0.85em; color: var(--warning-color); font-weight: 600;">Original Schedule:</div>
                    <div style="color: var(--text-primary); font-weight: 500;">${originalMaturityDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</div>
                </div>
            </div>
        `;
    } else {
        document.getElementById('standardPayoffSummary').textContent = standardMaturityDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long' 
        });
    }
    document.getElementById('acceleratedPayoffSummary').textContent = acceleratedMaturityDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
    });
    document.getElementById('interestSaved').textContent = formatCurrency(interestSaved);
    
    // Calculate total interest and mortgage cost displays (always including historical if loan start date exists)
    let totalInterestDisplay = accelerated.totalInterest;
    let totalMortgageCostDisplay = originalBalance + accelerated.totalInterest;
    
    if (loanStartDate && originalBalance && remainingBalance) {
        // Always calculate historical payments for anyone with a loan start date
        const historical = calculateHistoricalPayments(
            originalBalance, 
            remainingBalance, 
            interestRate, 
            originalTerm, 
            loanStartDate
        );
        
        // Include historical payments if there's meaningful elapsed time
        if (historical.monthsElapsed > 0) {
            totalInterestDisplay = historical.historicalInterest + accelerated.totalInterest;
            totalMortgageCostDisplay = historical.historicalTotal + accelerated.totalPaid;
        }
    }
    
    // Updated mortgage information for complete picture
    document.getElementById('totalInterestPaid').textContent = formatCurrency(totalInterestDisplay);
    document.getElementById('totalMortgageCost').textContent = formatCurrency(totalMortgageCostDisplay);
    
    // Show hybrid strategy results (payoff early + invest remaining years) with after-tax calculations
    const hybridScenarios = [
        { data: hybridWeak, id: 'weakReturn' },
        { data: hybridAverage, id: 'averageReturn' },
        { data: hybridStrong, id: 'strongReturn' }
    ];
    
    const estimatedIncome = getEstimatedIncomeFromMortgage();
    
    hybridScenarios.forEach(scenario => {
        // Interest saved is tax-free, but apply capital gains tax to investment portion
        const interestSaved = scenario.data.interestSaved;
        const investmentGrowth = calculateInvestmentGrowth(scenario.data.totalMonthlyInvestment, 
            scenario.data === hybridWeak ? 4 : (scenario.data === hybridAverage ? 7 : 10), 
            scenario.data.remainingMonths, annualBonus);
        
        // Use dynamic tax rate based on investment holding period
        const dynamicTaxRate = calculateDynamicTaxRate(scenario.data.remainingMonths, estimatedIncome);
        const investmentGains = investmentGrowth.totalGains;
        const tax = investmentGains * (dynamicTaxRate / 100);
        const afterTaxInvestmentValue = investmentGrowth.totalContributions + (investmentGains - tax);
        const totalAfterTaxBenefit = interestSaved + afterTaxInvestmentValue;
        
        document.getElementById(scenario.id).textContent = formatCurrency(totalAfterTaxBenefit);
    });
    
    // Calculate after-tax gains for pure investment strategy with dynamic tax rates
    const pureInvestmentScenarios = [
        { data: weak, id: 'pureWeakReturn' },
        { data: average, id: 'pureAverageReturn' },
        { data: strong, id: 'pureStrongReturn' }
    ];
    
    pureInvestmentScenarios.forEach(scenario => {
        // Calculate capital gains tax on investment gains using dynamic rate
        // Use the schedule length from the investment data itself
        const investmentPeriodMonths = scenario.data.schedule ? scenario.data.schedule.length : 360; // fallback to 30 years
        const fullTermTaxRate = calculateDynamicTaxRate(investmentPeriodMonths, estimatedIncome);
        const investmentGains = scenario.data.totalGains;
        const tax = investmentGains * (fullTermTaxRate / 100);
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
    
    // Calculate maturity dates
    const standardMaturityDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + standard.monthsToPayoff, 1);
    const acceleratedMaturityDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + accelerated.monthsToPayoff, 1);
    
    // Calculate savings using historical-adjusted totals
    const timeSaved = standard.monthsToPayoff - accelerated.monthsToPayoff;
    const standardTotals = getHistoricalAdjustedTotals(standard);
    const acceleratedTotals = getHistoricalAdjustedTotals(accelerated);
    const interestSaved = standardTotals.totalInterest - acceleratedTotals.totalInterest;
    const totalSaved = standardTotals.totalPaid - acceleratedTotals.totalPaid;
    
    // Update table cells
    if (standard.hasAlreadyMadeExtraPayments) {
        // Show both current standard and original maturity dates
        const originalMaturityDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + standard.monthsToOriginalMaturity, 1);
        document.getElementById('standardPayoffDate').innerHTML = `
            <div>
                <div><strong>${standardMaturityDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</strong></div>
                <div style="margin-top: 4px; padding: 2px 6px; background: var(--surface-color); border-radius: 3px; display: inline-block;">
                    <span style="font-size: 0.8em; color: var(--warning-color); font-weight: 600;">Original:</span>
                    <span style="font-size: 0.8em; color: var(--text-primary); font-weight: 500; margin-left: 4px;">${originalMaturityDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}</span>
                </div>
            </div>
        `;
    } else {
        document.getElementById('standardPayoffDate').textContent = standardMaturityDate.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long' 
        });
    }
    document.getElementById('extraPayoffDate').textContent = acceleratedMaturityDate.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long' 
    });
    document.getElementById('timeSavedDetailed').textContent = '+' + formatTime(timeSaved);
    
    document.getElementById('standardTotalInterest').textContent = formatCurrency(standardTotals.totalInterest);
    document.getElementById('extraTotalInterest').textContent = formatCurrency(acceleratedTotals.totalInterest);
    
    document.getElementById('standardTotalPaid').textContent = formatCurrency(standardTotals.totalPaid);
    document.getElementById('extraTotalPaidDetailed').textContent = formatCurrency(acceleratedTotals.totalPaid);
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
        const existingBonusInfo = document.querySelector('.bonus-info');
        if (existingBonusInfo) {
            existingBonusInfo.remove();
        }
        document.querySelector('.comparison-table').appendChild(bonusInfo);
    }
    
    // Add information about previous extra payments if detected
    if (standard.hasAlreadyMadeExtraPayments) {
        const previousPaymentsInfo = document.createElement('div');
        previousPaymentsInfo.className = 'previous-payments-info';
        const monthsSavedAlready = standard.monthsToOriginalMaturity - standard.monthsToPayoff;
        previousPaymentsInfo.innerHTML = `<small style="color: #3b82f6; font-weight: 600;">📈 Previous Extra Payments Detected: Already ${formatTime(monthsSavedAlready)} ahead of original schedule</small>`;
        
        // Add to the table if not already there
        const existingPreviousInfo = document.querySelector('.previous-payments-info');
        if (existingPreviousInfo) {
            existingPreviousInfo.remove();
        }
        document.querySelector('.comparison-table').appendChild(previousPaymentsInfo);
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
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: '⚡ With Extra Principal - Balance',
                    data: accelerated.schedule.map(item => item.balance),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: '💰 Standard Payment - Equity Built',
                    data: standardEquity,
                    borderColor: '#8b5cf6',
                    backgroundColor: 'rgba(139, 92, 246, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4,
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
                    tension: 0.4,
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
                    tension: 0.4,
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
                    tension: 0.4,
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
    const annualBonus = parseFloat(document.getElementById('annualBonus').value) || 0;
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
    
    // Calculate net benefit over time up to accelerated maturity
    const weakNetBenefit = [];
    const averageNetBenefit = [];
    const strongNetBenefit = [];
    const mortgageNetBenefit = [];
    
    for (let month = 1; month <= timelineMonths; month++) {
        // Calculate the TOTAL interest savings using historical-adjusted totals
        const totalInterestSaved = getHistoricalAdjustedInterestSavings(standardPayoff, payoff);
        
        // Show this total savings growing linearly over the payoff period
        const progressRatio = month / timelineMonths;
        const interestSavedSoFar = totalInterestSaved * progressRatio;
        
        // Investment values: investing only the extra principal amount each month (total value, not just gains)
        const weakInvestTotal = calculateInvestmentGrowth(monthlyInvestmentAmount, 4, month, annualBonus).finalBalance;
        const avgInvestTotal = calculateInvestmentGrowth(monthlyInvestmentAmount, 7, month, annualBonus).finalBalance;
        const strongInvestTotal = calculateInvestmentGrowth(monthlyInvestmentAmount, 10, month, annualBonus).finalBalance;
        
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
                    tension: 0,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: '🐻 Invest Extra Principal (Weak 4%)',
                    data: weakNetBenefit,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: '📈 Invest Extra Principal (Average 7%)',
                    data: averageNetBenefit,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: '🚀 Invest Extra Principal (Strong 10%)',
                    data: strongNetBenefit,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0,
                    pointRadius: 0,
                    pointHoverRadius: 4
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
    const annualBonus = parseFloat(document.getElementById('annualBonus').value) || 0;
    const remainingBalance = parseFloat(document.getElementById('remainingBalance').value);
    const interestRate = parseFloat(document.getElementById('interestRate').value);
    const remainingTerm = parseFloat(document.getElementById('remainingTerm').value);
    const currentPayment = parseFloat(document.getElementById('currentPayment').value);
    
    // Calculate standard mortgage for comparison
    const standardPayoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingTerm, 0);
    
    // Use only the investment timeline (from maturity to end of standard term)
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
    const maturityDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + payoff.monthsToPayoff, 1);
    const dateLabels = [];
    for (let i = 0; i < investmentTimelineMonths; i++) {
        const futureDate = new Date(maturityDate.getFullYear(), maturityDate.getMonth() + i + 1, 1);
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
        // After maturity, invest the freed cash flow (P&I + extra principal only)
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

function createPureInvestmentChart(standardPayoff, weak, average, strong) {
    const ctx = document.getElementById('pureInvestmentChart').getContext('2d');
    
    if (pureInvestmentChart) {
        pureInvestmentChart.destroy();
    }
    
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const gridColor = isDark ? '#475569' : '#e2e8f0';
    
    const extraPrincipal = parseFloat(document.getElementById('extraPrincipal').value) || 0;
    const annualBonus = parseFloat(document.getElementById('annualBonus').value) || 0;
    
    // Use the full original loan term for pure investment timeline
    const timelineMonths = standardPayoff.monthsToPayoff;
    
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
    
    // Calculate investment growth over full term
    const weakInvestmentLine = [];
    const averageInvestmentLine = [];
    const strongInvestmentLine = [];
    const totalContributionsLine = [];
    
    for (let month = 1; month <= timelineMonths; month++) {
        // Calculate investment growth: investing extra principal + annual bonus
        const weakGrowth = calculateInvestmentGrowth(extraPrincipal, 4, month, annualBonus);
        const avgGrowth = calculateInvestmentGrowth(extraPrincipal, 7, month, annualBonus);
        const strongGrowth = calculateInvestmentGrowth(extraPrincipal, 10, month, annualBonus);
        
        weakInvestmentLine.push(weakGrowth.totalValue);
        averageInvestmentLine.push(avgGrowth.totalValue);
        strongInvestmentLine.push(strongGrowth.totalValue);
        totalContributionsLine.push(weakGrowth.totalContributions); // Same for all scenarios
    }
    
    pureInvestmentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dateLabels,
            datasets: [
                {
                    label: '💵 Total Contributions',
                    data: totalContributionsLine,
                    borderColor: '#6b7280',
                    backgroundColor: 'rgba(107, 114, 128, 0.1)',
                    borderWidth: 3,
                    fill: false,
                    tension: 0,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: '🐻 Total Value (Weak 4%)',
                    data: weakInvestmentLine,
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    borderWidth: 3,
                    fill: false,
                    tension: 0,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: '📈 Total Value (Average 7%)',
                    data: averageInvestmentLine,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 3,
                    fill: false,
                    tension: 0,
                    pointRadius: 0,
                    pointHoverRadius: 4
                },
                {
                    label: '🚀 Total Value (Strong 10%)',
                    data: strongInvestmentLine,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 3,
                    fill: false,
                    tension: 0,
                    pointRadius: 0,
                    pointHoverRadius: 4
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
                        text: 'Investment Value ($)',
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

function createCombinedStrategyChart(acceleratedPayoff, standardPayoff, weak, average, strong) {
    const ctx = document.getElementById('combinedStrategyChart').getContext('2d');
    
    if (combinedStrategyChart) {
        combinedStrategyChart.destroy();
    }
    
    // More robust theme detection
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const isDark = currentTheme === 'dark';
    
    // Explicit color assignment with fallback
    let textColor, gridColor;
    if (isDark) {
        textColor = '#f1f5f9';  // Light text for dark theme
        gridColor = '#475569';  // Medium gray for dark theme
    } else {
        textColor = '#1e293b';  // Dark text for light theme
        gridColor = '#e2e8f0';  // Light gray for light theme
    }
    
    const extraPrincipal = parseFloat(document.getElementById('extraPrincipal').value) || 0;
    const annualBonus = parseFloat(document.getElementById('annualBonus').value) || 0;
    const remainingBalance = parseFloat(document.getElementById('remainingBalance').value);
    const interestRate = parseFloat(document.getElementById('interestRate').value);
    const currentPayment = parseFloat(document.getElementById('currentPayment').value);
    const monthlyPMI = parseFloat(document.getElementById('pmiPayment').value) || 0;
    
    // Use the full original loan term timeline
    const timelineMonths = standardPayoff.monthsToPayoff;
    const payoffMonth = acceleratedPayoff.monthsToPayoff;
    
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
    
    // Calculate interest savings accumulation during payoff period
    const interestSavedTotal = getHistoricalAdjustedInterestSavings(standardPayoff, acceleratedPayoff);
    
    // Calculate investment amounts for hybrid strategy
    const totalMonthlyPayment = currentPayment + extraPrincipal;
    const totalMonthlyInvestment = totalMonthlyPayment + monthlyPMI; // Invest what was the full payment
    const investmentMonths = timelineMonths - payoffMonth;
    
    // Build data arrays
    const hybridWeakLine = [];
    const hybridAverageLine = [];
    const hybridStrongLine = [];
    const pureWeakLine = [];
    const pureAverageLine = [];
    const pureStrongLine = [];
    
    // Use existing mortgage calculation functions to get progressive interest savings
    // Calculate both scenarios with their payment schedules
    const standardSchedule = calculateMortgagePayoff(remainingBalance, interestRate, remainingTerm, 0, 0, currentPayment, homeValue, 0);
    const acceleratedSchedule = calculateMortgagePayoff(remainingBalance, interestRate, remainingTerm, extraPrincipal, annualBonus, currentPayment, homeValue, monthlyPMI);
    
    for (let month = 1; month <= timelineMonths; month++) {
        // Hybrid strategy logic
        if (month <= payoffMonth) {
            // Show progressive growth to the total interest saved amount
            const progressRatio = month / payoffMonth;
            const currentInterestSavings = interestSavedTotal * progressRatio;
            
            hybridWeakLine.push(currentInterestSavings);
            hybridAverageLine.push(currentInterestSavings);
            hybridStrongLine.push(currentInterestSavings);
        } else {
            // After payoff: add investment growth to interest savings
            const investmentPeriod = month - payoffMonth;
            
            // Calculate compound growth for investment portion using correct function signature
            // This shows the progressive growth from month 1 of investing
            const weakGrowth = calculateInvestmentGrowth(totalMonthlyInvestment, 4, investmentPeriod, 0);
            const averageGrowth = calculateInvestmentGrowth(totalMonthlyInvestment, 7, investmentPeriod, 0);
            const strongGrowth = calculateInvestmentGrowth(totalMonthlyInvestment, 10, investmentPeriod, 0);
            
            // Apply dynamic capital gains tax based on holding period
            const estimatedIncome = getEstimatedIncomeFromMortgage();
            const taxRate = calculateDynamicTaxRate(investmentPeriod, estimatedIncome);
            const weakAfterTax = weakGrowth.totalContributions + (weakGrowth.totalGains * (1 - taxRate/100));
            const averageAfterTax = averageGrowth.totalContributions + (averageGrowth.totalGains * (1 - taxRate/100));
            const strongAfterTax = strongGrowth.totalContributions + (strongGrowth.totalGains * (1 - taxRate/100));
            
            // Add investment value to the interest savings (smooth transition)
            hybridWeakLine.push(interestSavedTotal + weakAfterTax);
            hybridAverageLine.push(interestSavedTotal + averageAfterTax);
            hybridStrongLine.push(interestSavedTotal + strongAfterTax);
        }
        
        // Pure investment strategy: invest only extra principal for full term
        if (extraPrincipal > 0) {
            const pureWeakGrowth = calculateInvestmentGrowth(extraPrincipal, 4, month, annualBonus);
            const pureAverageGrowth = calculateInvestmentGrowth(extraPrincipal, 7, month, annualBonus);
            const pureStrongGrowth = calculateInvestmentGrowth(extraPrincipal, 10, month, annualBonus);
            
            // Apply dynamic capital gains tax based on full holding period
            const estimatedIncome = getEstimatedIncomeFromMortgage();
            const pureTaxRate = calculateDynamicTaxRate(month, estimatedIncome);
            const pureWeakAfterTax = pureWeakGrowth.totalContributions + (pureWeakGrowth.totalGains * (1 - pureTaxRate/100));
            const pureAverageAfterTax = pureAverageGrowth.totalContributions + (pureAverageGrowth.totalGains * (1 - pureTaxRate/100));
            const pureStrongAfterTax = pureStrongGrowth.totalContributions + (pureStrongGrowth.totalGains * (1 - pureTaxRate/100));
            
            pureWeakLine.push(pureWeakAfterTax);
            pureAverageLine.push(pureAverageAfterTax);
            pureStrongLine.push(pureStrongAfterTax);
        } else {
            // No extra principal means no pure investment strategy
            pureWeakLine.push(0);
            pureAverageLine.push(0);
            pureStrongLine.push(0);
        }
    }
    
    const datasets = [
        {
            label: 'Hybrid Strategy - Weak Market (4%)',
            data: hybridWeakLine,
            borderColor: 'rgba(239, 68, 68, 0.8)',
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            fill: false,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 0
        },
        {
            label: 'Hybrid Strategy - Average Market (7%)',
            data: hybridAverageLine,
            borderColor: 'rgba(59, 130, 246, 0.8)',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            fill: false,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 0
        },
        {
            label: 'Hybrid Strategy - Strong Market (10%)',
            data: hybridStrongLine,
            borderColor: 'rgba(34, 197, 94, 0.8)',
            backgroundColor: 'rgba(34, 197, 94, 0.1)',
            fill: false,
            tension: 0.4,
            borderWidth: 2,
            pointRadius: 0
        }
    ];
    
    // Only add pure investment lines if there's extra principal
    if (extraPrincipal > 0) {
        datasets.push(
            {
                label: 'Pure Investment - Weak Market (4%)',
                data: pureWeakLine,
                borderColor: 'rgba(239, 68, 68, 0.4)',
                backgroundColor: 'rgba(239, 68, 68, 0.05)',
                fill: false,
                tension: 0.4,
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0
            },
            {
                label: 'Pure Investment - Average Market (7%)',
                data: pureAverageLine,
                borderColor: 'rgba(59, 130, 246, 0.4)',
                backgroundColor: 'rgba(59, 130, 246, 0.05)',
                fill: false,
                tension: 0.4,
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0
            },
            {
                label: 'Pure Investment - Strong Market (10%)',
                data: pureStrongLine,
                borderColor: 'rgba(34, 197, 94, 0.4)',
                backgroundColor: 'rgba(34, 197, 94, 0.05)',
                fill: false,
                tension: 0.4,
                borderWidth: 1,
                borderDash: [5, 5],
                pointRadius: 0
            }
        );
    }
    
    combinedStrategyChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dateLabels,
            datasets: datasets
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                intersect: false,
                mode: 'index'
            },
            plugins: {
                title: {
                    display: true,
                    text: 'Complete Financial Strategy Comparison',
                    color: textColor,
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: textColor,
                        usePointStyle: true,
                        padding: 15
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            const value = context.parsed.y;
                            return context.dataset.label + ': $' + value.toLocaleString(undefined, {maximumFractionDigits: 0});
                        },
                        afterBody: function(tooltipItems) {
                            const monthIndex = tooltipItems[0].dataIndex + 1;
                            const estimatedIncome = getEstimatedIncomeFromMortgage();
                            
                            if (monthIndex <= payoffMonth) {
                                const hybridTaxRate = calculateDynamicTaxRate(0, estimatedIncome); // No investment yet
                                const pureTaxRate = calculateDynamicTaxRate(monthIndex, estimatedIncome);
                                return [
                                    'Phase: Mortgage Payoff Period', 
                                    'Hybrid: Accumulating interest savings (tax-free)', 
                                    `Pure: Growing investment (${pureTaxRate}% tax rate)`
                                ];
                            } else {
                                const investmentPeriod = monthIndex - payoffMonth;
                                const hybridTaxRate = calculateDynamicTaxRate(investmentPeriod, estimatedIncome);
                                const pureTaxRate = calculateDynamicTaxRate(monthIndex, estimatedIncome);
                                return [
                                    'Phase: Post-Payoff Investment Growth', 
                                    `Hybrid: Interest savings + investment growth (${hybridTaxRate}% tax rate)`, 
                                    `Pure: Continued investment growth (${pureTaxRate}% tax rate)`
                                ];
                            }
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Timeline',
                        color: textColor
                    },
                    ticks: {
                        color: textColor,
                        maxTicksLimit: 10
                    },
                    grid: {
                        color: gridColor
                    }
                },
                y: {
                    display: true,
                    title: {
                        display: true,
                        text: 'Cumulative Financial Benefit ($)',
                        color: textColor
                    },
                    ticks: {
                        color: textColor,
                        callback: function(value) {
                            return '$' + value.toLocaleString();
                        }
                    },
                    grid: {
                        color: gridColor
                    }
                }
            },
            // Add a vertical line at payoff date
            plugins: [{
                beforeDraw: function(chart) {
                    if (payoffMonth < timelineMonths) {
                        const ctx = chart.ctx;
                        const chartArea = chart.chartArea;
                        const xScale = chart.scales.x;
                        
                        const payoffX = xScale.getPixelForValue(payoffMonth - 1);
                        
                        // Add shaded area for payoff phase
                        ctx.save();
                        ctx.fillStyle = isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)';
                        ctx.fillRect(chartArea.left, chartArea.top, payoffX - chartArea.left, chartArea.bottom - chartArea.top);
                        
                        // Add shaded area for investment phase
                        ctx.fillStyle = isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)';
                        ctx.fillRect(payoffX, chartArea.top, chartArea.right - payoffX, chartArea.bottom - chartArea.top);
                        
                        // Add vertical divider line
                        ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.4)';
                        ctx.lineWidth = 3;
                        ctx.setLineDash([]);
                        ctx.beginPath();
                        ctx.moveTo(payoffX, chartArea.top);
                        ctx.lineTo(payoffX, chartArea.bottom);
                        ctx.stroke();
                        
                        ctx.restore();
                        
                        // Add phase labels
                        ctx.save();
                        ctx.fillStyle = textColor;
                        ctx.font = 'bold 14px Arial';
                        ctx.textAlign = 'center';
                        
                        // Payoff phase label
                        const payoffPhaseX = chartArea.left + (payoffX - chartArea.left) / 2;
                        ctx.fillText('🏠 PAYOFF PHASE', payoffPhaseX, chartArea.top - 15);
                        ctx.font = '12px Arial';
                        ctx.fillText('Interest Savings', payoffPhaseX, chartArea.top - 2);
                        
                        // Investment phase label
                        const investmentPhaseX = payoffX + (chartArea.right - payoffX) / 2;
                        ctx.font = 'bold 14px Arial';
                        ctx.fillText('📈 INVESTMENT PHASE', investmentPhaseX, chartArea.top - 15);
                        ctx.font = '12px Arial';
                        ctx.fillText('Compound Growth', investmentPhaseX, chartArea.top - 2);
                        
                        ctx.restore();
                    }
                }
            }]
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
    let paymentAmounts = [0, 20, 50, 100, 150, 200, 250, 500, 1000, 1500, 2000, 2500, 3000, 3500, 4000, 4500, 5000];
    
    // Add current extra principal if it's not already in the list and is greater than 0
    if (currentExtraPrincipal > 0 && !paymentAmounts.includes(currentExtraPrincipal)) {
        paymentAmounts.push(currentExtraPrincipal);
    }
    
    // Add a special case for annual-only strategy ($0 monthly + annual bonus)
    // This adds a $0 row that will show the annual bonus strategy, distinct from "no payment"
    if (currentExtraPrincipal === 0 && annualBonus > 0) {
        // We'll use a special marker value that we can identify later
        // Use -1 as a marker that means "$0 monthly but with annual bonus"
        paymentAmounts.push(-1);
    }
    
    // Sort the payment amounts: 0 first, then -1 (annual only), then ascending order
    paymentAmounts.sort((a, b) => {
        if (a === 0) return -1; // 0 always comes first
        if (b === 0) return 1;
        if (a === -1) return -1; // -1 comes second (after 0)
        if (b === -1) return 1;
        return a - b; // Everything else in ascending order
    });
    
    paymentAmounts.forEach(extraAmount => {
        let payoff, percentageOfPI, totalPaymentDisplay, extraPaymentDisplay;
        // Current payment is when:
        // 1. Monthly extra matches AND (monthly extra > 0 OR annual bonus = 0), OR
        // 2. This is the special annual-only marker (-1) for $0 monthly + annual bonus
        const isCurrentPayment = (extraAmount === currentExtraPrincipal && 
                                 (currentExtraPrincipal > 0 || annualBonus === 0)) ||
                                (extraAmount === -1 && currentExtraPrincipal === 0 && annualBonus > 0);
        
        if (mode === 'biweekly') {
            // Handle special annual-only marker
            if (extraAmount === -1) {
                // This represents $0 monthly + annual bonus only
                payoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingTermYears, 0, annualBonus, monthlyPI, homeValue, monthlyPMI);
                percentageOfPI = (0 / monthlyPI * 100).toFixed(1);
                totalPaymentDisplay = `$${annualBonus.toLocaleString()} Annual Lump Sum Only`;
                extraPaymentDisplay = isCurrentPayment ? 
                    `Annual Only 👈` : 
                    `Annual Only`;
            } else {
                // Bi-weekly mode: convert monthly extra to bi-weekly equivalent
                const biweeklyExtraPayment = extraAmount / 2;
                const biweeklyAnnualExtra = biweeklyExtraPayment * 26;
                const monthlyEquivalentExtra = biweeklyAnnualExtra / 12;
                
                // For $0 extra: use the corrected baseline with original loan maturity
                // For >$0 extra: include PMI and annual bonus
                if (extraAmount === 0) {
                    payoff = window.lastStandardPayoff;
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
            }
        } else {
            // Handle special annual-only marker
            if (extraAmount === -1) {
                // This represents $0 monthly + annual bonus only
                payoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingTermYears, 0, annualBonus, monthlyPI, homeValue, monthlyPMI);
                percentageOfPI = (0 / monthlyPI * 100).toFixed(1);
                totalPaymentDisplay = `$${annualBonus.toLocaleString()} Annual Lump Sum Only`;
                extraPaymentDisplay = isCurrentPayment ? 
                    `Annual Only 👈` : 
                    `Annual Only`;
            } else {
                // Monthly mode: use monthly extra as-is
                // For $0 extra: use the corrected baseline with original loan maturity
                // For >$0 extra: include PMI and annual bonus
                if (extraAmount === 0) {
                    payoff = window.lastStandardPayoff;
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
        }
        
        // Calculate savings compared to baseline (using historical-adjusted totals)
        const timeSaved = baselinePayoff.monthsToPayoff - payoff.monthsToPayoff;
        const interestSaved = getHistoricalAdjustedInterestSavings(baselinePayoff, payoff);
        
        // Get the actual total interest amounts for display in breakdown
        const baselineTotals = getHistoricalAdjustedTotals(baselinePayoff);
        const payoffTotals = getHistoricalAdjustedTotals(payoff);
        
        const yearsSaved = Math.floor(timeSaved / 12);
        const monthsSaved = timeSaved % 12;
        
        // Create compact interest breakdown display
        const interestBreakdown = interestSaved > 0 ? 
            `<div style="font-weight: 600;">$${interestSaved.toLocaleString(undefined, {maximumFractionDigits: 0})} saved</div>
             <div style="font-size: 0.8em; color: var(--text-secondary); margin-top: 2px;">
                $${baselineTotals.totalInterest.toLocaleString(undefined, {maximumFractionDigits: 0})} → $${payoffTotals.totalInterest.toLocaleString(undefined, {maximumFractionDigits: 0})}
             </div>` : 
            `<div>$0</div>`;
        
        // Create row
        const row = document.createElement('tr');
        
        // Add indicator for current payment
        const currentPaymentIndicator = isCurrentPayment ? ' 👈' : '';
            
        row.innerHTML = `
            <td>${totalPaymentDisplay}${currentPaymentIndicator}</td>
            <td>${formatPayoffDate(payoff.monthsToPayoff)}</td>
            <td class="time-saved">${yearsSaved > 0 ? yearsSaved + 'y ' : ''}${monthsSaved}m</td>
            <td class="interest-saved">${interestBreakdown}</td>
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
    
    // Use the same baseline as other comparisons for consistency
    const baselineStandard = window.lastStandardPayoff || {
        monthsToPayoff: remainingTermMonths,
        totalInterest: 0,
        totalPaid: 0,
        monthlyPayment: actualMonthlyPayment
    };
    
    // Calculate monthly scenario WITH user's extra payment and annual bonus (includes PMI)
    const monthlyPayoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingTermMonths / 12, extraPrincipal, annualBonus, actualMonthlyPayment, homeValue, monthlyPMI);
    
    // Bi-weekly strategy: 
    // - Convert to bi-weekly frequency: 26 payments per year instead of 12
    // - Each bi-weekly payment = half of (monthly P&I + extra principal)
    // - Still include annual bonus
    const totalMonthlyPayment = actualMonthlyPayment + extraPrincipal;
    const biweeklyPaymentAmount = totalMonthlyPayment / 2;
    const annualBiweeklyPayments = biweeklyPaymentAmount * 26;
    const monthlyEquivalentFromBiweekly = (annualBiweeklyPayments / 12) - actualMonthlyPayment; // Extra amount above standard monthly P&I
    
    // Calculate bi-weekly scenario (includes the extra principal converted to bi-weekly frequency + annual bonus)
    const biweeklyPayoff = calculateMortgagePayoff(remainingBalance, interestRate, remainingTermMonths / 12, monthlyEquivalentFromBiweekly, annualBonus, actualMonthlyPayment, homeValue, monthlyPMI);
    
    // Get historical-adjusted totals for display
    const monthlyTotals = getHistoricalAdjustedTotals(monthlyPayoff);
    const biweeklyTotals = getHistoricalAdjustedTotals(biweeklyPayoff);
    
    // Update monthly strategy display (WITH user's extra payment and annual bonus)
    const monthlyDescription = extraPrincipal > 0 ? 
        `${formatCurrency(actualMonthlyPayment)} + ${formatCurrency(extraPrincipal)} extra` : 
        formatCurrency(actualMonthlyPayment);
    document.getElementById('monthlyPaymentAmount').textContent = monthlyDescription;
    document.getElementById('monthlyAnnualTotal').textContent = formatCurrency(totalMonthlyPayment * 12);
    document.getElementById('monthlyPayoffTime').textContent = formatPayoffDate(monthlyPayoff.monthsToPayoff);
    document.getElementById('monthlyTotalInterest').textContent = formatCurrency(monthlyTotals.totalInterest);
    
    // Update bi-weekly strategy display
    const biweeklyDescription = extraPrincipal > 0 ? 
        `${formatCurrency(biweeklyPaymentAmount)} bi-weekly (${formatCurrency(actualMonthlyPayment + extraPrincipal)}/mo equivalent)` :
        `${formatCurrency(biweeklyPaymentAmount)} bi-weekly`;
    
    document.getElementById('biweeklyPaymentAmount').textContent = biweeklyDescription;
    document.getElementById('biweeklyAnnualTotal').textContent = formatCurrency(annualBiweeklyPayments);
    document.getElementById('biweeklyPayoffTime').textContent = formatPayoffDate(biweeklyPayoff.monthsToPayoff);
    document.getElementById('biweeklyTotalInterest').textContent = formatCurrency(biweeklyTotals.totalInterest);
    
    // Calculate savings using historical-adjusted totals (bi-weekly vs monthly with same extra payments)
    const timeSaved = monthlyPayoff.monthsToPayoff - biweeklyPayoff.monthsToPayoff;
    const interestSaved = monthlyTotals.totalInterest - biweeklyTotals.totalInterest;
    
    // Update savings display
    document.getElementById('biweeklyTimeSaved').textContent = formatTime(timeSaved);
    document.getElementById('biweeklyInterestSaved').textContent = formatCurrency(interestSaved);
    document.getElementById('biweeklyEquivalentExtra').textContent = formatCurrency(monthlyEquivalentFromBiweekly);
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
                    <h5>🏠 PMI Calculation - Why Both Values Are Needed</h5>
                    <div class="formula">LTV Ratio = (Loan Amount ÷ Home Value) × 100</div>
                    <div class="formula">Monthly PMI = (Original Loan Amount × 0.5%) ÷ 12</div>
                    <div class="formula">PMI Eliminates When: Balance ≤ 80% of Home Value</div>
                    
                    <p><strong>Why we need BOTH Original Loan Amount AND Home Value:</strong></p>
                    <ul>
                        <li><strong>Loan-to-Value (LTV) Ratio:</strong> PMI is required when LTV > 80% (less than 20% down payment)</li>
                        <li><strong>PMI Amount:</strong> Calculated as percentage of original loan amount (typically 0.5% annually)</li>
                        <li><strong>PMI Elimination:</strong> Drops off when loan balance reaches 80% of original home value</li>
                        <li><strong>Different Scenarios:</strong>
                            <ul>
                                <li>Purchase: $500k house, $450k loan = 90% LTV (PMI required)</li>
                                <li>Refinance: $400k loan, $600k house = 67% LTV (no PMI needed)</li>
                                <li>Market changes affect elimination timing but not initial requirement</li>
                            </ul>
                        </li>
                    </ul>
                    
                    <p><em>Without home value, we couldn't determine if PMI was ever required or when it would be eliminated.</em></p>
                </div>
                
                <div class="current-values">
                    <h6>🔢 Your Current Values:</h6>
                    <ul class="value-list">
                        <li><span>Original Loan Amount:</span> <strong>$${originalBalance.toLocaleString()}</strong></li>
                        <li><span>Home Value:</span> <strong>$${homeValue.toLocaleString()}</strong></li>
                        <li><span>Original LTV Ratio:</span> <strong>${originalLTV.toFixed(1)}%</strong></li>
                        <li><span>Down Payment:</span> <strong>${(100 - originalLTV).toFixed(1)}%</strong></li>
                        <li><span>PMI Required:</span> <strong>${originalLTV > 80 ? 'Yes (LTV > 80%)' : 'No (LTV ≤ 80%)'}</strong></li>
                        <li><span>Monthly P&I Payment:</span> <strong>$${monthlyPI.toLocaleString()}</strong></li>
                        <li><span>PMI Elimination Threshold:</span> <strong>$${pmiThreshold.toLocaleString()}</strong></li>
                        <li><span>Current Remaining Balance:</span> <strong>$${remainingBalance.toLocaleString()}</strong></li>
                        <li><span>Current PMI Status:</span> <strong>${remainingBalance <= pmiThreshold ? 'Should be eliminated (≤80% LTV)' : 'Active (>80% LTV)'}</strong></li>
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
                    <p><strong>Why Both Values Are Needed:</strong></p>
                    <ul>
                        <li><strong>PMI Amount:</strong> Based on loan amount (risk to lender)</li>
                        <li><strong>PMI Requirement:</strong> Based on LTV ratio (loan amount ÷ home value)</li>
                        <li><strong>PMI Elimination:</strong> Based on 80% of home value threshold</li>
                    </ul>
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
                    <p>Invested from maturity until original loan maturity date.</p>
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
                    <h5>🎯 Strategy Overview</h5>
                    <p><strong>Pure Investment:</strong> Instead of making extra mortgage payments, invest that same money in the market.</p>
                    <p><strong>Key Trade-off:</strong> Investment growth potential vs. guaranteed mortgage interest savings.</p>
                    <div class="formula">Investment Amount = Extra Principal + Annual Bonus</div>
                    <div class="formula">Investment Period = Full Original Loan Term (${originalTerm} years)</div>
                </div>
                
                <div class="calculation-section">
                    <h5>💰 Investment Growth Calculation</h5>
                    <p><strong>Monthly Contributions:</strong> $${extraPrincipal.toLocaleString()} per month</p>
                    <p><strong>Annual Lump Sum:</strong> $${annualBonus.toLocaleString()} once per year (January)</p>
                    <p><strong>Total Annual Investment:</strong> ($${extraPrincipal.toLocaleString()} × 12) + $${annualBonus.toLocaleString()} = $${((extraPrincipal * 12) + annualBonus).toLocaleString()}</p>
                    <div class="formula">Future Value = Monthly Annuity + Annual Lump Sum Growth</div>
                    <p><strong>Calculation Method:</strong> Monthly payments grow monthly, annual bonus grows from each January deposit</p>
                    
                    <h6>📈 Three Scenarios Calculated:</h6>
                    <ul>
                        <li><strong>Weak Market (4% annual):</strong> Conservative, bond-like returns</li>
                        <li><strong>Average Market (7% annual):</strong> Historical stock market average</li>
                        <li><strong>Strong Market (10% annual):</strong> Aggressive growth scenario</li>
                    </ul>
                </div>
                
                <div class="calculation-section">
                    <h5>💸 Tax Treatment (Critical Factor)</h5>
                    <p><strong>Capital Gains Tax:</strong> 20% applied to investment gains only (not contributions)</p>
                    <div class="formula">Taxable Gains = Final Investment Value - Total Contributions</div>
                    <div class="formula">Tax Owed = Taxable Gains × 20%</div>
                    <div class="formula">Net Investment Value = Final Value - Tax Owed</div>
                    
                    <p><strong>Example:</strong> If you contribute $100,000 and it grows to $200,000:</p>
                    <ul>
                        <li>Taxable gains: $200,000 - $100,000 = $100,000</li>
                        <li>Tax owed: $100,000 × 20% = $20,000</li>
                        <li>Net value: $200,000 - $20,000 = $180,000</li>
                    </ul>
                    
                    <p><em>Note: Mortgage interest savings are tax-free money in your pocket.</em></p>
                </div>
                
                <div class="calculation-section">
                    <h5>⚖️ True Cost Comparison</h5>
                    <p><strong>Investment Strategy Cost:</strong> You continue paying standard mortgage payments for the full ${originalTerm} years.</p>
                    <div class="formula">Extra Interest Paid = Standard Loan Interest - Accelerated Loan Interest</div>
                    
                    <p><strong>Net Benefit Calculation:</strong></p>
                    <div class="formula">Net Investment Benefit = After-Tax Investment Value - Extra Interest Cost</div>
                    
                    <p><strong>Why This Matters:</strong> Investment returns must overcome both taxes AND the extra interest you pay by not accelerating the mortgage.</p>
                </div>
                
                <div class="calculation-section">
                    <h5>🔍 Risk vs. Certainty Analysis</h5>
                    <p><strong>Mortgage Payoff (Guaranteed):</strong></p>
                    <ul>
                        <li>✅ Interest savings are guaranteed and immediate</li>
                        <li>✅ No market risk or volatility</li>
                        <li>✅ No tax implications</li>
                        <li>✅ Improves cash flow when mortgage is paid off</li>
                    </ul>
                    
                    <p><strong>Investment Strategy (Market Risk):</strong></p>
                    <ul>
                        <li>⚠️ Returns are not guaranteed</li>
                        <li>⚠️ Subject to market volatility and potential losses</li>
                        <li>⚠️ Capital gains tax reduces final value</li>
                        <li>⚠️ Must outperform mortgage interest rate + taxes to win</li>
                        <li>✅ Potentially higher returns in strong markets</li>
                        <li>✅ Maintains liquidity (can access investments)</li>
                    </ul>
                </div>
                
                <div class="calculation-section">
                    <h5>📊 Break-Even Analysis</h5>
                    <p><strong>Required Return Rate:</strong> Investment must beat your mortgage interest rate after taxes.</p>
                    <div class="formula">Required Return ≈ Mortgage Rate ÷ (1 - Tax Rate)</div>
                    <p>With ${interestRate}% mortgage and 20% tax rate: ${(interestRate / 0.8).toFixed(2)}% return needed to break even.</p>
                </div>
                
                <div class="current-values">
                    <h6>🔢 Your Pure Investment Strategy:</h6>
                    <ul class="value-list">
                        <li><span>Monthly Investment:</span> <strong>$${extraPrincipal.toLocaleString()}</strong></li>
                        <li><span>Annual Lump Sum:</span> <strong>$${annualBonus.toLocaleString()}</strong></li>
                        <li><span>Total Annual Investment:</span> <strong>$${((extraPrincipal * 12) + annualBonus).toLocaleString()}</strong></li>
                        <li><span>Investment Period:</span> <strong>${originalTerm} years (${originalTerm * 12} monthly payments + ${originalTerm} annual deposits)</strong></li>
                        <li><span>Total Contributions:</span> <strong>$${(((extraPrincipal * 12) + annualBonus) * originalTerm).toLocaleString()}</strong></li>
                        <li><span>Tax Rate Applied:</span> <strong>20% on gains only</strong></li>
                        <li><span>Break-Even Rate:</span> <strong>${(interestRate / 0.8).toFixed(2)}% annual return</strong></li>
                        <li><span>Risk Profile:</span> <strong>Market risk vs. guaranteed mortgage savings</strong></li>
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
            
        case 'mortgage-comparison':
            title.textContent = '📋 Mortgage Payment Comparison - How the Calculator Works';
            content = `
                <div class="calculation-section">
                    <h5>🔄 Comparison Logic</h5>
                    <p>The mortgage payment comparison shows a side-by-side analysis of your loan scenarios:</p>
                    <ul>
                        <li><strong>Standard Payment:</strong> Shows what happens if you continue P&I-only payments from your current remaining balance</li>
                        <li><strong>With Extra Principal:</strong> Shows accelerated payoff with your extra payments and PMI included</li>
                    </ul>
                </div>
                
                <div class="calculation-section">
                    <h5>🕵️ Previous Extra Payments Detection</h5>
                    <p>The calculator automatically detects if you've already made extra payments:</p>
                    <ul>
                        <li><strong>If your current balance is lower than expected:</strong> You've already made extra payments</li>
                        <li><strong>Current Standard:</strong> Based on your current remaining balance (accounts for previous extras)</li>
                        <li><strong>Original Maturity:</strong> Shows what the original loan schedule would have been</li>
                        <li><strong>Dual Display:</strong> When previous payments detected, both dates are shown for complete picture</li>
                    </ul>
                    <p><em>This ensures fair comparisons and shows your actual progress vs original loan schedule.</em></p>
                </div>
                
                <div class="calculation-section">
                    <h5>⚖️ Fair Comparison Rules</h5>
                    <p><strong>When Extra Principal = $0 and Annual Bonus = $0:</strong></p>
                    <ul>
                        <li>Both scenarios show identical results (P&I only, no PMI)</li>
                        <li>This ensures a true baseline comparison</li>
                        <li>No time or interest "savings" are shown since nothing changes</li>
                    </ul>
                    
                    <p><strong>When Extra Payments > $0:</strong></p>
                    <ul>
                        <li>Standard scenario uses current balance with P&I only</li>
                        <li>Extra payment scenario includes PMI and extra payments</li>
                        <li>This shows realistic savings from your accelerated strategy</li>
                    </ul>
                </div>
                
                <div class="current-values">
                    <h6>🔢 Your Current Scenario:</h6>
                    <ul class="value-list">
                        <li><span>Extra Principal:</span> <strong>$${extraPrincipal.toLocaleString()}/month</strong></li>
                        <li><span>Annual Bonus:</span> <strong>$${annualBonus.toLocaleString()}/year</strong></li>
                        <li><span>Monthly PMI:</span> <strong>$${actualMonthlyPMI.toLocaleString()}</strong></li>
                        <li><span>Comparison Type:</span> <strong>${(extraPrincipal === 0 && annualBonus === 0) ? 'Identical Baseline' : 'Accelerated vs Standard'}</strong></li>
                    </ul>
                </div>
            `;
            break;
            
        case 'pi-payment':
            title.textContent = '💰 Monthly P&I Payment - Principal & Interest Calculation';
            content = `
                <div class="calculation-section">
                    <h5>💡 What is P&I?</h5>
                    <p><strong>P&I</strong> stands for <strong>Principal & Interest</strong> - the core components of your mortgage payment that go toward paying down the loan itself.</p>
                    <ul>
                        <li><strong>Principal:</strong> The portion that reduces your loan balance</li>
                        <li><strong>Interest:</strong> The cost of borrowing money from the lender</li>
                    </ul>
                    <p><em>Note: P&I does NOT include taxes, insurance, HOA fees, or PMI - those are separate costs.</em></p>
                </div>
                
                <div class="calculation-section">
                    <h5>📐 Standard Mortgage Payment Formula</h5>
                    <div class="formula">M = P × [r(1+r)ⁿ] / [(1+r)ⁿ-1]</div>
                    <p><strong>Where:</strong></p>
                    <ul>
                        <li><strong>M</strong> = Monthly P&I Payment</li>
                        <li><strong>P</strong> = Principal (original loan amount)</li>
                        <li><strong>r</strong> = Monthly interest rate (annual rate ÷ 12)</li>
                        <li><strong>n</strong> = Total number of payments (years × 12)</li>
                    </ul>
                </div>
                
                <div class="calculation-section">
                    <h5>🎯 Why Use Original Loan Terms?</h5>
                    <p>This calculator uses your <strong>original loan amount, interest rate, and term</strong> to calculate P&I, not your current balance.</p>
                    <p><strong>Why?</strong> Because your actual monthly payment to the lender is based on the original loan terms and doesn't change when you make extra payments.</p>
                    <ul>
                        <li>✅ <strong>Correct:</strong> Payment based on original $400K loan at 5.5% for 30 years = $2,271</li>
                        <li>❌ <strong>Wrong:</strong> Payment based on current $350K balance would be lower, but that's not your actual payment</li>
                    </ul>
                </div>
                
                <div class="calculation-section">
                    <h5>📊 How Principal vs Interest Changes Over Time</h5>
                    <p>Your P&I payment stays the same, but the breakdown changes:</p>
                    <ul>
                        <li><strong>Early Years:</strong> Most goes to interest (higher balance × interest rate)</li>
                        <li><strong>Later Years:</strong> Most goes to principal (lower balance × interest rate)</li>
                    </ul>
                    <div class="formula">Interest Portion = Current Balance × Monthly Interest Rate</div>
                    <div class="formula">Principal Portion = Total P&I Payment - Interest Portion</div>
                </div>
                
                <div class="calculation-section">
                    <h5>🔧 Manual Override Option</h5>
                    <p>If the calculated P&I doesn't match your actual payment:</p>
                    <ul>
                        <li><strong>Reason 1:</strong> Your loan has different terms (ARM, interest-only period, etc.)</li>
                        <li><strong>Reason 2:</strong> You have a special loan program with modified payment structure</li>
                        <li><strong>Solution:</strong> You can manually enter your actual P&I payment - the calculator will use your value instead</li>
                    </ul>
                    <p><em>Most users should use the auto-calculated value for accuracy.</em></p>
                </div>
                
                <div class="current-values">
                    <h6>🔢 Your P&I Payment Details:</h6>
                    <ul class="value-list">
                        <li><span>Original Loan Amount:</span> <strong>$${originalBalance.toLocaleString()}</strong></li>
                        <li><span>Interest Rate:</span> <strong>${interestRate}% annual</strong></li>
                        <li><span>Monthly Interest Rate:</span> <strong>${(monthlyRate * 100).toFixed(4)}%</strong></li>
                        <li><span>Original Term:</span> <strong>${originalTerm} years (${originalTerm * 12} payments)</strong></li>
                        <li><span>Calculated Monthly P&I:</span> <strong>$${monthlyPI.toLocaleString()}</strong></li>
                        <li><span>Current Remaining Balance:</span> <strong>$${remainingBalance.toLocaleString()}</strong></li>
                        <li><span>Balance Paid Down:</span> <strong>$${(originalBalance - remainingBalance).toLocaleString()} (${(((originalBalance - remainingBalance) / originalBalance) * 100).toFixed(1)}%)</strong></li>
                    </ul>
                    
                    <div class="calculation-breakdown" style="margin-top: 15px; padding: 10px; background: var(--card-background); border-left: 4px solid var(--accent-color); border-radius: 4px;">
                        <h6 style="margin-bottom: 8px;">📋 Current Payment Breakdown (Estimated):</h6>
                        <ul class="value-list" style="margin: 0;">
                            <li><span>Interest Portion:</span> <strong>$${(remainingBalance * monthlyRate).toLocaleString()}</strong></li>
                            <li><span>Principal Portion:</span> <strong>$${(monthlyPI - (remainingBalance * monthlyRate)).toLocaleString()}</strong></li>
                            <li><span>Interest %:</span> <strong>${((remainingBalance * monthlyRate / monthlyPI) * 100).toFixed(1)}%</strong></li>
                            <li><span>Principal %:</span> <strong>${(((monthlyPI - (remainingBalance * monthlyRate)) / monthlyPI) * 100).toFixed(1)}%</strong></li>
                        </ul>
                    </div>
                </div>
            `;
            break;
            
        case 'pmi-calculation':
            title.textContent = '🏠 PMI Calculation - Private Mortgage Insurance Details';
            content = `
                <div class="calculation-section">
                    <h5>💡 What is PMI?</h5>
                    <p>Private Mortgage Insurance (PMI) protects the lender if you default on your loan. It's typically required when you put down less than 20% (LTV > 80%).</p>
                </div>
                
                <div class="calculation-section">
                    <h5>📐 PMI Calculation Formula</h5>
                    <div class="formula">Monthly PMI = (Loan Amount × PMI Rate) ÷ 12 months</div>
                    <div class="formula">Default Rate Used: 0.5% annually</div>
                    <p><strong>Example:</strong> $400,000 loan × 0.5% = $2,000 ÷ 12 = $167/month</p>
                </div>
                
                <div class="calculation-section">
                    <h5>🎯 When PMI is Required</h5>
                    <div class="formula">LTV Ratio = (Loan Amount ÷ Home Value) × 100</div>
                    <ul>
                        <li><strong>LTV > 80%:</strong> PMI required (less than 20% down payment)</li>
                        <li><strong>LTV ≤ 80%:</strong> No PMI needed (20%+ down payment)</li>
                    </ul>
                </div>
                
                <div class="calculation-section">
                    <h5>🚪 PMI Elimination</h5>
                    <div class="formula">PMI Drops Off When: Balance ≤ (Home Value × 0.80)</div>
                    <p><strong>Automatic Elimination:</strong> Required by law when balance reaches 78% of original home value</p>
                    <p><strong>Request Elimination:</strong> You can request removal at 80% LTV (may require appraisal)</p>
                    <p><strong>PMI Reinvestment:</strong> This calculator assumes former PMI payments become extra principal</p>
                </div>
                
                <div class="calculation-section">
                    <h5>⚠️ Rate Variation Reality Check</h5>
                    <p><strong>Important:</strong> PMI rates vary significantly based on:</p>
                    <ul>
                        <li><strong>Credit Score:</strong> 620-850+ (higher score = lower rate)</li>
                        <li><strong>LTV Ratio:</strong> 85% vs 95% makes a big difference</li>
                        <li><strong>Loan Type:</strong> Conventional vs FHA vs USDA</li>
                        <li><strong>Lender:</strong> Different lenders offer different rates</li>
                        <li><strong>Coverage Amount:</strong> 6%-35% of loan amount annually</li>
                    </ul>
                    <div class="formula">Real-World Range: 0.1% - 1.0% annually</div>
                    <p><em>The 0.5% default is conservative. Your actual PMI may be significantly lower (especially with good credit) or higher (with challenging credit/high LTV).</em></p>
                </div>
                
                <div class="current-values">
                    <h6>🔢 Your PMI Details:</h6>
                    <ul class="value-list">
                        <li><span>Original Loan Amount:</span> <strong>$${originalBalance.toLocaleString()}</strong></li>
                        <li><span>Original Home Value:</span> <strong>$${homeValue.toLocaleString()}</strong></li>
                        <li><span>Original LTV Ratio:</span> <strong>${originalLTV.toFixed(1)}%</strong></li>
                        <li><span>Down Payment:</span> <strong>${(100 - originalLTV).toFixed(1)}% ($${((homeValue - originalBalance)).toLocaleString()})</strong></li>
                        <li><span>PMI Required:</span> <strong>${originalLTV > 80 ? 'Yes (LTV > 80%)' : 'No (LTV ≤ 80%)'}</strong></li>
                        <li><span>Current PMI (in field):</span> <strong>$${actualMonthlyPMI.toLocaleString()}/month</strong></li>
                        <li><span>Auto-calculated PMI would be:</span> <strong>$${Math.round(autoCalculatedPMI).toLocaleString()}/month</strong></li>
                        <li><span>Implied Annual Rate:</span> <strong>${actualMonthlyPMI > 0 ? ((actualMonthlyPMI * 12 / originalBalance) * 100).toFixed(2) : '0.00'}%</strong></li>
                        <li><span>PMI Status:</span> <strong>${isManuallyEntered ? 'Manually Entered' : 'Auto-Calculated'}</strong></li>
                        <li><span>Elimination Threshold:</span> <strong>$${pmiThreshold.toLocaleString()} (80% of home value)</strong></li>
                        <li><span>Current Balance:</span> <strong>$${remainingBalance.toLocaleString()}</strong></li>
                        <li><span>PMI Should Eliminate:</span> <strong>${remainingBalance <= pmiThreshold ? 'Yes - Balance ≤ 80% LTV' : 'No - Balance > 80% LTV'}</strong></li>
                    </ul>
                    
                    ${actualMonthlyPMI !== Math.round(autoCalculatedPMI) && actualMonthlyPMI > 0 ? `
                    <div class="rate-comparison" style="margin-top: 15px; padding: 10px; background: var(--accent-color); border-radius: 8px;">
                        <h6 style="color: var(--text-primary); margin-bottom: 8px;">💡 Rate Comparison:</h6>
                        <p style="color: var(--text-primary); margin: 0; font-size: 0.9em;">
                            <strong>Your Rate:</strong> ${((actualMonthlyPMI * 12 / originalBalance) * 100).toFixed(2)}% vs 
                            <strong>Calculator Default:</strong> 0.50%
                            ${actualMonthlyPMI < autoCalculatedPMI ? ' - You have a better rate!' : ' - Your rate is higher than default'}
                        </p>
                    </div>
                    ` : ''}
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

// Tab functionality
function openTab(evt, tabName) {
    // Hide all tab panels
    const tabPanels = document.getElementsByClassName('tab-panel');
    for (let i = 0; i < tabPanels.length; i++) {
        tabPanels[i].classList.remove('active');
    }
    
    // Remove active class from all tab buttons
    const tabButtons = document.getElementsByClassName('tab-btn');
    for (let i = 0; i < tabButtons.length; i++) {
        tabButtons[i].classList.remove('active');
    }
    
    // Show the selected tab panel and mark button as active
    document.getElementById(tabName).classList.add('active');
    evt.currentTarget.classList.add('active');
}



// Add some sample data on load for demo purposes
window.addEventListener('load', function() {
    // The HTML already has sample values, so we don't need to set them again
    console.log('Mortgage Payoff vs Investment Calculator loaded successfully!');
    
    // Automatically calculate with the default values on page load
    // so users can see example results in all tabs immediately
    setTimeout(() => {
        if (typeof calculate === 'function') {
            calculate(true); // Pass true to indicate this is an auto-run
        }
    }, 500); // Small delay to ensure all DOM elements are ready
});
