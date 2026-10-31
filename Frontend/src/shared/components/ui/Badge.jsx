import { cn } from '../../lib/utils';
import { badgeVariants } from './badgeVariants';

export function Badge({ className, variant, ...props }) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
