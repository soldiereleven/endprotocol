import { useTranslation } from "react-i18next";

export default function TestPage() {
  const { t, i18n } = useTranslation();

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-4">{t('nav.dashboard')} - Test Page</h1>
      <div className="space-y-4">
        <p className="text-lg">{t('common.welcome')}</p>
        
        <div className="mt-6 p-4 bg-default-100 rounded-lg">
          <h2 className="text-xl font-semibold mb-2">Current Language: {i18n.language}</h2>
          <p className="text-sm text-muted">Try switching languages using the language selector in the navbar!</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
          <div className="p-4 border rounded-lg">
            <h3 className="font-medium mb-2">Navigation Labels</h3>
            <ul className="space-y-1 text-sm">
              <li>Dashboard: {t('nav.dashboard')}</li>
              <li>Analytics: {t('nav.analytics')}</li>
              <li>Projects: {t('nav.projects')}</li>
              <li>Team: {t('nav.team')}</li>
              <li>Calendar: {t('nav.calendar')}</li>
            </ul>
          </div>

          <div className="p-4 border rounded-lg">
            <h3 className="font-medium mb-2">Common Text</h3>
            <ul className="space-y-1 text-sm">
              <li>Search: {t('common.search')}</li>
              <li>Sponsor: {t('common.sponsor')}</li>
              <li>Settings: {t('menu.settings')}</li>
              <li>Help: {t('menu.help')}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
