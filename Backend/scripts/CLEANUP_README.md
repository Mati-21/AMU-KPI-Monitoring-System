# Database Cleanup and Reset Script

## Overview

The `cleanAndReseed.js` script performs a complete system cleanup and reset:

- **Deletes all data** from the database (all tables)
- **Creates a fresh System Administrator user** with default credentials
- **Preserves database structure** (tables remain intact)

## Usage

### Prerequisites

- Ensure the database is configured and connected
- Node.js and npm dependencies are installed
- You're in the Backend directory

### Run the Script

```bash
cd Backend
node scripts/cleanAndReseed.js
```

### Default Admin Credentials

After running the script, use these credentials to log in:

- **Email:** `admin@amu.edu.et`
- **Password:** `admin@123`
- **Username:** `admin`

## What Gets Deleted

The script clears all data from the following tables:

- AuditLog
- ContactMessage
- Message
- Notification
- OfficeReportSubmission
- UserActivityLog
- UserKPIResult
- UserKPI
- KPIDocument
- KPIYearPlan
- KPI
- KPIType
- UserRole
- User
- Role
- RoleCategory
- SystemSetting
- Unit

## What Gets Created

The script creates:

1. **System Administration** role category
2. **System Administrator** role with full permissions
3. **Admin user** with the specified credentials

## Safety Notes

⚠️ **WARNING:**

- This script **permanently deletes all data** in the database
- There is **no recovery** possible after running this
- Use only in development environments or with proper backups
- Always confirm before running in production

## Troubleshooting

### Script Fails to Connect

- Verify database credentials in `Backend/config/database.js`
- Ensure the database server is running
- Check network connectivity to the database

### Permission Errors

- Ensure your database user has proper permissions
- Database user must have permissions to DROP/CREATE tables and data

### Password Hashing Issues

- Verify `bcryptjs` package is installed: `npm list bcryptjs`
- If missing, install it: `npm install bcryptjs`

## Related Scripts

- `seedCoreHierarchy.js` - Seeds the complete role hierarchy and sample users
- `seedData.js` - Seeds sample data for testing
- `migrateStrategicOfficeToPresident.js` - Migrates role names

## Support

For issues or questions about this script, refer to the project documentation or contact the development team.
