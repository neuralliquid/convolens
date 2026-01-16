import React from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';

interface StyledCardProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
  gradient?: boolean;
}

export function StyledCard({ 
  title, 
  description, 
  icon, 
  children, 
  footer,
  className = "",
  gradient = true
}: StyledCardProps) {
  return (
    <Card className={`card-border-animation relative overflow-hidden ${className}`}>
      {gradient && (
        <div className="h-1.5 bg-gradient-to-r from-[#25D366] via-[#34E89E] to-[#128C7E] animate-gradient-x"></div>
      )}
      
      {(title || description || icon) && (
        <CardHeader className={icon ? "flex flex-row items-center gap-4" : ""}>
          {icon && (
            <div className="card-icon">
              {icon}
            </div>
          )}
          <div>
            {title && <CardTitle>{title}</CardTitle>}
            {description && <CardDescription>{description}</CardDescription>}
          </div>
        </CardHeader>
      )}
      
      <CardContent>
        {children}
      </CardContent>
      
      {footer && (
        <CardFooter>
          {footer}
        </CardFooter>
      )}
    </Card>
  );
}