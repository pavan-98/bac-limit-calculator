# BAC Calculator - India Legal Limit

A comprehensive Blood Alcohol Content (BAC) calculator designed specifically for India's legal alcohol limit of 0.03% BAC (30mg/100ml blood).

## Features

### 🍺 Alcohol Categories

- **Beer Options:**

  - Pint Beer (568ml, 5% ABV)
  - Full Beer (650ml, 5% ABV)
  - Pitcher (1.5L, 5% ABV)

- **Whiskey/Vodka Options:**
  - 30ml Shot (40% ABV)
  - 60ml Shot (40% ABV)
  - 90ml Shot (40% ABV)
  - Quarter Bottle (180ml, 40% ABV)
  - Half Bottle (375ml, 40% ABV)
  - Full Bottle (750ml, 40% ABV)

### 📊 Calculation Features

- **Accurate BAC Calculation:** Uses the Widmark formula with gender-specific body water ratios
- **Time-based Metabolism:** Accounts for alcohol elimination over time (0.015% per hour)
- **Interactive Counters:** Easy increment/decrement buttons for each drink type
- **Real-time Results:** Instant calculation with visual feedback

### 🎨 Modern UI/UX

- **Responsive Design:** Works perfectly on desktop, tablet, and mobile devices
- **Beautiful Gradients:** Modern color scheme with smooth transitions
- **Intuitive Interface:** Clear categorization and easy-to-use controls
- **Visual Feedback:** Color-coded results and animated interactions

### ⚖️ Legal Compliance

- **India-specific:** Designed for India's legal BAC limit of 0.03%
- **Safety Warnings:** Clear indicators when approaching or exceeding legal limits
- **Time to Sober:** Calculates estimated time to reach legal sobriety
- **Legal Disclaimer:** Comprehensive disclaimer about calculator limitations

## How to Use

1. **Enter Personal Information:**

   - Weight in kilograms (30-200 kg)
   - Select gender (affects body water ratio)
   - Hours since first drink (optional)

2. **Select Drinks Consumed:**

   - Use + and - buttons to adjust quantities
   - Mix different types of drinks as needed
   - Real-time counter updates

3. **Calculate BAC:**
   - Click "Calculate BAC" button
   - View results with legal status
   - Check estimated time to sobriety

## Technical Details

### BAC Calculation Formula

The calculator uses the Widmark formula:

```
BAC = (Alcohol in grams / (Body weight × Body water ratio)) × 100
```

### Body Water Ratios

- **Male:** 68% of body weight
- **Female:** 55% of body weight

### Alcohol Elimination

- **Rate:** 0.015% BAC per hour (standard metabolism rate)
- **Time Factor:** Subtracts eliminated alcohol based on hours since drinking

### Legal Limits

- **India:** 0.03% BAC (30mg/100ml blood)
- **Warning Threshold:** 80% of legal limit (0.024% BAC)

## Installation

1. Clone or download the repository
2. Open `index.html` in a web browser
3. No additional setup required - works offline

## Files Structure

```
bac-limit-calculator/
├── index.html          # Main HTML structure
├── styles.css          # CSS styling and responsive design
├── script.js           # JavaScript logic and BAC calculations
└── README.md          # This documentation file
```

## Browser Compatibility

- ✅ Chrome/Chromium (recommended)
- ✅ Firefox
- ✅ Safari (with webkit prefixes)
- ✅ Edge
- ✅ Mobile browsers

## Important Legal Disclaimer

⚠️ **This calculator provides estimates only and should not be used as the sole basis for determining whether it's safe to drive.**

BAC can vary significantly based on many factors including:

- Food consumption
- Medications
- Individual metabolism
- Health conditions
- Rate of consumption
- Body composition

**Always follow local laws and drink responsibly. When in doubt, don't drive.**

## Development

The calculator is built with vanilla HTML, CSS, and JavaScript for maximum compatibility and performance. No external dependencies required.

### Key Features:

- **Responsive CSS Grid/Flexbox layout**
- **Modern JavaScript ES6+ features**
- **Accessibility considerations**
- **Cross-browser compatibility**
- **Mobile-first design approach**

## License

This project is open source and available under the MIT License.

## Contributing

Contributions are welcome! Please feel free to submit issues, feature requests, or pull requests.

---

**Remember: This tool is for educational purposes. Always drink responsibly and never drive under the influence of alcohol.**
