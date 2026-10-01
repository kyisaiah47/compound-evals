'use client';

import { useRouter } from 'next/navigation';
import ThemedSelect from './ThemedSelect';
import { useDraft } from './SiteViewProvider';

/* THE ACTION CARD'S CONTROL. Pick an environment and open its task book. A themed listbox,
 * never a native select. The choice is a shared draft, so a switch of view keeps it. */
export default function EnvPicker({ options }: { options: { value: string; label: string }[] }) {
  const router = useRouter();
  const [v, setV] = useDraft('env-pick', options[0]?.value ?? '');
  return (
    <form className="sv-form" onSubmit={(e) => { e.preventDefault(); if (v) router.push(`/${v}`); }}>
      <ThemedSelect label="Environment" options={options} value={v} onChange={setV} />
      <button className="sv-primary" type="submit">Open its tasks and scores</button>
    </form>
  );
}
