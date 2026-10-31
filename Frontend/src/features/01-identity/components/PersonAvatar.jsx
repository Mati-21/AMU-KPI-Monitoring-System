import { useState } from 'react';

import { BASE_URL } from '../../../shared/api/axios';
import { cn } from '../../../shared/lib/utils';

const initialsOf = (fullName) =>
  String(fullName || '')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('') || 'U';

/**
 * A person's picture, or their initials when there is none or it cannot load.
 * The file id is in the address, so a new picture shows straight away.
 */
export const PersonAvatar = ({ personId, fileId, fullName, className }) => {
  const [failedFileId, setFailedFileId] = useState(null);

  return (
    <div className={cn('flex items-center justify-center overflow-hidden rounded-full bg-primary/10 font-bold text-primary', className)}>
      {fileId && fileId !== failedFileId ? (
        <img src={`${BASE_URL}/api/v1/persons/${personId}/profile-picture?v=${fileId}`} alt={fullName} className="h-full w-full object-cover" onError={() => setFailedFileId(fileId)} />
      ) : (
        initialsOf(fullName)
      )}
    </div>
  );
};

export default PersonAvatar;
