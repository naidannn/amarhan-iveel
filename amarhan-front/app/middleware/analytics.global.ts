// middleware/analytics.global.ts
export default defineNuxtRouteMiddleware((to, from) => {
    const ref = to.query.ref;
    const social = to.query.social;
    
    if (ref || social) {
      const payload = {
        ref: ref || '',
        social: social || '',
      };
  
      // Get API base URL from runtime config
      const config = useRuntimeConfig()
      const baseUrl = config.public.apiBase || 'http://localhost:4000'
  
      // Send the data to your backend using configured base URL
      fetch(`${baseUrl}/api/v1/analytics/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      })
        .then((res) => {
          if (!res.ok) {
            throw new Error('Network response was not ok');
          }
        //   console.log('Tracking data sent successfully');
        })
        .catch(err => console.error('Tracking error:', err));
    }
  });