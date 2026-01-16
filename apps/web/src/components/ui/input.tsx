"use client"

import * as React from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Loader2, Search as SearchIcon, X } from "lucide-react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2 text-sm ring-offset-white file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-gray-500 dark:placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export interface SearchInputProps extends InputProps {
  isLoading?: boolean
  showClearButton?: boolean
  onClear?: () => void
  error?: string
  icon?: React.ReactNode
  animationType?: 'fade' | 'slide' | 'scale'
}

export const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(({
  isLoading = false,
  showClearButton = false,
  onClear,
  error,
  icon = <SearchIcon className="h-4 w-4 text-muted-foreground" />,
  animationType = 'fade',
  className,
  value: propValue,
  onChange,
  ...props
}, ref) => {
  const [value, setValue] = React.useState(propValue || '')
  const isControlled = propValue !== undefined
  
  React.useEffect(() => {
    if (isControlled) {
      setValue(propValue)
    }
  }, [propValue, isControlled])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!isControlled) {
      setValue(e.target.value)
    }
    onChange?.(e)
  }

  const handleClear = () => {
    if (!isControlled) {
      setValue('')
    }
    onClear?.()
  }

  const animationVariants = {
    fade: {
      initial: { opacity: 0, y: 5 },
      animate: { opacity: 1, y: 0 },
      exit: { opacity: 0, y: -5 },
    },
    slide: {
      initial: { x: -10, opacity: 0 },
      animate: { x: 0, opacity: 1 },
      exit: { x: 10, opacity: 0 },
    },
    scale: {
      initial: { scale: 0.95, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
      exit: { scale: 0.95, opacity: 0 },
    },
  }[animationType]

  return (
    <div className="relative w-full">
      <div className="relative">
        {icon && (
          <div className="absolute left-3 top-1/2 -translate-y-1/2">
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              icon
            )}
          </div>
        )}
        
        <Input
          ref={ref}
          value={isControlled ? propValue : value}
          onChange={handleChange}
          className={cn(
            'w-full',
            icon && 'pl-10',
            (showClearButton && (value || propValue)) && 'pr-10',
            className
          )}
          aria-invalid={!!error}
          {...props}
        />
        
        <AnimatePresence>
          {(showClearButton && (value || propValue)) && (
            <motion.button
              type="button"
              onClick={handleClear}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              initial="initial"
              animate="animate"
              exit="exit"
              variants={animationVariants}
              aria-label="Clear input"
            >
              <X className="h-4 w-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
      
      <AnimatePresence>
        {error && (
          <motion.p
            className="mt-1.5 text-sm text-destructive"
            initial="initial"
            animate="animate"
            exit="exit"
            variants={animationVariants}
            role="alert"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
})

SearchInput.displayName = 'SearchInput'

export { Input }