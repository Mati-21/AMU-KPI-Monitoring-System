const { User, Role, UserRole } = require('./models');
const { connectDB } = require('./config/database');

async function run() {
  await connectDB();
  const users = await User.findAll({
    where: { IsArchived: false },
    include: [{
      model: Role,
      through: { model: UserRole, where: { IsArchived: false } }
    }]
  });
  console.log('--- ACTIVE USERS IN DATABASE ---');
  users.forEach(u => {
    console.log(`User: ${u.UserName} (Email: ${u.Email})`);
    if (u.Roles) {
      u.Roles.forEach(r => console.log(`  - Role: ${r.RoleName} (ID: ${r.Id})`));
    }
  });
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
