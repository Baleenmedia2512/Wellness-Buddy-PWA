// Common API configuration for routes that handle large payloads (images, etc.)
export const largeBodyConfig = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};
