// BAC Calculation Constants
const ALCOHOL_ELIMINATION_RATE = 0.015; // BAC reduction per hour
const INDIA_LEGAL_LIMIT = 0.03; // 0.03% BAC legal limit in India

// Beer strength options
const BEER_STRENGTHS = {
    light: 0.035,    // 3.5% ABV
    regular: 0.05,   // 5% ABV  
    strong: 0.07     // 7% ABV
};

let currentBeerStrength = 'regular';

// Drink definitions with alcohol content
const DRINKS = {
    // Beer category (ml, ABV%) - ABV will be updated based on beer strength
    small: { volume: 330, abv: 0.05 },
    full: { volume: 650, abv: 0.05 },
    pitcher: { volume: 1500, abv: 0.05 },
    
    // Spirits category (ml, ABV%)
    shot30: { volume: 30, abv: 0.40 },
    shot60: { volume: 60, abv: 0.40 },
    shot90: { volume: 90, abv: 0.40 },
    quarter: { volume: 180, abv: 0.40 },
    half: { volume: 375, abv: 0.40 },
    fullBottle: { volume: 750, abv: 0.40 }
};

// Track drink counts
let drinkCounts = {};
Object.keys(DRINKS).forEach(drink => {
    drinkCounts[drink] = 0;
});

// Gender-specific constants for BAC calculation
const BODY_WATER_RATIO = {
    male: 0.68,
    female: 0.55
};

// Update beer strength and display
function updateBeerStrength() {
    const beerStrengthSelect = document.getElementById('beerStrength');
    currentBeerStrength = beerStrengthSelect.value;
    
    const selectedABV = BEER_STRENGTHS[currentBeerStrength];
    const abvPercentage = (selectedABV * 100).toFixed(1);
    
    // Update beer drinks ABV
    DRINKS.small.abv = selectedABV;
    DRINKS.full.abv = selectedABV;
    DRINKS.pitcher.abv = selectedABV;
    
    // Update display text
    document.getElementById('small-volume').textContent = `(330ml, ${abvPercentage}% ABV)`;
    document.getElementById('full-volume').textContent = `(650ml, ${abvPercentage}% ABV)`;
    document.getElementById('pitcher-volume').textContent = `(1.5L, ${abvPercentage}% ABV)`;
}

// Increment drink counter
function incrementDrink(drinkType) {
    drinkCounts[drinkType]++;
    updateCounter(drinkType);
}

// Decrement drink counter
function decrementDrink(drinkType) {
    if (drinkCounts[drinkType] > 0) {
        drinkCounts[drinkType]--;
        updateCounter(drinkType);
    }
}

// Update counter display
function updateCounter(drinkType) {
    const counter = document.getElementById(`${drinkType}-count`);
    counter.textContent = drinkCounts[drinkType];
    
    // Add animation effect
    counter.style.transform = 'scale(1.2)';
    counter.style.color = '#667eea';
    setTimeout(() => {
        counter.style.transform = 'scale(1)';
        counter.style.color = '#2d3748';
    }, 200);
}

// Calculate total alcohol consumed in grams
function calculateTotalAlcohol() {
    let totalAlcohol = 0;
    
    Object.keys(drinkCounts).forEach(drinkType => {
        const count = drinkCounts[drinkType];
        const drink = DRINKS[drinkType];
        
        if (count > 0) {
            // Calculate alcohol in grams
            // Formula: Volume (ml) × ABV × 0.789 (alcohol density) × count
            const alcoholGrams = drink.volume * drink.abv * 0.789 * count;
            totalAlcohol += alcoholGrams;
        }
    });
    
    return totalAlcohol;
}

// Calculate BAC using Widmark formula
function calculateWidmarkBAC(alcoholGrams, weight, gender, hours) {
    if (!weight || !gender) {
        return 0;
    }
    
    const bodyWaterRatio = BODY_WATER_RATIO[gender];
    const bodyWater = weight * bodyWaterRatio * 1000; // Convert to ml
    
    // Widmark formula: BAC = (Alcohol in grams / Body water in ml) * 100
    let bac = (alcoholGrams / bodyWater) * 100;
    
    // Subtract alcohol eliminated over time
    if (hours > 0) {
        bac -= (ALCOHOL_ELIMINATION_RATE * hours);
    }
    
    // BAC cannot be negative
    return Math.max(0, bac);
}

// Calculate time to reach sobriety
function calculateSoberTime(currentBAC) {
    if (currentBAC <= 0) {
        return 0;
    }
    return Math.ceil(currentBAC / ALCOHOL_ELIMINATION_RATE);
}

// Determine legal status and safety level
function getLegalStatus(bac) {
    if (bac >= INDIA_LEGAL_LIMIT) {
        return {
            status: 'ILLEGAL',
            class: 'danger',
            message: 'You are ABOVE the legal limit for driving in India. Do not drive!'
        };
    } else if (bac >= INDIA_LEGAL_LIMIT * 0.8) {
        return {
            status: 'CAUTION',
            class: 'warning',
            message: 'You are approaching the legal limit. Be very careful!'
        };
    } else {
        return {
            status: 'LEGAL',
            class: 'safe',
            message: 'You are below the legal limit, but still drink responsibly.'
        };
    }
}

