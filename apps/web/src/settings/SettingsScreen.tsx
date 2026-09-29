import { THEME_PREFERENCES, type ThemePreference } from '@moneta/core/theme';
import { useHealth } from './useHealth';

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
