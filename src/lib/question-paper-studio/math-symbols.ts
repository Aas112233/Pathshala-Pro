export interface MathSymbolGroup {
  category: string;
  symbols: {
    label: string;
    value: string;
    tooltip?: string;
  }[];
}

export const MATH_SYMBOL_GROUPS: MathSymbolGroup[] = [
  {
    category: 'মৌলিক চিহ্ন (Operators & Relations)',
    symbols: [
      { label: '±', value: '±', tooltip: 'Plus-minus' },
      { label: '×', value: '×', tooltip: 'Multiply' },
      { label: '÷', value: '÷', tooltip: 'Divide' },
      { label: '≠', value: '≠', tooltip: 'Not equal' },
      { label: '≈', value: '≈', tooltip: 'Approximately' },
      { label: '≤', value: '≤', tooltip: 'Less than or equal' },
      { label: '≥', value: '≥', tooltip: 'Greater than or equal' },
      { label: '≡', value: '≡', tooltip: 'Equivalent / Congruent' },
      { label: '∝', value: '∝', tooltip: 'Proportional' },
      { label: '∞', value: '∞', tooltip: 'Infinity' },
      { label: '√', value: '√', tooltip: 'Square root' },
      { label: '∛', value: '∛', tooltip: 'Cube root' },
      { label: '°', value: '°', tooltip: 'Degree' },
      { label: '∠', value: '∠', tooltip: 'Angle' },
      { label: '△', value: '△', tooltip: 'Triangle' },
      { label: '⊥', value: '⊥', tooltip: 'Perpendicular' },
      { label: '∥', value: '∥', tooltip: 'Parallel' },
    ],
  },
  {
    category: 'গ্রিক বর্ণমালা (Greek Letters)',
    symbols: [
      { label: 'α', value: 'α', tooltip: 'Alpha' },
      { label: 'β', value: 'β', tooltip: 'Beta' },
      { label: 'γ', value: 'γ', tooltip: 'Gamma' },
      { label: 'θ', value: 'θ', tooltip: 'Theta' },
      { label: 'λ', value: 'λ', tooltip: 'Lambda' },
      { label: 'μ', value: 'μ', tooltip: 'Mu' },
      { label: 'π', value: 'π', tooltip: 'Pi' },
      { label: 'ρ', value: 'ρ', tooltip: 'Rho' },
      { label: 'σ', value: 'σ', tooltip: 'Sigma (small)' },
      { label: 'Σ', value: 'Σ', tooltip: 'Sigma (sum)' },
      { label: 'τ', value: 'τ', tooltip: 'Tau' },
      { label: 'φ', value: 'φ', tooltip: 'Phi' },
      { label: 'ω', value: 'ω', tooltip: 'Omega (small)' },
      { label: 'Ω', value: 'Ω', tooltip: 'Omega (Ohm)' },
      { label: 'Δ', value: 'Δ', tooltip: 'Delta' },
    ],
  },
  {
    category: 'সুপারস্ক্রিপ্ট ও পাওয়ার (Superscripts)',
    symbols: [
      { label: 'x²', value: '²', tooltip: 'Square (²)' },
      { label: 'x³', value: '³', tooltip: 'Cube (³)' },
      { label: 'x⁴', value: '⁴', tooltip: 'Power 4 (⁴)' },
      { label: 'xⁿ', value: 'ⁿ', tooltip: 'Power n (ⁿ)' },
      { label: 'x⁻¹', value: '⁻¹', tooltip: 'Inverse (⁻¹)' },
      { label: 'x⁻²', value: '⁻²', tooltip: 'Inverse Square (⁻²)' },
      { label: 'x⁺', value: '⁺', tooltip: 'Plus (+)' },
      { label: 'x⁻', value: '⁻', tooltip: 'Minus (-)' },
    ],
  },
  {
    category: 'সাবস্ক্রিপ্ট ও অনুপাত (Subscripts)',
    symbols: [
      { label: 'x₀', value: '₀', tooltip: 'Subscript 0' },
      { label: 'x₁', value: '₁', tooltip: 'Subscript 1' },
      { label: 'x₂', value: '₂', tooltip: 'Subscript 2' },
      { label: 'x₃', value: '₃', tooltip: 'Subscript 3' },
      { label: 'x₄', value: '₄', tooltip: 'Subscript 4' },
      { label: 'xₙ', value: 'ₙ', tooltip: 'Subscript n' },
      { label: '½', value: '½', tooltip: 'One half' },
      { label: '⅓', value: '⅓', tooltip: 'One third' },
      { label: '¼', value: '¼', tooltip: 'One fourth' },
      { label: '¾', value: '¾', tooltip: 'Three fourths' },
    ],
  },
  {
    category: 'পদার্থবিজ্ঞান ও রসায়ন একক (Science Units & Formulas)',
    symbols: [
      { label: 'ms⁻¹', value: 'ms⁻¹', tooltip: 'Velocity (ms⁻¹)' },
      { label: 'ms⁻²', value: 'ms⁻²', tooltip: 'Acceleration (ms⁻²)' },
      { label: 'kg·m/s', value: 'kg·m/s', tooltip: 'Momentum (kg·m/s)' },
      { label: 'g = 9.8 ms⁻²', value: 'g = 9.8 ms⁻²', tooltip: 'Gravitational acceleration' },
      { label: 'H₂O', value: 'H₂O', tooltip: 'Water' },
      { label: 'CO₂', value: 'CO₂', tooltip: 'Carbon Dioxide' },
      { label: 'H₂SO₄', value: 'H₂SO₄', tooltip: 'Sulfuric Acid' },
      { label: 'NaCl', value: 'NaCl', tooltip: 'Sodium Chloride' },
      { label: 'CaCO₃', value: 'CaCO₃', tooltip: 'Calcium Carbonate' },
      { label: 'SO₄²⁻', value: 'SO₄²⁻', tooltip: 'Sulfate Ion' },
    ],
  },
];
