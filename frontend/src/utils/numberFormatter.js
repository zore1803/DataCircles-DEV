/**
 * Format number according to Indian Numbering System
 * Examples: 1000 -> 1,000 | 100000 -> 1,00,000 | 10000000 -> 1,00,00,000
 */
export const formatNumberToIndian = (num) => {
  if (num === null || num === undefined || isNaN(num)) {
    return "0";
  }

  const numStr = Math.floor(num).toString();

  if (numStr.length <= 3) {
    return numStr;
  }

  let result = "";
  let count = 0;

  // Reverse the string to process from right to left
  for (let i = numStr.length - 1; i >= 0; i--) {
    if (count === 3 || (count > 3 && (count - 3) % 2 === 0)) {
      result = "," + result;
    }
    result = numStr[i] + result;
    count++;
  }

  return result;
};

/**
 * Format currency amount according to Indian Numbering System with Rupee symbol
 * Examples: 1000 -> ₹1,000 | 100000 -> ₹1,00,000 | 10000000 -> ₹1,00,00,000
 */
export const formatCurrencyToIndian = (num) => {
  return `₹${formatNumberToIndian(num)}`;
};

/**
 * Format decimal amounts to Indian Numbering System
 * Examples: 1000.50 -> 1,000.50 | 100000.99 -> 1,00,000.99
 */
export const formatDecimalToIndian = (num) => {
  if (num === null || num === undefined || isNaN(num)) {
    return "0";
  }

  const parts = num.toString().split(".");
  const integerPart = parts[0];
  const decimalPart = parts[1];

  const formattedInteger = formatNumberToIndian(parseInt(integerPart));

  if (decimalPart) {
    return `${formattedInteger}.${decimalPart}`;
  }

  return formattedInteger;
};

/**
 * Format currency with decimals according to Indian Numbering System
 * Examples: 1000.50 -> ₹1,000.50 | 100000.99 -> ₹1,00,000.99
 */
export const formatCurrencyWithDecimalToIndian = (num) => {
  return `₹${formatDecimalToIndian(num)}`;
};

/**
 * Format number with custom precision (2 decimals by default)
 * Examples: 1000.567 -> 1,000.57 | 100000.1 -> 1,00,000.10
 */
export const formatCurrencyFixed = (num, decimals = 2) => {
  if (num === null || num === undefined || isNaN(num)) {
    return formatCurrencyToIndian(0);
  }

  const fixed = parseFloat(num).toFixed(decimals);
  return formatCurrencyWithDecimalToIndian(fixed);
};
