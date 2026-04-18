import { useState } from 'react';
import { Eye, Edit, Trash2, Check, Plus, Search } from 'lucide-react';
import * as Switch from '@radix-ui/react-switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TablePagination } from '../../../Components/UI/Table';

const permissionHeaders = [
  { label: 'View', icon: Eye },
  { label: 'Create', icon: Plus },
  { label: 'Edit', icon: Edit },
  { label: 'Delete', icon: Trash2 },
  { label: 'Approve', icon: Check },
];

function PermissionTable({ permissions, setPermissions, search }) {
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const filteredPermissions = permissions.filter((p) => p.module.toLowerCase().includes(search.toLowerCase()));
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedPermissions = filteredPermissions.slice(startIndex, startIndex + itemsPerPage);

  const togglePermission = (moduleName, field) => {
    setPermissions((prev) =>
      prev.map((permission) => (permission.module === moduleName ? { ...permission, [field]: !permission[field] } : permission))
    );
  };

  return (
    <div>
      <Table>
        <TableHeader>
          <TableRow className="bg-primary/10">
            <TableHead className="font-semibold text-foreground w-62.5">Module</TableHead>

            {permissionHeaders.map(({ label, icon: Icon }) => (
              <TableHead key={label} className="font-semibold text-foreground text-center">
                <div className="flex flex-col items-center gap-1">
                  <Icon className="w-4 h-4" />
                  <span className="text-xs">{label}</span>
                </div>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>

        <TableBody>
          {paginatedPermissions.map((perm) => (
            <TableRow key={perm.module}>
              <TableCell className="font-medium">{perm.module}</TableCell>

              {['view', 'create', 'edit', 'delete', 'approve'].map((field) => (
                <TableCell key={field} className="text-center">
                  {/* ✅ Proper Radix Switch */}
                  <Switch.Root
                    checked={perm[field]}
                    onCheckedChange={() => togglePermission(perm.module, field)}
                    className="w-10 h-5 bg-gray-300 rounded-full relative data-[state=checked]:bg-primary transition"
                  >
                    <Switch.Thumb className="block w-4 h-4 bg-white rounded-full shadow transform translate-x-0.5 data-[state=checked]:translate-x-5 transition" />
                  </Switch.Root>
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <TablePagination currentPage={currentPage} totalItems={filteredPermissions.length} itemsPerPage={itemsPerPage} onPageChange={setCurrentPage} />
    </div>
  );
}

export default PermissionTable;