// Main BAC calculation function
function calculateBAC() {
    // Get user inputs
    const weight = parseFloat(document.getElementById('weight').value);
    const gender = document.getElementById('gender').value;
    const hours = parseFloat(document.getElementById('hours').value) || 0;
    
    // Validate inputs
    if (!weight || weight < 30 || weight > 200) {
        alert('Please enter a valid weight between 30-200 kg');
        return;
    }
    
    if (!gender) {
        alert('Please select your gender');
        return;
    }
    
    // Check if any drinks were consumed
    const totalDrinks = Object.values(drinkCounts).reduce((sum, count) => sum + count, 0);
    if (totalDrinks === 0) {
        alert('Please select at least one drink');
        return;
    }
    
    // Calculate BAC
    const totalAlcohol = calculateTotalAlcohol();
    const bac = calculateWidmarkBAC(totalAlcohol, weight, gender, hours);
    const soberTime = calculateSoberTime(bac);
    const legalStatus = getLegalStatus(bac);
    
    // Display results
    displayResults(bac, legalStatus, soberTime);
    
    // Scroll to results
    document.getElementById('results').scrollIntoView({ 
        behavior: 'smooth',
        block: 'start'
    });
}

// Display calculation results
function displayResults(bac, legalStatus, soberTime) {
    const resultsSection = document.getElementById('results');
    const bacValue = document.getElementById('bac-value');
    const legalStatusElement = document.getElementById('legal-status');
    const soberTimeElement = document.getElementById('sober-time');
    const warningBox = document.getElementById('warning-box');
    const warningText = document.getElementById('warning-text');
    
    // Show results section
    resultsSection.style.display = 'block';
    
    // Update BAC value
    bacValue.textContent = `${bac.toFixed(3)}%`;
    
    // Update legal status
    legalStatusElement.textContent = legalStatus.status;
    legalStatusElement.className = `result-value ${legalStatus.class}`;
    
    // Update sober time
    if (soberTime === 0) {
        soberTimeElement.textContent = 'Sober';
    } else {
        soberTimeElement.textContent = `${soberTime} hour${soberTime !== 1 ? 's' : ''}`;
    }
    
    // Update result cards styling
    const resultCards = document.querySelectorAll('.result-card');
    resultCards.forEach(card => {
        card.className = `result-card ${legalStatus.class}`;
    });
    
    // Show/hide warning box
    if (legalStatus.status !== 'LEGAL') {
        warningBox.style.display = 'flex';
        warningBox.className = `warning-box ${legalStatus.class}`;
        warningText.textContent = legalStatus.message;
    } else {
        warningBox.style.display = 'none';
    }
    
    // Add animation to BAC value
    bacValue.style.transform = 'scale(1.1)';
    setTimeout(() => {
        bacValue.style.transform = 'scale(1)';
    }, 300);
}

// Reset all counters
function resetCalculator() {
    Object.keys(drinkCounts).forEach(drinkType => {
        drinkCounts[drinkType] = 0;
        updateCounter(drinkType);
    });
    
    document.getElementById('weight').value = '';
    document.getElementById('gender').value = '';
    document.getElementById('hours').value = '';
    document.getElementById('beerStrength').value = 'regular';
    currentBeerStrength = 'regular';
    updateBeerStrength();
    document.getElementById('results').style.display = 'none';
}

// Add keyboard shortcuts
document.addEventListener('keydown', function(event) {
    // Enter key to calculate
    if (event.key === 'Enter' && event.ctrlKey) {
        calculateBAC();
    }
    
    // Escape key to reset
    if (event.key === 'Escape') {
        resetCalculator();
    }
});

// Add input validation
// Save weight and gender to localStorage on change
const weightInput = document.getElementById('weight');
const genderInput = document.getElementById('gender');

weightInput.addEventListener('input', function(e) {
    const value = parseFloat(e.target.value);
    if (value < 30 || value > 200) {
        e.target.style.borderColor = '#ff6b6b';
    } else {
        e.target.style.borderColor = '#e2e8f0';
    }
    // Save to localStorage
    localStorage.setItem('userWeight', e.target.value);
});

genderInput.addEventListener('change', function(e) {
    // Save to localStorage
    localStorage.setItem('userGender', e.target.value);
});

document.getElementById('hours').addEventListener('input', function(e) {
    const value = parseFloat(e.target.value);
    if (value < 0 || value > 24) {
        e.target.style.borderColor = '#ff6b6b';
    } else {
        e.target.style.borderColor = '#e2e8f0';
    }
});

// Initialize on page load
// Restore weight and gender from localStorage if available
document.addEventListener('DOMContentLoaded', function() {
    console.log('BAC Calculator initialized');
    console.log('India Legal Limit: ' + INDIA_LEGAL_LIMIT + '%');
    
    // Initialize beer strength display
    updateBeerStrength();
    
    // Restore weight and gender from localStorage if available
    if (localStorage.getItem('userWeight')) {
        weightInput.value = localStorage.getItem('userWeight');
    }
    if (localStorage.getItem('userGender')) {
        genderInput.value = localStorage.getItem('userGender');
    }
    
    // Add reset button (optional)
    const resetBtn = document.createElement('button');
    resetBtn.textContent = '🔄 Reset Calculator';
    resetBtn.className = 'calculate-btn';
    resetBtn.style.background = 'linear-gradient(135deg, #74b9ff 0%, #0984e3 100%)';
    resetBtn.style.marginTop = '15px';
    resetBtn.onclick = resetCalculator;
    
    const calculateSection = document.querySelector('.calculate-btn').parentNode;
    calculateSection.appendChild(resetBtn);
});

// Utility function to format numbers
function formatNumber(num, decimals = 2) {
    return Number(num.toFixed(decimals));
}

// Export functions for testing (if needed)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateTotalAlcohol,
        calculateWidmarkBAC,
        calculateSoberTime,
        getLegalStatus,
        updateBeerStrength,
        DRINKS,
        BEER_STRENGTHS,
        INDIA_LEGAL_LIMIT
    };
}
