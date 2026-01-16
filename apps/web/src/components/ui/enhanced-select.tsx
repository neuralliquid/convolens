"use client"

import * as SelectPrimitive from "@radix-ui/react-select"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, ChevronDown, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import * as React from "react"

const Select = SelectPrimitive.Root
const SelectGroup = SelectPrimitive.Group
const SelectValue = SelectPrimitive.Value

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1",
      className
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
))
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
>(({ className, children, position = "popper", ...props }, ref) => (
  <SelectPrimitive.Portal>
    <SelectPrimitive.Content
      ref={ref}
      className={cn(
        "relative z-50 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
        position === "popper" &&
          "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
        className
      )}
      position={position}
      {...props}
    >
      <SelectPrimitive.Viewport
        className={cn(
          "p-1",
          position === "popper" &&
            "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]"
        )}
      >
        {children}
      </SelectPrimitive.Viewport>
    </SelectPrimitive.Content>
  </SelectPrimitive.Portal>
))
SelectContent.displayName = SelectPrimitive.Content.displayName

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item> & {
    indicatorClassName?: string
    label?: string
  }
>(({ className, children, indicatorClassName, label, ...props }, ref) => (
  <SelectPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none focus:bg-accent focus:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
      className
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <Check className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{label || children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
))
SelectItem.displayName = SelectPrimitive.Item.displayName

interface SelectItemType {
  value: string
  label: string
  disabled?: boolean
}

export interface EnhancedSelectProps {
  isLoading?: boolean
  loadingText?: string
  items: SelectItemType[]
  label?: string
  placeholder?: string
  error?: string
  animationType?: 'fade' | 'slide' | 'scale'
  value?: string
  onValueChange?: (value: string) => void
  defaultValue?: string
  className?: string
  disabled?: boolean
}

export function EnhancedSelect({
  isLoading = false,
  loadingText = 'Loading...',
  items = [],
  label,
  placeholder = 'Select an option',
  error,
  animationType = 'fade',
  value,
  onValueChange,
  defaultValue,
  className,
  disabled = false,
  ...props
}: EnhancedSelectProps) {
  const animationVariants = {
    fade: {
      initial: { opacity: 0, y: 10 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -10 },
    },
    slide: {
      initial: { opacity: 0, x: -10 },
      animate: { opacity: 1, x: 0 },
      exit: { opacity: 0, x: 10 },
    },
    scale: {
      initial: { opacity: 0, scale: 0.95 },
      animate: { opacity: 1, scale: 1 },
      exit: { opacity: 0, scale: 0.95 },
    },
  }[animationType]

  return (
    <div className="w-full space-y-1.5">
      {label && (
        <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          {label}
        </label>
      )}
      
      <Select 
        value={value}
        onValueChange={onValueChange}
        defaultValue={defaultValue}
        disabled={isLoading || disabled}
        {...props}
      >
        <SelectTrigger className={cn("w-full", className)}>
          <SelectValue placeholder={isLoading ? loadingText : placeholder} />
        </SelectTrigger>
        
        <SelectContent>
          <AnimatePresence>
            {isLoading ? (
              <motion.div
                className="flex items-center justify-center py-2 text-sm text-muted-foreground"
                initial="initial"
                animate="animate"
                exit="exit"
                variants={animationVariants}
              >
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {loadingText}
              </motion.div>
            ) : (
              <motion.div
                initial="initial"
                animate="animate"
                exit="exit"
                variants={animationVariants}
                className="w-full"
              >
                {items.map((item) => (
                  <SelectItem 
                    key={item.value} 
                    value={item.value}
                    disabled={item.disabled}
                    label={item.label}
                    className={item.disabled ? "opacity-50 cursor-not-allowed" : ""}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </SelectContent>
      </Select>
      
      {error && (
        <motion.p
          className="text-sm text-destructive"
          initial={{ opacity: 0, y: -5 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {error}
        </motion.p>
      )}
    </div>
  )
}
