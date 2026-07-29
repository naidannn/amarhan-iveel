export const useFacebookConversion = () => {
  const trackPurchase = async (order: any) => {
    try {
      const response = await $fetch('/api/v1/facebook-conversion', {
        method: 'POST',
        body: {
          eventType: 'purchase',
          order
        }
      })
      return response
    } catch (error) {
      console.error('Failed to track purchase:', error)
      return { success: false, error: error.message }
    }
  }

  const trackInitiateCheckout = async (order: any) => {
    try {
      const response = await $fetch('/api/v1/facebook-conversion', {
        method: 'POST',
        body: {
          eventType: 'initiate_checkout',
          order
        }
      })
      return response
    } catch (error) {
      console.error('Failed to track initiate checkout:', error)
      return { success: false, error: error.message }
    }
  }

  const trackOrderStatusUpdate = async (order: any, previousStatus: string, newStatus: string) => {
    try {
      const response = await $fetch('/api/v1/facebook-conversion', {
        method: 'POST',
        body: {
          eventType: 'order_status_update',
          order,
          previousStatus,
          newStatus
        }
      })
      return response
    } catch (error) {
      console.error('Failed to track order status update:', error)
      return { success: false, error: error.message }
    }
  }

  const trackCustomEvent = async (eventName: string, eventData: any, userData: any, eventId?: string) => {
    try {
      const response = await $fetch('/api/v1/facebook-conversion', {
        method: 'POST',
        body: {
          eventType: 'custom',
          eventName,
          eventData,
          userData,
          eventId
        }
      })
      return response
    } catch (error) {
      console.error('Failed to track custom event:', error)
      return { success: false, error: error.message }
    }
  }

  return {
    trackPurchase,
    trackInitiateCheckout,
    trackOrderStatusUpdate,
    trackCustomEvent
  }
}
