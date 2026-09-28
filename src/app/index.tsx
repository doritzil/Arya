import { Redirect } from 'expo-router';

import { useLibrary } from '@/data/store';

export default function Index() {
  const onboarded = useLibrary((s) => s.prefs.onboardingDone);
  return <Redirect href={onboarded ? '/discover' : '/welcome'} />;
}
