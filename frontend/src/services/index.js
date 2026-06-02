// Switches between real and mock API based on VITE_DEMO_MODE env var
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true';

export { DEMO_MODE };

let api;
if (DEMO_MODE) {
  api = await import('./api.mock.js');
} else {
  api = await import('./api.js');
}

export const { authAPI, reportsAPI, calendarAPI, categoriesAPI, settingsAPI } = api;
