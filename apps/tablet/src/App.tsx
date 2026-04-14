import { Authenticator, translations } from '@aws-amplify/ui-react';
import { I18n } from 'aws-amplify/utils';
import { Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { Home } from './pages/Home';
import { Measure } from './pages/Measure';
import { History } from './pages/History';
import { Containers } from './pages/Containers';

I18n.putVocabularies(translations);
I18n.setLanguage('ja');

export function App() {
  return (
    <Authenticator hideSignUp>
      {({ signOut, user }) => (
        <AppLayout user={user} onSignOut={signOut}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/measure" element={<Measure />} />
            <Route path="/history" element={<History />} />
            <Route path="/containers" element={<Containers />} />
          </Routes>
        </AppLayout>
      )}
    </Authenticator>
  );
}
