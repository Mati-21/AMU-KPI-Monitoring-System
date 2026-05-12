
const { UserKPIResult, User, Role, UserRole } = require('../Backend/models');

async function traceValues() {
  const targetValues = [10, 9, 8, 5];
  
  try {
    const results = await UserKPIResult.findAll({
      where: {
        KPIResult: targetValues
      },
      include: [
        {
          model: User,
          attributes: ['FirstName', 'FatherName']
        }
      ]
    });

    console.log('--- TRACING VALUES ---');
    if (results.length === 0) {
      console.log('No results found with those values in KPIResult.');
    }

    for (const res of results) {
      // Find the user's roles
      const userRoles = await UserRole.findAll({
        where: { UserId: res.UserId, IsArchived: false },
        include: [{ model: Role, attributes: ['RoleName'] }]
      });
      
      const roles = userRoles.map(ur => ur.Role?.RoleName).join(', ');
      
      console.log(`Value: ${res.KPIResult} | User: ${res.User?.FirstName} ${res.User?.FatherName} | Roles: [${roles}] | Quarter: ${res.Quarter} | KPIId: ${res.KPIId}`);
    }

    // Check AdjustedResult too
    const adjustedResults = await UserKPIResult.findAll({
      where: {
        AdjustedResult: targetValues
      },
      include: [
        {
          model: User,
          attributes: ['FirstName', 'FatherName']
        }
      ]
    });

    if (adjustedResults.length > 0) {
      console.log('\n--- TRACING ADJUSTED VALUES ---');
      for (const res of adjustedResults) {
        const userRoles = await UserRole.findAll({
          where: { UserId: res.UserId, IsArchived: false },
          include: [{ model: Role, attributes: ['RoleName'] }]
        });
        const roles = userRoles.map(ur => ur.Role?.RoleName).join(', ');
        console.log(`Adjusted Value: ${res.AdjustedResult} | User: ${res.User?.FirstName} ${res.User?.FatherName} | Roles: [${roles}] | Quarter: ${res.Quarter}`);
      }
    }

  } catch (err) {
    console.error(err);
  } finally {
    process.exit();
  }
}

traceValues();
