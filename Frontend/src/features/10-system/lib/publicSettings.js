import { setMaintenance, setSystemSettings } from '../../01-identity/store/authSlice';

/**
 * Keep the app's branding and maintenance state in step with GET /settings/public.
 */
export const applyPublicSettings = (dispatch, { system, branding, general }) => {
  dispatch(setMaintenance(Boolean(system?.maintenance_mode)));
  dispatch(
    setSystemSettings({
      displayName: branding?.system_name,
      orgName: branding?.university_name,
      systemLogo: branding?.logo ? `/api/v1/files/${branding.logo}/public` : null,
      supportEmail: general?.contact_email ?? null,
    })
  );
};
