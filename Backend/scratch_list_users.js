const { User, Role, UserRole } = require('./models');
const { connectDB } = require('./config/database');

async function run() {
  await connectDB();
  const users = await User.findAll({
    where: { IsArchived: false },
    include: [{
      model: UserRole,
      where: { IsArchived: false },
      include: [Role]
    }]
  });
  console.log('--- ACTIVE USERS IN DATABASE ---');
  users.forEach(u => {
    console.log(`User: ${u.UserName} (Email: ${u.Email})`);
    if (u.UserRoles) {
      u.UserRoles.forEach(ur => {
        if (ur.Role) {
          console.log(`  - Role: ${ur.Role.RoleName} (ID: ${ur.Role.Id})`);
        }
      });
    }
  });
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
