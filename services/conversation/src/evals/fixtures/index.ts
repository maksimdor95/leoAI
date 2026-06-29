export type { JackPersonaFixture } from './types';
export { JACK_QUICK_PATH_PERSONA } from './jackQuickPathPersona';
export {
  JACK_SENIOR_PM_PERSONA,
  JACK_MIDDLE_PM_PERSONA,
  JACK_JUNIOR_PM_PERSONA,
} from './jackDetailedPersonas';

import { JACK_JUNIOR_PM_PERSONA, JACK_MIDDLE_PM_PERSONA, JACK_SENIOR_PM_PERSONA } from './jackDetailedPersonas';
import { JACK_QUICK_PATH_PERSONA } from './jackQuickPathPersona';
import { JackPersonaFixture } from './types';

export const ALL_JACK_PERSONA_FIXTURES: JackPersonaFixture[] = [
  JACK_QUICK_PATH_PERSONA,
  JACK_SENIOR_PM_PERSONA,
  JACK_MIDDLE_PM_PERSONA,
  JACK_JUNIOR_PM_PERSONA,
];
