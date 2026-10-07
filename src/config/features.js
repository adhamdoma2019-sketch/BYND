// Switches that turn features on or off for the whole site.
//
// SIGNUP_OPEN: lets anyone create a new shop. Keep it OFF while a single shop
// (BYND) uses the site. To open signup later, add the setting
// VITE_ALLOW_SIGNUP = true in Vercel and redeploy.
export const SIGNUP_OPEN = import.meta.env.VITE_ALLOW_SIGNUP === 'true';
