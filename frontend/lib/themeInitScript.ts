import { APP_SETTINGS_STORAGE_KEY } from '@/lib/appSettingsStorage';
import { APP_LOCALE_COOKIE, APP_THEME_COOKIE } from '@/lib/appThemeCookie';

/** Runs before React paint to avoid theme FOUC on refresh. */
export const THEME_INIT_SCRIPT = `(function(){try{var raw=localStorage.getItem(${JSON.stringify(
  APP_SETTINGS_STORAGE_KEY
)});var theme='leo-dark';var locale='ru';if(raw){var parsed=JSON.parse(raw);if(parsed.theme==='hume-light')theme='hume';if(parsed.locale==='en')locale='en';}document.documentElement.setAttribute('data-theme',theme);document.documentElement.lang=locale;var maxAge=31536000;var base='path=/;max-age='+maxAge+';samesite=lax'+(location.protocol==='https:'?';secure':'');document.cookie=${JSON.stringify(
  APP_THEME_COOKIE
)}+'='+theme+';'+base;document.cookie=${JSON.stringify(APP_LOCALE_COOKIE)}+'='+locale+';'+base;}catch(e){}})();`;
