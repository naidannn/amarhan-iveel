/**
 * Format currency in Mongolian Tugrik (₮)
 * @param amount - The amount to format (string or number)
 * @param options - Formatting options
 * @returns Formatted currency string
 */
export function formatCurrency(
  amount: string | number, 
  options: {
    locale?: string;
    currency?: string;
    showSymbol?: boolean;
  } = {}
): string {
  const {
    locale = 'mn-MN',
    currency = '₮',
    showSymbol = true
  } = options

  let numericAmount: number

  // Handle different input types
  if (typeof amount === 'string') {
    // Remove any existing currency symbols, commas, and spaces
    const cleanAmount = amount.replace(/[^\d.-]/g, '')
    numericAmount = parseFloat(cleanAmount)
  } else {
    numericAmount = amount
  }

  // Check if the amount is valid
  if (isNaN(numericAmount)) {
    return amount.toString()
  }

  // Format the number with thousand separators
  const formattedNumber = numericAmount.toLocaleString(locale, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  })

  // Add currency symbol if requested
  return showSymbol ? `${formattedNumber} ${currency}` : formattedNumber
}

/**
 * Parse currency string to number
 * @param currencyString - The currency string to parse
 * @returns Parsed number
 */
export function parseCurrency(currencyString: string): number {
  const cleanString = currencyString.replace(/[^\d.-]/g, '')
  return parseFloat(cleanString) || 0
}

/**
 * Format price range (e.g., "100,000 - 200,000 ₮")
 * @param minPrice - Minimum price
 * @param maxPrice - Maximum price
 * @param options - Formatting options
 * @returns Formatted price range string
 */
export function formatPriceRange(
  minPrice: string | number,
  maxPrice: string | number,
  options: {
    locale?: string;
    currency?: string;
    showSymbol?: boolean;
  } = {}
): string {
  const minFormatted = formatCurrency(minPrice, { ...options, showSymbol: false })
  const maxFormatted = formatCurrency(maxPrice, options)
  
  return `${minFormatted} - ${maxFormatted}`
} 