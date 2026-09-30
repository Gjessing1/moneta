import { THEME_PREFERENCES, type ThemePreference } from '@moneta/core/theme';
import { useHealth } from './useHealth';
import { Link } from '../router';
import { useMailyImport } from './useMailyImport';

const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

export function SettingsScreen({
  themePreference,
  onThemeChange,
}: {
  themePreference: ThemePreference;
  onThemeChange: (preference: ThemePreference) => void;
}) {
  const health = useHealth();
  const mailImport = useMailyImport();

  return (
    <div className="screen">
      <header className="screen-header">
        <h1 className="screen-title">Settings</h1>
      </header>

      <section className="settings-section" aria-labelledby="appearance-heading">
        <h2 id="appearance-heading" className="section-title">
          Appearance
        </h2>
        <fieldset className="segmented segmented--radio">
          <legend className="visually-hidden">Theme</legend>
          {THEME_PREFERENCES.map(function renderOption(preference) {
            return (
              <label key={preference} className="segmented__option">
                <input
                  type="radio"
                  name="theme"
                  className="segmented__input"
                  value={preference}
                  checked={preference === themePreference}
                  onChange={function choose() {
                    onThemeChange(preference);
                  }}
                />
                {THEME_LABELS[preference]}
              </label>
            );
          })}
        </fieldset>
        <p className="note">System follows your phone or computer.</p>
      </section>

      <section className="settings-section" aria-labelledby="archive-heading">
        <h2 id="archive-heading" className="section-title">
          Archive
        </h2>
        <div className="list">
          <Link className="facet-row" to={{ name: 'recentlyDeleted' }}>
            Recently deleted
          </Link>
        </div>
      </section>

      <section className="settings-section" aria-labelledby="import-heading">
        <h2 id="import-heading" className="section-title">
          Mail import
        </h2>
        <dl className="list">
          <div className="list__row">
            <dt>Last import</dt>
            <dd className="list__value">
              {mailImport.loading
                ? 'Checking…'
                : mailImport.lastSuccessAt
                  ? new Date(mailImport.lastSuccessAt).toLocaleString()
                  : 'Never'}
            </dd>
          </div>
          {mailImport.lastError && (
            <div className="list__row">
              <dt>Error</dt>
              <dd className="list__value">{mailImport.lastError}</dd>
            </div>
          )}
        </dl>
      </section>

      <section className="settings-section" aria-labelledby="about-heading">
        <h2 id="about-heading" className="section-title">
          About
        </h2>
        <dl className="list">
          <div className="list__row">
            <dt>Version</dt>
            <dd className="list__value">{health}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
