// Global variables
let balanceChart = null;
let combinedStrategyChart = null;

// Currency input formatting helpers
const CURRENCY_INPUT_IDS = ['originalBalance', 'homeValue', 'remainingBalance', 'pmiPayment', 'extraPrincipal', 'annualBonus'];

function parseMoney(str) {
    if (typeof str === 'number') return str;
    return parseFloat(String(str).replace(/[$,\s]/g, '')) || 0;
}

function formatMoneyDisplay(value) {
    const num = typeof value === 'string' ? parseMoney(value) : value;
    if (isNaN(num) || num === 0) return '$0';
    // Show cents only if they exist
    const hasDecimals = num % 1 !== 0;
    return '$' + num.toLocaleString('en-US', {
        minimumFractionDigits: hasDecimals ? 2 : 0,
        maximumFractionDigits: 2
    });
}

function setupCurrencyInput(input) {
    // Format the initial value on page load
    const raw = parseMoney(input.value);
    if (raw > 0) {
        input.value = formatMoneyDisplay(raw);
    }
    
    input.addEventListener('focus', function() {
        // Strip formatting on focus so user can edit the raw number
        const raw = parseMoney(this.value);
        this.value = raw > 0 ? raw : '';
        // Select all text for easy replacement
        this.select();
    });
    
    input.addEventListener('blur', function() {
        const raw = parseMoney(this.value);
        this.value = raw > 0 ? formatMoneyDisplay(raw) : '$0';
    });
}

// Initialize theme
function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark'; // Default to dark mode
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
}

