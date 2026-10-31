import { useSelector } from 'react-redux';

import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../../shared/components/ui/Tabs';
import { AboutCard, PlacementsCard } from '../components/profile/AboutCards';
import ProfileHeader from '../components/profile/ProfileHeader';
import { MfaCard, PasswordCard, SessionsCard } from '../components/profile/SecurityCards';

/**
 * The signed-in person's own profile. Administrators open other people from user management.
 */
const UserProfile = () => {
  const user = useSelector((state) => state.auth.user);

  return (
    <div className="flex flex-1 overflow-y-auto bg-background">
      <div className="flex-1 flex flex-col min-w-0">
        <main className="flex-1 p-6 overflow-y-auto space-y-6">
          <ProfileHeader user={user} />

          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="security">Security</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <AboutCard user={user} />
                <PlacementsCard placements={user.placements} />
              </div>
            </TabsContent>

            <TabsContent value="security">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                <PasswordCard mfaEnabled={user.mfaEnabled} />
                <MfaCard user={user} />
                <SessionsCard />
              </div>
            </TabsContent>
          </Tabs>
        </main>
      </div>
    </div>
  );
};

export default UserProfile;
