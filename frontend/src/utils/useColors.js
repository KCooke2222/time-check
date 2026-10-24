import { useEffect, useState } from 'react';
import { categoriesAPI } from '../services/api';
import { chartNames, makeColors } from './ledger';

// One colour per charted section, fixed by the section order in Settings.
let cached = null;
export default function useColors() {
  const [colorOf, setColorOf] = useState(() => cached || makeColors([]));
  useEffect(() => {
    if (cached) return;
    categoriesAPI.listSections()
      .then(d => { cached = makeColors(chartNames(d.sections)); setColorOf(() => cached); })
      .catch(() => {});
  }, []);
  return colorOf;
}