// Parse flexible date text like "Dec 2022", "12/2022", "December 2022", "2022-12"
function parseDateText(text) {
    if (!text) return null;
    text = text.trim();
    // Try YYYY-MM
    let m = text.match(/^(\d{4})-(\d{1,2})$/);
    if (m) return m[1] + '-' + m[2].padStart(2, '0');
    // Try MM/YYYY or M/YYYY
    m = text.match(/^(\d{1,2})\/(\d{4})$/);
    if (m) return m[2] + '-' + m[1].padStart(2, '0');
    // Try month name + year
    const months = { jan:1, feb:2, mar:3, apr:4, may:5, jun:6, jul:7, aug:8, sep:9, oct:10, nov:11, dec:12,
        january:1, february:2, march:3, april:4, june:6, july:7, august:8, september:9, october:10, november:11, december:12 };
    m = text.match(/^([a-zA-Z]+)\s*,?\s*(\d{4})$/);
    if (m && months[m[1].toLowerCase()]) {
        return m[2] + '-' + String(months[m[1].toLowerCase()]).padStart(2, '0');
    }
    return null;
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
    
    // Compact term formatter: "25y 6m" instead of "25 years, 6 months"
    function formatTermCompact(totalMonths) {
        const y = Math.floor(totalMonths / 12);
        const m = totalMonths % 12;
        if (y > 0 && m > 0) return `${y}y ${m}m`;
        if (y > 0) return `${y}y`;
        return `${m}m`;
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
    const standardDisplayText = formatTermCompact(remainingMonths);
    
    // Calculate standard maturity date
    const standardMaturityDate = formatPayoffDate(remainingMonths);
    
    // Check if we can detect previous extra payments in real-time
    const remainingBalance = parseMoney(document.getElementById('remainingBalance').value);
    const interestRate = parseFloat(document.getElementById('interestRate').value);
    const currentPayment = parseMoney(document.getElementById('currentPayment').value);
    
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
            const actualDisplayText = formatTermCompact(actualPayoff.monthsToPayoff);
            
            // Calculate actual maturity date
            const actualMaturityDate = formatPayoffDate(actualPayoff.monthsToPayoff);
            
            // Display in "standard / actual" format
            document.getElementById('remainingTerm').value = `${standardDisplayText} / ${actualDisplayText}`;
            document.getElementById('remainingPayments').value = `${remainingMonths} / ${actualPayoff.monthsToPayoff} payments`;
            document.getElementById('calculatedPayoffDate').value = `${standardMaturityDate} / ${actualMaturityDate}`;
            
            updateLoanTimeline(monthsElapsed, totalMonths, remainingMonths, startDate, formatTermCompact, actualPayoff.monthsToPayoff);
            
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
    
    updateLoanTimeline(monthsElapsed, totalMonths, remainingMonths, startDate, formatTermCompact);
    
    return remainingYears;
}

function updateLoanTimeline(monthsElapsed, totalMonths, remainingMonths, startDate, formatTermCompact, actualRemainingMonths) {
    const card = document.getElementById('loanTimelineCard');
    const segElapsed = document.getElementById('segElapsed');
    const segCurrent = document.getElementById('segCurrent');
    const segExtra = document.getElementById('segExtra');
    const markerCurrent = document.getElementById('markerCurrent');
    const markerExtra = document.getElementById('markerExtra');
    const startLabel = document.getElementById('loanStartLabel');
    const endLabel = document.getElementById('loanEndLabel');
    const headerEl = document.getElementById('timelineHeader');
    const encouragement = document.getElementById('timelineEncouragement');
    const legendCurrent = document.getElementById('legendCurrent');
    const legendExtra = document.getElementById('legendExtra');
    const elapsedEl = document.getElementById('timelineElapsed');
    const originalEl = document.getElementById('timelineOriginal');
    const currentStat = document.getElementById('timelineCurrentStat');
    const currentPaceEl = document.getElementById('timelineCurrentPace');
    const extraStat = document.getElementById('timelineExtraStat');
    const extraPaceEl = document.getElementById('timelineExtraPace');
    const savedStat = document.getElementById('timelineSavedStat');
    const savedEl = document.getElementById('timelineSaved');

    if (!segElapsed) return;

    // --- Determine current-pace scenario ---
    const aheadOfSchedule = actualRemainingMonths != null && actualRemainingMonths < remainingMonths;
    const currentPaceTotal = aheadOfSchedule ? monthsElapsed + actualRemainingMonths : totalMonths;

    // --- Determine extra-payment scenario ---
    const remainingBalance = parseMoney(document.getElementById('remainingBalance').value);
    const interestRate = parseFloat(document.getElementById('interestRate').value);
    const currentPayment = parseMoney(document.getElementById('currentPayment').value);
    const extraPrincipal = parseMoney(document.getElementById('extraPrincipal').value);
    const annualBonus = parseMoney(document.getElementById('annualBonus').value);
    const homeValue = parseMoney(document.getElementById('homeValue').value);
    const monthlyPMI = parseMoney(document.getElementById('pmiPayment').value);

    let extraMonthsRemaining = null;
    let extraTotalMonths = null;
    const hasExtra = (extraPrincipal > 0 || annualBonus > 0);
    if (hasExtra && remainingBalance > 0 && interestRate > 0 && currentPayment > 0) {
        const baseMonths = aheadOfSchedule ? actualRemainingMonths : remainingMonths;
        const extraPayoff = calculateMortgagePayoff(
            remainingBalance, interestRate, baseMonths / 12,
            extraPrincipal, annualBonus, currentPayment, homeValue || null, monthlyPMI
        );
        extraMonthsRemaining = extraPayoff.monthsToPayoff;
        extraTotalMonths = monthsElapsed + extraMonthsRemaining;
    }

    // --- Use original schedule as the full-width baseline ---
    const barBase = totalMonths; // 100% of bar equals the original schedule

    // Elapsed segment (always shown)
    const elapsedPct = Math.min(100, Math.max(1, (monthsElapsed / barBase) * 100));
    segElapsed.style.width = elapsedPct.toFixed(2) + '%';

    // Date strings
    const dateFmt = { month: 'short', year: 'numeric' };
    const startStr = startDate.toLocaleDateString('en-US', dateFmt);
    const originalEndDate = new Date(startDate.getFullYear(), startDate.getMonth() + totalMonths, 1);
    const originalEndStr = originalEndDate.toLocaleDateString('en-US', dateFmt);
    startLabel.textContent = startStr;

    // --- Percent complete label on elapsed bar ---
    const elapsedPctLabel = document.getElementById('elapsedPctLabel');
    if (elapsedPctLabel) {
        // Time-based percent
        const timePct = Math.round(elapsedPct);

        // Principal-based percent (how much of the loan balance is paid off)
        const originalBalance = parseMoney(document.getElementById('originalBalance').value);
        const remainBal = parseMoney(document.getElementById('remainingBalance').value);
        let principalPct = null;
        if (originalBalance > 0 && remainBal >= 0) {
            principalPct = Math.round(((originalBalance - remainBal) / originalBalance) * 100);
        }

        // Show principal % if available, else time %
        const displayPct = principalPct != null ? principalPct : timePct;
        elapsedPctLabel.textContent = displayPct + '% paid';

        // Tooltip with full breakdown
        const tooltipLines = [];
        if (principalPct != null) {
            tooltipLines.push(`Principal paid: ${displayPct}% ($${(originalBalance - remainBal).toLocaleString()} of $${originalBalance.toLocaleString()})`);
        }
        tooltipLines.push(`Time elapsed: ${timePct}% (${monthsElapsed} of ${totalMonths} months)`);
        elapsedPctLabel.title = tooltipLines.join('\n');

        // Hide label if bar too narrow to fit it
        elapsedPctLabel.style.display = elapsedPct < 12 ? 'none' : '';
    }

    // --- Today marker at elapsed edge ---
    const markerToday = document.getElementById('markerToday');
    const markerTodayDate = document.getElementById('markerTodayDate');
    if (markerToday) {
        markerToday.style.left = elapsedPct.toFixed(2) + '%';
        if (markerTodayDate) {
            const now = new Date();
            markerTodayDate.textContent = now.toLocaleDateString('en-US', dateFmt);
        }
    }

    // --- Current pace segment + marker ---
    // Segments all start at left:0 and layer via z-index (elapsed on top).
    // Each segment's width = its full extent so the top layers mask the lower ones.
    if (aheadOfSchedule) {
        const currentEndPct = Math.min(100, (currentPaceTotal / barBase) * 100);
        segCurrent.style.width = currentEndPct.toFixed(2) + '%';
        segCurrent.style.display = '';
        markerCurrent.style.left = currentEndPct.toFixed(2) + '%';
        markerCurrent.style.display = '';
        legendCurrent.style.display = '';
        currentStat.style.display = '';
        currentPaceEl.textContent = formatTermCompact(currentPaceTotal);
        // Show payoff date on the marker
        const currentEndDate = new Date(new Date().getFullYear(), new Date().getMonth() + actualRemainingMonths, 1);
        const markerCurrentDate = document.getElementById('markerCurrentDate');
        if (markerCurrentDate) markerCurrentDate.textContent = currentEndDate.toLocaleDateString('en-US', dateFmt);
    } else {
        segCurrent.style.display = 'none';
        markerCurrent.style.display = 'none';
        legendCurrent.style.display = 'none';
        currentStat.style.display = 'none';
    }

    // --- Extra payment segment + marker ---
    if (extraTotalMonths != null && extraTotalMonths < (aheadOfSchedule ? currentPaceTotal : totalMonths)) {
        const extraEndPct = Math.min(100, (extraTotalMonths / barBase) * 100);
        segExtra.style.width = extraEndPct.toFixed(2) + '%';
        segExtra.style.display = '';
        markerExtra.style.left = extraEndPct.toFixed(2) + '%';
        markerExtra.style.display = '';
        legendExtra.style.display = '';
        extraStat.style.display = '';
        extraPaceEl.textContent = formatTermCompact(extraTotalMonths);
        // Show payoff date on the marker
        const extraEndDate = new Date(new Date().getFullYear(), new Date().getMonth() + extraMonthsRemaining, 1);
        const markerExtraDate = document.getElementById('markerExtraDate');
        if (markerExtraDate) markerExtraDate.textContent = extraEndDate.toLocaleDateString('en-US', dateFmt);
    } else {
        segExtra.style.display = 'none';
        markerExtra.style.display = 'none';
        legendExtra.style.display = 'none';
        extraStat.style.display = 'none';
    }

    // --- Time saved calculation ---
    // Best-case total is with extra payments if available, else current pace, else original
    const bestTotal = extraTotalMonths != null && extraTotalMonths < totalMonths
        ? extraTotalMonths
        : (aheadOfSchedule ? currentPaceTotal : totalMonths);
    const monthsSaved = totalMonths - bestTotal;

    if (monthsSaved > 0) {
        savedStat.style.display = '';
        savedEl.textContent = formatTermCompact(monthsSaved);
    } else {
        savedStat.style.display = 'none';
    }

    // --- Stats ---
    elapsedEl.textContent = formatTermCompact(monthsElapsed);
    originalEl.textContent = formatTermCompact(totalMonths);

    // --- End label always shows the original schedule payoff date ---
    endLabel.textContent = originalEndStr;

    // --- Header, encouragement, card class ---
    const anyAhead = monthsSaved > 0;
    if (anyAhead) {
        card.classList.add('ahead-of-schedule');
        headerEl.textContent = '📅 Loan Timeline — Ahead of Schedule 🎉';

        const bestEndDate = new Date(new Date().getFullYear(), new Date().getMonth() + (bestTotal - monthsElapsed), 1);
        const bestEndStr = bestEndDate.toLocaleDateString('en-US', dateFmt);

        // Encouragement
        const savedText = formatTermCompact(monthsSaved);
        encouragement.style.display = 'block';
        if (hasExtra && extraTotalMonths != null && extraTotalMonths < totalMonths) {
            encouragement.innerHTML = `🏆 With your extra payments you'll finish <strong>${savedText}</strong> early — mortgage-free by <strong>${bestEndStr}</strong>!`;
        } else {
            encouragement.innerHTML = `🏆 You're <strong>${savedText}</strong> ahead of your original schedule! Keep it up and you'll be mortgage-free by <strong>${bestEndStr}</strong>.`;
        }
    } else {
        card.classList.remove('ahead-of-schedule');
        headerEl.textContent = '📅 Loan Timeline';
        encouragement.style.display = 'none';
    }

    // --- Generate tick marks ---
    const ticksContainer = document.getElementById('timelineTicks');
    if (ticksContainer) {
        ticksContainer.innerHTML = '';
        // Choose interval: 5 years for terms > 15y, 2 years for shorter
        const intervalYears = totalMonths > 180 ? 5 : 2;
        const intervalMonths = intervalYears * 12;
        for (let m = intervalMonths; m < totalMonths; m += intervalMonths) {
            const pct = (m / totalMonths) * 100;
            const tick = document.createElement('div');
            tick.className = 'timeline-tick';
            tick.style.left = pct.toFixed(2) + '%';
            const label = document.createElement('span');
            label.className = 'tick-label';
            label.textContent = (m / 12) + 'y';
            tick.appendChild(label);
            ticksContainer.appendChild(tick);
        }
    }
}

// Update calculated fields to show both original and current values when previous extra payments detected
function updateCalculatedFieldsWithPreviousPayments(standardPayoff) {
    if (!standardPayoff.hasAlreadyMadeExtraPayments) {
        return; // No changes needed if no previous extra payments detected
    }
    
    // Get the original standard values (based on loan start date and original term)
    const originalStandardMonths = standardPayoff.monthsToOriginalMaturity;
    const actualCurrentMonths = standardPayoff.monthsToPayoff;
    
    // Format terms compactly
    function formatTermCompact(totalMonths) {
        const y = Math.floor(totalMonths / 12);
        const m = totalMonths % 12;
        if (y > 0 && m > 0) return `${y}y ${m}m`;
        if (y > 0) return `${y}y`;
        return `${m}m`;
    }
    const originalDisplayText = formatTermCompact(originalStandardMonths);
    const actualDisplayText = formatTermCompact(actualCurrentMonths);
    
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
    initializeTheme();
    
    // Set up currency formatting on money input fields
    CURRENCY_INPUT_IDS.forEach(id => {
        const input = document.getElementById(id);
        if (input) setupCurrencyInput(input);
    });
    
    const loanStartDate = document.getElementById('loanStartDate');
    const loanStartDateText = document.getElementById('loanStartDateText');
    const originalTerm = document.getElementById('originalTerm');
    const currentPayment = document.getElementById('currentPayment');
    const remainingBalance = document.getElementById('remainingBalance');
    const interestRate = document.getElementById('interestRate');
    
    // Sync text input → hidden loanStartDate value
    if (loanStartDateText && loanStartDate) {
        function syncStartDate() {
            const parsed = parseDateText(loanStartDateText.value);
            if (parsed && parsed !== loanStartDate.value) {
                loanStartDate.value = parsed;
                // Reformat text to readable form
                const [y, m] = parsed.split('-');
                const d = new Date(parseInt(y), parseInt(m) - 1);
                loanStartDateText.value = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
                calculateRemainingTerm();
                updatePIVerificationCard();
                scheduleCalculate();
            }
        }
        loanStartDateText.addEventListener('blur', syncStartDate);
        loanStartDateText.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') { e.preventDefault(); loanStartDateText.blur(); }
        });
    }

    if (originalTerm) {
        originalTerm.addEventListener('input', () => {
            calculateRemainingTerm();
            updatePIVerificationCard();
        });
    }
        
    // Debounced auto-calculate for all tabs
    let calcTimer = null;
    function scheduleCalculate() {
        clearTimeout(calcTimer);
        calcTimer = setTimeout(() => calculate(true), 300);
    }
    
    // Calculate on page load
    calculateRemainingTerm();
    calculate(true);
    
    // Add real-time listeners for remaining balance to trigger comparison updates
    if (remainingBalance) {
        remainingBalance.addEventListener('input', calculateRemainingTerm);
    }
    
    // Wire extra payment and PMI/home value inputs to update the timeline
    const extraPrincipalField = document.getElementById('extraPrincipal');
    const annualBonusField = document.getElementById('annualBonus');
    const homeValueFieldForTimeline = document.getElementById('homeValue');
    const pmiFieldForTimeline = document.getElementById('pmiPayment');
    if (extraPrincipalField) extraPrincipalField.addEventListener('input', calculateRemainingTerm);
    if (annualBonusField) annualBonusField.addEventListener('input', calculateRemainingTerm);
    if (homeValueFieldForTimeline) homeValueFieldForTimeline.addEventListener('input', calculateRemainingTerm);
    if (pmiFieldForTimeline) pmiFieldForTimeline.addEventListener('input', calculateRemainingTerm);
    
    // Update P&I verification when relevant fields change
    const originalBalanceField = document.getElementById('originalBalance');
    const originalTermField = document.getElementById('originalTerm');
    const homeValueField = document.getElementById('homeValue');
    const pmiField = document.getElementById('pmiPayment');
    
    if (originalBalanceField && interestRate && originalTermField) {
        originalBalanceField.addEventListener('input', () => {
            updatePIVerificationCard();
            calculatePMI();
            calculateRemainingTerm();
        });
        interestRate.addEventListener('input', () => {
            updatePIVerificationCard();
            calculateRemainingTerm();
        });
        originalTermField.addEventListener('input', updatePIVerificationCard);
        
        // Initial calculation (but don't show insight note until after calculations)
        updatePIVerificationCard();
        calculatePMI();
    }
    
    // Add PMI calculation listeners — triggers on purchase price, remaining balance, or home value changes
    const remainingBalanceField = document.getElementById('remainingBalance');
    if (remainingBalanceField) remainingBalanceField.addEventListener('input', calculatePMI);
    if (homeValueField) homeValueField.addEventListener('input', calculatePMI);
    
    // Mark PMI as manually entered when user types in it
    if (pmiField) {
        pmiField.addEventListener('input', function() {
            if (this.value !== '') {
                this.dataset.calculated = 'false';
                const pmiNote = document.getElementById('pmiNote');
                if (pmiNote) pmiNote.style.display = 'none';
            }
        });
    }
    
    // Add input validation - prevent negative numbers on remaining number inputs
    const numberInputs = document.querySelectorAll('input[type="number"]');
    numberInputs.forEach(input => {
        input.addEventListener('input', function() {
            if (this.value < 0) {
                this.value = 0;
            }
        });
    });
    
    // Wire all interactive inputs to auto-calculate everything
    const allInputs = document.querySelectorAll('input[type="number"], input[type="text"]:not([readonly]), input[type="month"]');
    allInputs.forEach(input => {
        input.addEventListener('input', scheduleCalculate);
        input.addEventListener('change', scheduleCalculate);
    });
    
    // Add toggle functionality for payment scenarios
    const monthlyToggle = document.getElementById('monthlyToggle');
    const biweeklyToggle = document.getElementById('biweeklyToggle');
    
    if (monthlyToggle && biweeklyToggle) {
        monthlyToggle.addEventListener('click', function() {
            monthlyToggle.classList.add('active');
            biweeklyToggle.classList.remove('active');
            
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

// Toggle theme
function toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    
    // Rebuild charts from scratch with correct theme colors
    calculate(true);
}

function updateThemeIcon(theme) {
    const themeIcon = document.querySelector('.theme-icon');
    themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
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
                // Update grid color — preserve function-based grids (custom year-tick logic)
                if (scale.grid && typeof scale.grid.color !== 'function') {
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
    const numberOfPayments = Math.round(term * 12);
    
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
        
        // Apply annual bonus once per year (end of each 12-month cycle)
        let bonusThisMonth = 0;
        if (annualBonus > 0 && (month + 1) % 12 === 0) {
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
    const monthsElapsed = (currentDate.getFullYear() - startDate.getFullYear()) * 12 +
                          (currentDate.getMonth() - startDate.getMonth());
    
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
    const originalBalance = parseMoney(document.getElementById('originalBalance').value);
    const remainingBalance = parseMoney(document.getElementById('remainingBalance').value);
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
        
        // Apply annual bonus once per year (end of each 12-month cycle)
        let bonusThisMonth = 0;
        if (annualBonus > 0 && month > 0 && month % 12 === 0) {
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
    const currentPayment = parseMoney(document.getElementById('currentPayment').value) || 0;
    const monthlyPMI = parseMoney(document.getElementById('pmiPayment').value) || 0;
    const totalHousingPayment = currentPayment + monthlyPMI + 500; // Add estimated taxes/insurance
    
    // Assume housing is 28% of gross income
    const estimatedMonthlyIncome = totalHousingPayment / 0.28;
    const estimatedAnnualIncome = estimatedMonthlyIncome * 12;
    
    // Cap at reasonable bounds
    return Math.min(Math.max(estimatedAnnualIncome, 40000), 500000);
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
    const homeValue = parseMoney(document.getElementById('homeValue').value);
    const remainingBalance = parseMoney(document.getElementById('remainingBalance').value);
    const pmiField = document.getElementById('pmiPayment');
    const pmiNote = document.getElementById('pmiNote');
    
    if (isNaN(homeValue) || isNaN(remainingBalance) || homeValue <= 0 || remainingBalance <= 0) {
        pmiField.value = '';
        if (pmiNote) pmiNote.style.display = 'none';
        return;
    }
    
    // PMI cutoff: remaining balance / original purchase price
    const ltvRatio = (remainingBalance / homeValue) * 100;
    
    // Only auto-calculate if field hasn't been manually entered
    if (pmiField.dataset.calculated === 'false') {
        if (pmiNote) pmiNote.style.display = 'none';
        return;
    }
    
    if (ltvRatio > 80) {
        // PMI required — estimate at 0.5% annually of original purchase price
        const annualPMI = homeValue * 0.005;
        const monthlyPMI = annualPMI / 12;
        pmiField.value = formatMoneyDisplay(Math.round(monthlyPMI));
        pmiField.dataset.calculated = 'true';
        if (pmiNote) {
            pmiNote.style.display = 'none';
        }
    } else {
        // LTV ≤ 80% — PMI should be eliminated
        pmiField.value = '$0';
        pmiField.dataset.calculated = 'true';
        if (pmiNote) {
            const pct = ltvRatio.toFixed(1);
            pmiNote.textContent = `No PMI needed — LTV is ${pct}% (≤ 80%)`;
            pmiNote.style.display = 'block';
        }
    }
}

function calculate(autoRun = false) {
    // Get input values
    const currentPayment = parseMoney(document.getElementById('currentPayment').value);
    const extraPrincipal = parseMoney(document.getElementById('extraPrincipal').value);
    const annualBonus = parseMoney(document.getElementById('annualBonus').value) || 0;
    const originalBalance = parseMoney(document.getElementById('originalBalance').value);
    const remainingBalance = parseMoney(document.getElementById('remainingBalance').value);
    const interestRate = parseFloat(document.getElementById('interestRate').value);
    const originalTerm = parseFloat(document.getElementById('originalTerm').value);
    const remainingTerm = calculateRemainingTerm(); // Get calculated remaining term in years
    const loanStartDate = document.getElementById('loanStartDate').value;
    const homeValue = parseMoney(document.getElementById('homeValue').value) || 0;
    const monthlyPMI = parseMoney(document.getElementById('pmiPayment').value) || 0;
    const taxRate = 20; // Hardcoded 20% capital gains tax rate
    
    // Validate inputs
    if (isNaN(currentPayment) || isNaN(extraPrincipal) || 
        isNaN(originalBalance) || isNaN(remainingBalance) || isNaN(interestRate) || 
        isNaN(originalTerm) || !remainingTerm) {
        if (!autoRun) {
            alert('Please fill in all required fields with valid numbers and ensure loan start date is entered.');
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
    
    // Calculate investment scenarios at accelerated payoff horizon (short comparison)
    const shortWeakInvestment = calculateInvestmentGrowth(extraPrincipal, 4, acceleratedPayoff.monthsToPayoff, annualBonus);
    const shortAvgInvestment = calculateInvestmentGrowth(extraPrincipal, 7, acceleratedPayoff.monthsToPayoff, annualBonus);
    const shortStrongInvestment = calculateInvestmentGrowth(extraPrincipal, 10, acceleratedPayoff.monthsToPayoff, annualBonus);
    const shortInvestment = { weak: shortWeakInvestment, average: shortAvgInvestment, strong: shortStrongInvestment };
    
    // Calculate hybrid phase 2: after accelerated payoff, invest freed payments for remaining term
    const currentPaymentPI = parseMoney(document.getElementById('currentPayment').value) || 0;
    const totalFreedMonthly = currentPaymentPI + extraPrincipal;
    const remainingAfterPayoff = Math.max(0, standardPayoff.monthsToPayoff - acceleratedPayoff.monthsToPayoff);
    const hybridPhase2 = {
        weak: remainingAfterPayoff > 0 ? calculateInvestmentGrowth(totalFreedMonthly, 4, remainingAfterPayoff, annualBonus) : null,
        average: remainingAfterPayoff > 0 ? calculateInvestmentGrowth(totalFreedMonthly, 7, remainingAfterPayoff, annualBonus) : null,
        strong: remainingAfterPayoff > 0 ? calculateInvestmentGrowth(totalFreedMonthly, 10, remainingAfterPayoff, annualBonus) : null,
        totalFreedMonthly,
        startMonth: acceleratedPayoff.monthsToPayoff
    };
    
    // Update summary cards
    updateSummaryCards(standardPayoff, acceleratedPayoff, weakInvestment, averageInvestment, strongInvestment, hybridPhase2, shortInvestment);
    
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
    createCombinedStrategyChart(acceleratedPayoff, standardPayoff, weakInvestment, averageInvestment, strongInvestment, hybridPhase2);
    

}

function updateSummaryCards(standard, accelerated, weak, average, strong, hybridPhase2, shortInvestment) {
    const currentDate = new Date();
    
    // Get loan details for historical calculation
    const originalBalance = parseMoney(document.getElementById('originalBalance').value);
    const remainingBalance = parseMoney(document.getElementById('remainingBalance').value);
    const interestRate = parseFloat(document.getElementById('interestRate').value);
    const originalTerm = parseFloat(document.getElementById('originalTerm').value);
    const loanStartDate = document.getElementById('loanStartDate').value;
    const annualBonus = parseMoney(document.getElementById('annualBonus').value) || 0;
    
    // Calculate interest saved (always accounting for historical payments if loan start date exists)
    const baselineStandard = window.lastStandardPayoff || standard;
    let interestSaved = baselineStandard.totalInterest - accelerated.totalInterest;
    
    if (loanStartDate && originalBalance && remainingBalance) {
        const historical = calculateHistoricalPayments(
            originalBalance, remainingBalance, interestRate, originalTerm, loanStartDate
        );
        if (historical.monthsElapsed > 0) {
            interestSaved = getHistoricalAdjustedInterestSavings(baselineStandard, accelerated);
        }
    }
    
    const extraPrincipal = parseMoney(document.getElementById('extraPrincipal').value);
    
    // Update interest saved display
    document.getElementById('interestSaved').textContent = formatCurrency(interestSaved);
    
    // --- Verdict card: Payoff vs Invest ---
    const estimatedIncome = getEstimatedIncomeFromMortgage();
    const fullTermMonths = standard.monthsToPayoff;
    const payoffMonths = accelerated.monthsToPayoff;
    const fullTaxRate = calculateDynamicTaxRate(fullTermMonths, estimatedIncome);
    const shortTaxRate = calculateDynamicTaxRate(payoffMonths, estimatedIncome);
    
    // === Section 1: At payoff (short horizon) ===
    // Payoff side = guaranteed interest saved
    const shortPayoffValue = interestSaved;
    
    // Invest side = after-tax investment at accelerated payoff month
    const shortInvestResults = {};
    ['weak', 'average', 'strong'].forEach(label => {
        const s = shortInvestment[label];
        const gains = s.totalGains;
        const tax = gains * (shortTaxRate / 100);
        shortInvestResults[label] = s.totalContributions + (gains - tax);
    });
    
    // === Section 2: Full term (hybrid vs pure) ===
    // Payoff side (hybrid): interest saved + after-tax phase 2 investment of freed payments
    const payoffResults = {};
    ['weak', 'average', 'strong'].forEach(label => {
        let total = interestSaved;
        if (hybridPhase2 && hybridPhase2[label]) {
            const phase2 = hybridPhase2[label];
            const phase2Tax = phase2.totalGains * (fullTaxRate / 100);
            total += phase2.totalContributions + (phase2.totalGains - phase2Tax);
        }
        payoffResults[label] = total;
    });
    
    // Invest side = after-tax investment for full standard term
    const investResults = {};
    [{ data: weak, label: 'weak' }, { data: average, label: 'average' }, { data: strong, label: 'strong' }].forEach(s => {
        const gains = s.data.totalGains;
        const tax = gains * (fullTaxRate / 100);
        investResults[s.label] = s.data.totalContributions + (gains - tax);
    });
    
    // Determine winner from full-term comparison (the definitive one)
    const payoffAvg = payoffResults.average;
    const investAvg = investResults.average;
    const fullDiff = investAvg - payoffAvg;
    
    const shortInvestAvg = shortInvestResults.average;
    const shortDiff = shortInvestAvg - shortPayoffValue;
    
    // Update verdict card
    const verdictBanner = document.getElementById('verdictBanner');
    const verdictDescription = document.getElementById('verdictDescription');
    
    if (extraPrincipal <= 0 && annualBonus <= 0) {
        verdictBanner.textContent = 'Add extra payments to compare';
        verdictBanner.className = 'verdict-banner neutral';
        verdictDescription.textContent = 'Enter a monthly overpayment or annual lump sum to see whether paying down your mortgage or investing comes out ahead.';
        // Short section
        document.getElementById('verdictShortPayoff').textContent = '-';
        document.getElementById('verdictShortInvest').textContent = '-';
        document.getElementById('verdictShortDiff').textContent = '-';
        document.getElementById('verdictShortHeader').textContent = '📍 At payoff';
        // Full section
        document.getElementById('verdictPayoff').textContent = '-';
        document.getElementById('verdictInvest').textContent = '-';
        document.getElementById('verdictDiff').textContent = '-';
        document.getElementById('verdictFullHeader').textContent = '📅 Full term';
        // Range
        document.getElementById('verdictWeak').textContent = '-';
        document.getElementById('verdictStrong').textContent = '-';
    } else {
        const payoffYears = Math.floor(payoffMonths / 12);
        const payoffRemMonths = payoffMonths % 12;
        const payoffTimeLabel = payoffRemMonths > 0 ? `${payoffYears}y ${payoffRemMonths}mo` : `${payoffYears}y`;
        const fullYears = Math.floor(fullTermMonths / 12);
        const fullRemMonths = fullTermMonths % 12;
        const fullTimeLabel = fullRemMonths > 0 ? `${fullYears}y ${fullRemMonths}mo` : `${fullYears}y`;
        
        // Banner — based on full-term comparison
        if (fullDiff > 0) {
            verdictBanner.textContent = `📈 Investing wins by ${formatCurrency(fullDiff)}`;
            verdictBanner.className = 'verdict-banner invest-wins';
            verdictDescription.textContent = `At average market returns (7%), investing your extra ${formatCurrency(extraPrincipal)}/mo comes out ahead over the full term — but it's not guaranteed.`;
        } else if (fullDiff < 0) {
            verdictBanner.textContent = `🏠 Payoff + invest wins by ${formatCurrency(Math.abs(fullDiff))}`;
            verdictBanner.className = 'verdict-banner payoff-wins';
            verdictDescription.textContent = `Paying off early and then investing freed payments beats pure investing at average returns (7%).`;
        } else {
            verdictBanner.textContent = `⚖️ It's a wash`;
            verdictBanner.className = 'verdict-banner neutral';
            verdictDescription.textContent = `Both strategies produce roughly equal results at average market returns.`;
        }
        
        // Short section (at payoff)
        document.getElementById('verdictShortHeader').textContent = `📍 At payoff (${payoffTimeLabel})`;
        document.getElementById('verdictShortPayoff').textContent = formatCurrency(shortPayoffValue) + ' saved';
        document.getElementById('verdictShortInvest').textContent = formatCurrency(shortInvestAvg);
        document.getElementById('verdictShortDiff').textContent = (shortDiff >= 0 ? '+' : '') + formatCurrency(shortDiff);
        
        // Full section (hybrid vs pure)
        document.getElementById('verdictFullHeader').textContent = `📅 Full term (${fullTimeLabel})`;
        document.getElementById('verdictPayoff').textContent = formatCurrency(payoffAvg);
        document.getElementById('verdictInvest').textContent = formatCurrency(investAvg);
        document.getElementById('verdictDiff').textContent = (fullDiff >= 0 ? '+' : '') + formatCurrency(fullDiff);
        
        // Range (full-term, invest vs payoff)
        document.getElementById('verdictWeak').textContent = formatCurrency(investResults.weak) + ' vs ' + formatCurrency(payoffResults.weak);
        document.getElementById('verdictStrong').textContent = formatCurrency(investResults.strong) + ' vs ' + formatCurrency(payoffResults.strong);
    }
    
    // Update P&I verification card
    updatePIVerificationCard();
}

function updatePIVerificationCard() {
    const originalBalance = parseMoney(document.getElementById('originalBalance').value);
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
    document.getElementById('currentPayment').value = formatMoneyDisplay(calculatedPI);
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
        bonusInfo.innerHTML = `<small style="color: #10b981; font-weight: 600;">Total Bonus Applied: ${formatCurrency(accelerated.totalBonusApplied)}</small>`;
        
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
        previousPaymentsInfo.innerHTML = `<small style="color: #3b82f6; font-weight: 600;"> Previous Extra Payments Detected: Already ${formatTime(monthsSavedAlready)} ahead of original schedule</small>`;
        
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
    
    // Read loan parameters for full lifecycle view
    const originalBalance = parseMoney(document.getElementById('originalBalance').value) || 0;
    const remainingBalance = parseMoney(document.getElementById('remainingBalance').value);
    const interestRate = parseFloat(document.getElementById('interestRate').value);
    const originalTerm = parseFloat(document.getElementById('originalTerm').value) || 0;
    const loanStartDate = document.getElementById('loanStartDate').value;
    
    // Determine whether we have enough info for historical data
    const hasHistoricalData = loanStartDate && originalTerm > 0 && originalBalance > 0;
    
    let monthsElapsed = 0;
    let chartStartDate = new Date();
    
    if (hasHistoricalData) {
        chartStartDate = new Date(loanStartDate + '-01');
        const now = new Date();
        monthsElapsed = (now.getFullYear() - chartStartDate.getFullYear()) * 12 +
                        (now.getMonth() - chartStartDate.getMonth());
        monthsElapsed = Math.max(0, monthsElapsed);
    }
    
    const initialBalance = hasHistoricalData ? originalBalance : remainingBalance;
    const totalOriginalMonths = hasHistoricalData ? Math.round(originalTerm * 12) : 0;
    
    // Full timeline: original loan term, or at least enough for both schedules
    const maxMonths = hasHistoricalData
        ? Math.max(totalOriginalMonths, monthsElapsed + Math.max(standard.schedule.length, accelerated.schedule.length))
        : Math.max(standard.schedule.length, accelerated.schedule.length);
    
    // Date labels from chart start date through full timeline
    const dateLabels = [];
    for (let i = 0; i < maxMonths; i++) {
        const d = new Date(chartStartDate.getFullYear(), chartStartDate.getMonth() + i + 1, 1);
        dateLabels.push(d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }));
    }
    
    // Estimate historical interest using average approximation
    let estimatedHistoricalInterest = 0;
    if (hasHistoricalData && monthsElapsed > 0) {
        const monthlyRate = interestRate / 100 / 12;
        const origPayments = Math.round(originalTerm * 12);
        if (monthlyRate > 0 && origPayments > 0) {
            const stdPayment = originalBalance * (monthlyRate * Math.pow(1 + monthlyRate, origPayments)) /
                              (Math.pow(1 + monthlyRate, origPayments) - 1);
            const principalPaid = originalBalance - remainingBalance;
            estimatedHistoricalInterest = Math.max(0, stdPayment * monthsElapsed - principalPaid);
        }
    }
    
    // Build full arrays: historical (shared) + forward (divergent)
    const standardBalanceData = [];
    const acceleratedBalanceData = [];
    const standardInterestData = [];
    const acceleratedInterestData = [];
    
    // Historical portion — linear interpolation from original to current (same for both)
    const principalPaidSoFar = originalBalance - remainingBalance;
    for (let i = 0; i < monthsElapsed && i < maxMonths; i++) {
        const progress = (i + 1) / monthsElapsed;
        const histBalance = initialBalance - (principalPaidSoFar * progress);
        const histInterest = estimatedHistoricalInterest * progress;
        standardBalanceData.push(histBalance);
        acceleratedBalanceData.push(histBalance);
        standardInterestData.push(histInterest);
        acceleratedInterestData.push(histInterest);
    }
    
    // Forward portion from calculated schedules, offset interest by historical amount
    const forwardMonths = maxMonths - monthsElapsed;
    for (let i = 0; i < forwardMonths; i++) {
        if (i < standard.schedule.length) {
            standardBalanceData.push(standard.schedule[i].balance);
            standardInterestData.push(estimatedHistoricalInterest + standard.schedule[i].totalInterest);
        } else {
            standardBalanceData.push(0);
            standardInterestData.push(standardInterestData[standardInterestData.length - 1] || 0);
        }
        
        if (i < accelerated.schedule.length) {
            acceleratedBalanceData.push(accelerated.schedule[i].balance);
            acceleratedInterestData.push(estimatedHistoricalInterest + accelerated.schedule[i].totalInterest);
        } else {
            acceleratedBalanceData.push(0);
            acceleratedInterestData.push(acceleratedInterestData[acceleratedInterestData.length - 1] || 0);
        }
    }
    
    // Calculate equity data (original balance - current balance)
    const standardEquity = standardBalanceData.map(bal => initialBalance - bal);
    const acceleratedEquity = acceleratedBalanceData.map(bal => initialBalance - bal);
    
    // Build original amortization shadow line (true original schedule from day 1, no extra payments)
    const originalBalanceData = [];
    const originalEquityData = [];
    const originalInterestData = [];
    let hasOriginalLine = false;
    if (hasHistoricalData) {
        const monthlyRate = interestRate / 100 / 12;
        const origPayments = Math.round(originalTerm * 12);
        if (monthlyRate > 0 && origPayments > 0) {
            const origPayment = originalBalance * (monthlyRate * Math.pow(1 + monthlyRate, origPayments)) /
                               (Math.pow(1 + monthlyRate, origPayments) - 1);
            let bal = originalBalance;
            let totalInt = 0;
            for (let i = 0; i < maxMonths; i++) {
                if (i < origPayments && bal > 0.01) {
                    const interest = bal * monthlyRate;
                    const principal = origPayment - interest;
                    totalInt += interest;
                    bal = Math.max(0, bal - principal);
                    originalBalanceData.push(bal);
                    originalEquityData.push(originalBalance - bal);
                    originalInterestData.push(totalInt);
                } else {
                    originalBalanceData.push(0);
                    originalEquityData.push(originalBalance);
                    originalInterestData.push(totalInt);
                }
            }
            hasOriginalLine = true;
        }
    }
    
    // Group indices for highlight-on-hover: Current=0-2, Extra=3-5, Original=6-8
    const groupOf = (idx) => idx < 3 ? 'current' : idx < 6 ? 'extra' : 'original';
    
    // Colors shared across groups for each metric type
    const balanceColor = '#ef4444';
    const equityColor = '#8b5cf6';
    const interestColor = '#f59e0b';
    const origGrey = isDark ? 'rgba(148, 163, 184, 0.4)' : 'rgba(100, 116, 139, 0.35)';
    
    balanceChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dateLabels,
            datasets: [
                // ── Current Pace (dashed, muted) ──
                {
                    label: 'Balance',
                    data: standardBalanceData,
                    borderColor: balanceColor,
                    backgroundColor: 'rgba(239, 68, 68, 0.03)',
                    borderWidth: 1.5,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    borderDash: [6, 4],
                    yAxisID: 'y',
                    group: 'current'
                },
                {
                    label: 'Equity',
                    data: standardEquity,
                    borderColor: equityColor,
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    borderDash: [6, 4],
                    yAxisID: 'y',
                    group: 'current'
                },
                {
                    label: 'Interest Paid',
                    data: standardInterestData,
                    borderColor: interestColor,
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    borderDash: [6, 4],
                    yAxisID: 'y1',
                    group: 'current'
                },
                // ── With Extra Payments (solid, bold) ──
                {
                    label: 'Balance',
                    data: acceleratedBalanceData,
                    borderColor: balanceColor,
                    backgroundColor: 'rgba(239, 68, 68, 0.06)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4,
                    pointRadius: 0,
                    yAxisID: 'y',
                    group: 'extra'
                },
                {
                    label: 'Equity',
                    data: acceleratedEquity,
                    borderColor: equityColor,
                    backgroundColor: 'transparent',
                    borderWidth: 2.5,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    yAxisID: 'y',
                    group: 'extra'
                },
                {
                    label: 'Interest Paid',
                    data: acceleratedInterestData,
                    borderColor: interestColor,
                    backgroundColor: 'transparent',
                    borderWidth: 2.5,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    yAxisID: 'y1',
                    group: 'extra'
                },
                // ── Original Schedule (dotted grey, only if historical) ──
                ...(hasOriginalLine ? [{
                    label: 'Balance',
                    data: originalBalanceData,
                    borderColor: origGrey,
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    borderDash: [3, 3],
                    yAxisID: 'y',
                    group: 'original'
                },
                {
                    label: 'Equity',
                    data: originalEquityData,
                    borderColor: origGrey,
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    borderDash: [3, 3],
                    yAxisID: 'y',
                    group: 'original'
                },
                {
                    label: 'Interest',
                    data: originalInterestData,
                    borderColor: origGrey,
                    backgroundColor: 'transparent',
                    borderWidth: 1.5,
                    fill: false,
                    tension: 0.4,
                    pointRadius: 0,
                    borderDash: [3, 3],
                    yAxisID: 'y1',
                    group: 'original'
                }] : [])
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
                    display: false // replaced by custom HTML legend
                },
                tooltip: {
                    backgroundColor: isDark ? '#334155' : '#ffffff',
                    titleColor: textColor,
                    bodyColor: textColor,
                    borderColor: gridColor,
                    borderWidth: 1,
                    callbacks: {
                        label: function(context) {
                            const groupNames = { current: 'Current', extra: 'Extra', original: 'Original' };
                            const gName = groupNames[context.dataset.group] || '';
                            return ' ' + gName + ' - ' + context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        },
                        afterLabel: function(context) {
                            if (context.datasetIndex === 2 || (context.datasetIndex === 5 && hasOriginalLine)) {
                                return '  ─────────────────';
                            }
                            return '';
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
                        autoSkip: false,
                        maxRotation: 0,
                        callback: function(value, index) {
                            const label = dateLabels[index];
                            if (!label || !label.startsWith('Jan')) return '';
                            return parseInt(label.split(' ')[1]).toString();
                        }
                    },
                    grid: {
                        color: function(context) {
                            // Only show grid lines at year ticks
                            const index = context.tick?.value;
                            const label = dateLabels[index];
                            if (!label || !label.startsWith('Jan')) return 'transparent';
                            return document.documentElement.getAttribute('data-theme') === 'dark' ? '#475569' : '#e2e8f0';
                        }
                    }
                },
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    title: {
                        display: true,
                        text: 'Balance & Equity ($)',
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
        },
        plugins: [{
            beforeDraw: function(chart) {
                if (monthsElapsed > 0 && hasHistoricalData) {
                    const ctx2 = chart.ctx;
                    const chartArea = chart.chartArea;
                    const xScale = chart.scales.x;
                    const todayX = xScale.getPixelForValue(monthsElapsed - 1);
                    
                    // Shade the historical area
                    ctx2.save();
                    ctx2.fillStyle = isDark ? 'rgba(148, 163, 184, 0.08)' : 'rgba(148, 163, 184, 0.06)';
                    ctx2.fillRect(chartArea.left, chartArea.top, todayX - chartArea.left, chartArea.bottom - chartArea.top);
                    
                    // Draw "Today" vertical line
                    ctx2.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.3)';
                    ctx2.lineWidth = 2;
                    ctx2.setLineDash([4, 4]);
                    ctx2.beginPath();
                    ctx2.moveTo(todayX, chartArea.top);
                    ctx2.lineTo(todayX, chartArea.bottom);
                    ctx2.stroke();
                    
                    // "Today" label
                    ctx2.fillStyle = textColor;
                    ctx2.font = 'bold 11px sans-serif';
                    ctx2.textAlign = 'center';
                    ctx2.fillText('Today', todayX, chartArea.top - 5);
                    ctx2.restore();
                }
            }
        }]
    });
    
    // ── Build custom grouped legend with hover-to-highlight ──
    const legendEl = document.getElementById('amortLegend');
    if (legendEl) {
        const groups = [
            { key: 'current', title: 'Current Pace', style: 'dashed', indices: [0, 1, 2] },
            { key: 'extra', title: 'With Extra', style: 'solid', indices: [3, 4, 5] }
        ];
        if (hasOriginalLine) {
            groups.push({ key: 'original', title: 'Original Schedule', style: 'dotted', indices: [6, 7, 8] });
        }
        const colors = [balanceColor, equityColor, interestColor];
        const metricLabels = ['Balance', 'Equity', 'Interest Paid'];
        
        let html = '<div class="legend-groups">';
        groups.forEach(g => {
            html += `<div class="legend-group" data-group="${g.key}">`;
            html += `<div class="legend-group-title">${g.title}</div>`;
            html += '<div class="legend-group-items">';
            g.indices.forEach((dsIdx, i) => {
                if (dsIdx >= balanceChart.data.datasets.length) return;
                const c = g.key === 'original' ? (document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(148,163,184,0.5)' : 'rgba(100,116,139,0.45)') : colors[i];
                const dashStyle = g.style === 'dashed' ? 'border-style:dashed;' : g.style === 'dotted' ? 'border-style:dotted;' : '';
                html += `<span class="legend-item" data-ds="${dsIdx}" data-group="${g.key}">`;
                html += `<span class="legend-swatch" style="background:transparent;border:2px solid ${c};${dashStyle}"></span>`;
                html += `${metricLabels[i]}</span>`;
            });
            html += '</div></div>';
        });
        html += '</div>';
        legendEl.innerHTML = html;
        
        // Store original styles for restore
        const origStyles = balanceChart.data.datasets.map(ds => ({
            borderColor: ds.borderColor,
            backgroundColor: ds.backgroundColor,
            borderWidth: ds.borderWidth
        }));
        
        const highlightGroup = (groupKey) => {
            balanceChart.data.datasets.forEach((ds, i) => {
                if (ds.group === groupKey) {
                    ds.borderColor = origStyles[i].borderColor;
                    ds.backgroundColor = origStyles[i].backgroundColor;
                    ds.borderWidth = origStyles[i].borderWidth;
                } else {
                    // Dim non-highlighted lines
                    ds.borderColor = document.documentElement.getAttribute('data-theme') === 'dark' ? 'rgba(148,163,184,0.1)' : 'rgba(148,163,184,0.15)';
                    ds.backgroundColor = 'transparent';
                    ds.borderWidth = 1;
                }
            });
            balanceChart.update('none');
        };
        
        const restoreAll = () => {
            balanceChart.data.datasets.forEach((ds, i) => {
                ds.borderColor = origStyles[i].borderColor;
                ds.backgroundColor = origStyles[i].backgroundColor;
                ds.borderWidth = origStyles[i].borderWidth;
            });
            balanceChart.update('none');
        };
        
        legendEl.querySelectorAll('.legend-group').forEach(groupEl => {
            groupEl.addEventListener('mouseenter', () => {
                const gk = groupEl.dataset.group;
                highlightGroup(gk);
                legendEl.querySelectorAll('.legend-group').forEach(el => {
                    el.classList.toggle('dimmed', el.dataset.group !== gk);
                });
            });
            groupEl.addEventListener('mouseleave', () => {
                restoreAll();
                legendEl.querySelectorAll('.legend-group').forEach(el => el.classList.remove('dimmed'));
            });
        });
    }
}

function createCombinedStrategyChart(acceleratedPayoff, standardPayoff, weak, average, strong, hybridPhase2) {
    const ctx = document.getElementById('combinedStrategyChart').getContext('2d');
    
    if (combinedStrategyChart) {
        combinedStrategyChart.destroy();
    }
    
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const isDark = currentTheme === 'dark';
    const textColor = isDark ? '#f1f5f9' : '#1e293b';
    const gridColor = isDark ? '#475569' : '#e2e8f0';
    
    const extraPrincipal = parseMoney(document.getElementById('extraPrincipal').value) || 0;
    const annualBonus = parseMoney(document.getElementById('annualBonus').value) || 0;
    
    const timelineMonths = standardPayoff.monthsToPayoff;
    const payoffMonth = acceleratedPayoff.monthsToPayoff;
    
    // Date labels
    const currentDate = new Date();
    const dateLabels = [];
    for (let i = 0; i < timelineMonths; i++) {
        const futureDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + i + 1, 1);
        dateLabels.push(futureDate.toLocaleDateString('en-US', { year: 'numeric', month: 'short' }));
    }
    
    // Build data: hybrid payoff strategy vs pure investment
    const payoffLine = [];
    const investWeakLine = [];
    const investAvgLine = [];
    const investStrongLine = [];
    
    const estimatedIncome = getEstimatedIncomeFromMortgage();
    
    for (let month = 1; month <= timelineMonths; month++) {
        const taxRate = calculateDynamicTaxRate(month, estimatedIncome);
        
        // Hybrid payoff: interest saved + phase 2 investment of freed payments
        const standardInterestSoFar = month <= standardPayoff.schedule.length ?
            standardPayoff.schedule[month - 1].totalInterest : standardPayoff.totalInterest;
        const acceleratedInterestSoFar = month <= acceleratedPayoff.schedule.length ?
            acceleratedPayoff.schedule[month - 1].totalInterest : acceleratedPayoff.totalInterest;
        let payoffValue = standardInterestSoFar - acceleratedInterestSoFar;
        
        // After accelerated payoff, add phase 2 investment growth
        if (month > payoffMonth && hybridPhase2 && hybridPhase2.average) {
            const phase2Month = month - payoffMonth;
            const phase2Growth = calculateInvestmentGrowth(hybridPhase2.totalFreedMonthly, 7, phase2Month, annualBonus);
            const phase2Tax = phase2Growth.totalGains * (taxRate / 100);
            payoffValue += phase2Growth.totalContributions + (phase2Growth.totalGains - phase2Tax);
        }
        payoffLine.push(payoffValue);
        
        // Pure investment: invest extra principal for this many months
        if (extraPrincipal > 0 || annualBonus > 0) {
            [4, 7, 10].forEach((rate, idx) => {
                const growth = calculateInvestmentGrowth(extraPrincipal, rate, month, annualBonus);
                const afterTax = growth.totalContributions + (growth.totalGains * (1 - taxRate / 100));
                [investWeakLine, investAvgLine, investStrongLine][idx].push(afterTax);
            });
        } else {
            investWeakLine.push(0);
            investAvgLine.push(0);
            investStrongLine.push(0);
        }
    }
    
    const datasets = [
        {
            label: '🏠 Payoff Then Invest (7%)',
            data: payoffLine,
            borderColor: '#10b981',
            backgroundColor: 'rgba(16, 185, 129, 0.15)',
            fill: true,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 0
        }
    ];
    
    if (extraPrincipal > 0 || annualBonus > 0) {
        // Shaded band between weak and strong
        datasets.push({
            label: '📈 Invest Only (7%)',
            data: investAvgLine,
            borderColor: '#3b82f6',
            backgroundColor: 'transparent',
            fill: false,
            tension: 0.4,
            borderWidth: 3,
            pointRadius: 0
        });
        datasets.push({
            label: 'Bull 10%',
            data: investStrongLine,
            borderColor: 'rgba(59, 130, 246, 0.2)',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            fill: '-1',
            tension: 0.4,
            borderWidth: 1,
            pointRadius: 0,
            borderDash: [4, 4]
        });
        datasets.push({
            label: 'Bear 4%',
            data: investWeakLine,
            borderColor: 'rgba(59, 130, 246, 0.2)',
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
            fill: '-2',
            tension: 0.4,
            borderWidth: 1,
            pointRadius: 0,
            borderDash: [4, 4]
        });
    }
    
    combinedStrategyChart = new Chart(ctx, {
        type: 'line',
        data: { labels: dateLabels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: { intersect: false, mode: 'index' },
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        color: textColor,
                        usePointStyle: true,
                        padding: 15,
                        filter: function(item) {
                            // Hide the band edges from legend
                            return item.text !== 'Bull 10%' && item.text !== 'Bear 4%';
                        }
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    callbacks: {
                        label: function(context) {
                            if (context.dataset.label === 'Bull 10%' || context.dataset.label === 'Bear 4%') return null;
                            return ' ' + context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        },
                        afterBody: function(tooltipItems) {
                            const monthIndex = tooltipItems[0].dataIndex;
                            if (investWeakLine[monthIndex] > 0) {
                                return [`Range: ${formatCurrency(investWeakLine[monthIndex])} (4%) – ${formatCurrency(investStrongLine[monthIndex])} (10%)`];
                            }
                            return [];
                        }
                    }
                }
            },
            scales: {
                x: {
                    display: true,
                    title: { display: true, text: 'Timeline', color: textColor },
                    ticks: {
                        color: textColor,
                        autoSkip: false,
                        maxRotation: 0,
                        callback: function(value, index) {
                            const label = dateLabels[index];
                            if (!label || !label.startsWith('Jan')) return '';
                            return parseInt(label.split(' ')[1]).toString();
                        }
                    },
                    grid: {
                        color: function(context) {
                            const index = context.tick?.value;
                            const label = dateLabels[index];
                            if (!label || !label.startsWith('Jan')) return 'transparent';
                            return document.documentElement.getAttribute('data-theme') === 'dark' ? '#475569' : '#e2e8f0';
                        }
                    }
                },
                y: {
                    display: true,
                    title: { display: true, text: 'Cumulative Value ($)', color: textColor },
                    ticks: {
                        color: textColor,
                        callback: function(value) { return formatCurrency(value); }
                    },
                    grid: { color: gridColor }
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
    const currentExtraPrincipal = parseMoney(document.getElementById('extraPrincipal').value) || 0;
    const annualBonus = parseMoney(document.getElementById('annualBonus').value) || 0;
    const homeValue = parseMoney(document.getElementById('homeValue').value) || 0;
    const monthlyPMI = parseMoney(document.getElementById('pmiPayment').value) || 0;
    
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
    const annualBonus = parseMoney(document.getElementById('annualBonus').value) || 0;
    const homeValue = parseMoney(document.getElementById('homeValue').value) || 0;
    const monthlyPMI = parseMoney(document.getElementById('pmiPayment').value) || 0;
    
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
// Tooltip functionality
function showTooltip(type) {
    try {
        const modal = document.getElementById('tooltip-modal');
        const title = document.getElementById('tooltip-title');
        const body = document.getElementById('tooltip-body');
        
        // Get current values for calculations
        const originalBalance = parseMoney(document.getElementById('originalBalance').value) || 0;
        const remainingBalance = parseMoney(document.getElementById('remainingBalance').value) || 0;
        const interestRate = parseFloat(document.getElementById('interestRate').value) || 0;
        const homeValue = parseMoney(document.getElementById('homeValue').value) || 0;
        const originalTerm = parseFloat(document.getElementById('originalTerm').value) || 0;
        const loanStartDate = document.getElementById('loanStartDate').value;
        const extraPrincipal = parseMoney(document.getElementById('extraPrincipal').value) || 0;
        const annualBonus = parseMoney(document.getElementById('annualBonus').value) || 0;
        
        // Calculate some derived values
        const monthlyRate = interestRate / 100 / 12;
        const totalPayments = originalTerm * 12;
        const monthlyPI = originalBalance > 0 && interestRate > 0 && originalTerm > 0 
            ? calculateMonthlyPI(originalBalance, interestRate, originalTerm) 
            : 0;
        
        // Use the actual PMI value from the field (whether calculated or manually entered)
        const actualMonthlyPMI = parseMoney(document.getElementById('pmiPayment').value) || 0;
        
        // Calculate what the auto-calculated PMI would be for comparison
        const originalLTV = originalBalance > 0 && homeValue > 0 ? (originalBalance / homeValue) * 100 : 0;
        const autoCalculatedPMI = originalLTV > 80 ? (homeValue * 0.005) / 12 : 0;
        const pmiThreshold = homeValue * 0.8;
        
        // Check if PMI was manually entered
        const pmiField = document.getElementById('pmiPayment');
        const isManuallyEntered = pmiField.dataset.calculated !== 'true' && pmiField.value !== '';
        
        let content = '';
        
        switch(type) {
        case 'mortgage-details':
            title.textContent = '🏡 Original Loan Terms - How Values Are Used';
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
            
            title.textContent = '� Current Loan Status - Where You Stand Today';
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
            title.textContent = '💰 Extra Payments - How They Accelerate Payoff';
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
            
        case 'pure-investment':
            title.textContent = '⚖️ Payoff vs Invest — How the Comparison Works';
            content = `
                <div class="calculation-section">
                    <h5>🏠 Strategy A: Payoff Then Invest</h5>
                    <p>Use extra payments to accelerate your mortgage payoff, then invest the <strong>entire freed payment</strong> (P&I + extra + bonus) for the remaining term.</p>
                    <div class="formula">Phase 1: Extra → mortgage payoff (saves interest).</div>
                    <div class="formula">Phase 2: P&I + Extra → investments for remaining months.</div>
                    <div class="formula">Total = Interest Saved + After-Tax Phase 2 Portfolio</div>
                </div>
                
                <div class="calculation-section">
                    <h5>📈 Strategy B: Invest Only</h5>
                    <p>Instead of overpaying the mortgage, invest extra payments from day one for the full remaining loan term.</p>
                    <div class="formula">Monthly: $${extraPrincipal.toLocaleString()} + Annual: $${annualBonus.toLocaleString()}</div>
                    <div class="formula">Total = After-Tax Investment Portfolio</div>
                </div>
                
                <div class="calculation-section">
                    <h5>🤝 Why This Is a Fair Comparison</h5>
                    <p>Both strategies use the <strong>same monthly budget</strong> (P&I + extra) and the <strong>same time horizon</strong> (full remaining term). The only difference is where the money goes each month.</p>
                </div>
                
                <div class="calculation-section">
                    <h5>💸 Tax Treatment</h5>
                    <p>Capital gains tax is applied to investment gains in both strategies. Interest savings are tax-free.</p>
                    <div class="formula">After-Tax Value = Contributions + Gains × (1 − Tax Rate)</div>
                </div>
                
                <div class="calculation-section">
                    <h5>🔍 Risk Considerations</h5>
                    <ul>
                        <li>✅ Interest savings from payoff are <strong>guaranteed</strong></li>
                        <li>⚠️ Investment returns are <strong>not guaranteed</strong> — shown at 4%, 7%, and 10%</li>
                        <li>✅ Strategy A has guaranteed savings + market upside</li>
                        <li>✅ Strategy B maintains full liquidity throughout</li>
                    </ul>
                </div>
                
                <div class="current-values">
                    <h6>🔢 Your Numbers:</h6>
                    <ul class="value-list">
                        <li><span>Monthly Extra:</span> <strong>$${extraPrincipal.toLocaleString()}</strong></li>
                        <li><span>Annual Bonus:</span> <strong>$${annualBonus.toLocaleString()}</strong></li>
                        <li><span>P&I Payment:</span> <strong>$${monthlyPI.toLocaleString()}</strong></li>
                        <li><span>Freed Monthly After Payoff:</span> <strong>$${(monthlyPI + extraPrincipal).toLocaleString()}</strong></li>
                        <li><span>Break-Even Rate:</span> <strong>${(interestRate / 0.8).toFixed(2)}% annual return</strong></li>
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
                        <li><span>Original Purchase Price:</span> <strong>$${homeValue.toLocaleString()}</strong></li>
                        <li><span>Original LTV Ratio:</span> <strong>${originalLTV.toFixed(1)}%</strong></li>
                        <li><span>Down Payment:</span> <strong>${(100 - originalLTV).toFixed(1)}% ($${((homeValue - originalBalance)).toLocaleString()})</strong></li>
                        <li><span>PMI Required:</span> <strong>${originalLTV > 80 ? 'Yes (LTV > 80%)' : 'No (LTV ≤ 80%)'}</strong></li>
                        <li><span>Current PMI (in field):</span> <strong>$${actualMonthlyPMI.toLocaleString()}/month</strong></li>
                        <li><span>Auto-calculated PMI would be:</span> <strong>$${Math.round(autoCalculatedPMI).toLocaleString()}/month</strong></li>
                        <li><span>Implied Annual Rate:</span> <strong>${actualMonthlyPMI > 0 ? ((actualMonthlyPMI * 12 / homeValue) * 100).toFixed(2) : '0.00'}%</strong></li>
                        <li><span>PMI Status:</span> <strong>${isManuallyEntered ? 'Manually Entered' : 'Auto-Calculated'}</strong></li>
                        <li><span>Elimination Threshold:</span> <strong>$${pmiThreshold.toLocaleString()} (80% of home value)</strong></li>
                        <li><span>Current Balance:</span> <strong>$${remainingBalance.toLocaleString()}</strong></li>
                        <li><span>PMI Should Eliminate:</span> <strong>${remainingBalance <= pmiThreshold ? 'Yes - Balance ≤ 80% LTV' : 'No - Balance > 80% LTV'}</strong></li>
                    </ul>
                    
                    ${actualMonthlyPMI !== Math.round(autoCalculatedPMI) && actualMonthlyPMI > 0 ? `
                    <div class="rate-comparison" style="margin-top: 15px; padding: 10px; background: var(--accent-color); border-radius: 8px;">
                        <h6 style="color: var(--text-primary); margin-bottom: 8px;">💡 Rate Comparison:</h6>
                        <p style="color: var(--text-primary); margin: 0; font-size: 0.9em;">
                            <strong>Your Rate:</strong> ${((actualMonthlyPMI * 12 / homeValue) * 100).toFixed(2)}% vs 
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
