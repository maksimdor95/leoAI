import { APP_SETTINGS_STORAGE_KEY } from '@/lib/appSettingsStorage';

/** Runs before React paint to avoid light-theme FOUC on refresh. */
export const THEME_INIT_SCRIPT = `(function(){try{var raw=localStorage.getItem(${JSON.stringify(
  APP_SETTINGS_STORAGE_KEY
)});var theme='leo-dark';var locale='ru';if(raw){var parsed=JSON.parse(raw);if(parsed.theme==='hume-light')theme='hume';if(parsed.locale==='en')locale='en';}document.documentElement.setAttribute('data-theme',theme==='hume'?'hume':'leo-dark');document.documentElement.lang=locale;}catch(e){}})();`;
