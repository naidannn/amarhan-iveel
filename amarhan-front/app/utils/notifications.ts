// Utility function for showing error messages
export const showErrorMessage = (message: string, error?: any) => {
  console.error('Error:', message, error)
  const errorMessage = error?.response?.data?.message || error?.message || message
  alert(errorMessage)
}

// Utility function for showing success messages
export const showSuccessMessage = (message: string) => {
  console.log('Success:', message)
  alert(message)
}

