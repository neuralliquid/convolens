import { ComponentType, forwardRef } from 'react';
import { LucideProps } from 'lucide-react';
import { cn } from '@/lib/utils';

type IconType = React.ForwardRefExoticComponent<
  Omit<LucideProps, 'ref'> & React.RefAttributes<SVGSVGElement>
>;

interface IconWrapperProps extends Omit<LucideProps, 'ref'> {
  icon: IconType;
  className?: string;
}

export const IconWrapper = forwardRef<SVGSVGElement, IconWrapperProps>(
  ({ icon: Icon, className, size = 16, ...props }, ref) => {
    return (
      <Icon
        ref={ref}
        className={cn('h-4 w-4', className)}
        size={size}
        {...props}
      />
    );
  }
);

IconWrapper.displayName = 'IconWrapper';

export default IconWrapper;
