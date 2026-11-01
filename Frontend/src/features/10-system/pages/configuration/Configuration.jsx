import { useState } from 'react';

import TabButton from '../../../../shared/components/ui/TabButton';
import { apiErrorMessage } from '../../../../shared/lib/apiError';
import { ConfirmDialog } from '../../../02-offices/components/FormParts';
import { useNotification } from '../../../09-notifications/context/NotificationContext';
import { useSaveSettings, useSettings } from '../../hooks/useSystem';
import { fromFormValue, settingError, toFormValue } from '../../lib/settingValues';
import Footer from './Footer';
import LogoField from './LogoField';
import PageTitle from './PageTitle';
import SettingField from './SettingField';

const MAINTENANCE_KEY = 'maintenance_mode';

const Configuration = () => {
  const { notify } = useNotification();
  const { data: groups = [], isLoading, error } = useSettings();
  const save = useSaveSettings();
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [confirming, setConfirming] = useState(null);

  const group = groups.find((candidate) => candidate.group === selectedGroup) ?? groups[0];
  const draft = drafts[group?.group] ?? {};
  const valueOf = (setting) => draft[setting.key] ?? toFormValue(setting);
  const changedIn = (candidate) => candidate.settings.filter((setting) => setting.key in (drafts[candidate.group] ?? {}) && drafts[candidate.group][setting.key] !== toFormValue(setting));
  const changed = group ? changedIn(group) : [];
  // Messages about one setting show beside it, anything else shows above the buttons
  const hasFieldErrors = group?.settings.some((setting) => settingError(save.error, setting.key));

  const update = (key, value) => {
    save.reset();
    setDrafts({ ...drafts, [group.group]: { ...draft, [key]: value } });
  };

  const chooseGroup = (next) => {
    save.reset();
    setSelectedGroup(next);
  };

  const send = (settings, message) =>
    save.mutate(
      { group: group.group, settings },
      {
        onSuccess: () => {
          setDrafts({ ...drafts, [group.group]: {} });
          setConfirming(null);
          notify(message, 'success');
        },
        onError: () => setConfirming(null),
      }
    );

  const saveChanges = () => send(changed.map((setting) => ({ key: setting.key, value: fromFormValue(setting, valueOf(setting)) })), 'Settings saved.');
  const resetToDefaults = () => send(group.settings.filter((setting) => setting.type !== 'file').map(({ key }) => ({ key, value: null })), 'Settings reset to their defaults.');
  const turningMaintenanceOn = changed.some((setting) => setting.key === MAINTENANCE_KEY) && draft[MAINTENANCE_KEY] === true;

  return (
    <div className="flex min-h-full bg-background">
      <main className="flex min-w-0 flex-1 flex-col space-y-5 p-6">
        <PageTitle />

        {isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
        {error && <p className="text-sm text-red-500">{apiErrorMessage(error, 'Could not load the settings.')}</p>}

        {group && (
          <>
            <div className="flex flex-wrap gap-2">
              {groups.map((candidate) => (
                <TabButton key={candidate.group} label={`${candidate.label}${changedIn(candidate).length > 0 ? ' •' : ''}`} value={candidate.group} activeValue={group.group} onChange={chooseGroup} />
              ))}
            </div>

            <div className="flex flex-1 flex-col space-y-5 rounded-xl border border-border bg-card p-6">
              <div>
                <h2 className="text-lg font-semibold text-foreground">{group.label}</h2>
                <p className="text-xs text-muted-foreground">{group.description}</p>
              </div>

              <div className="grid flex-1 grid-cols-1 content-start items-start gap-x-6 gap-y-5 sm:grid-cols-2">
                {group.settings.map((setting) =>
                  setting.type === 'file' ? <LogoField key={setting.key} setting={setting} /> : <SettingField key={setting.key} setting={setting} value={valueOf(setting)} error={settingError(save.error, setting.key)} onChange={(value) => update(setting.key, value)} />
                )}
              </div>

              {save.error && !hasFieldErrors && <p className="text-sm text-red-500">{apiErrorMessage(save.error, 'Could not save the settings.')}</p>}

              <Footer settings={group.settings} isDirty={changed.length > 0} pending={save.isPending} onSave={() => (turningMaintenanceOn ? setConfirming('maintenance') : saveChanges())} onReset={() => setConfirming('reset')} />
            </div>
          </>
        )}

        <ConfirmDialog open={confirming === 'maintenance'} onClose={() => setConfirming(null)} title="Turn On Maintenance Mode" description="Everyone except university-wide settings managers is locked out until you turn it off." onConfirm={saveChanges} pending={save.isPending} confirmLabel="Turn On" />
        <ConfirmDialog open={confirming === 'reset'} onClose={() => setConfirming(null)} title="Reset to Defaults" description={`Put every setting in "${group?.label}" back to its default${group?.settings.some((setting) => setting.type === 'file') ? ', apart from the logo' : ''}? Your current values are lost.`} onConfirm={resetToDefaults} pending={save.isPending} confirmLabel="Reset" />
      </main>
    </div>
  );
};

export default Configuration;
